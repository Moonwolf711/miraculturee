/* ------------------------------------------------------------------
   WebSocket client with auto-reconnect, heartbeat, and typed messages.
   Designed for graceful degradation — the app works without WS.
   ------------------------------------------------------------------ */

/* ============== Message Types (Discriminated Union) ============== */

export interface RaffleNewEntryMessage {
  type: 'raffle:new_entry';
  eventId: string;
  pool: { id: string; fanName: string; createdAt: string };
}

export interface TicketSupportedMessage {
  type: 'ticket:supported';
  eventId: string;
  supportedTickets: number;
  totalTickets: number;
}

export interface EventUpdatedMessage {
  type: 'event:updated';
  eventId: string;
  changes: Record<string, unknown>;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  ts: number;
}

export type WSMessage =
  | RaffleNewEntryMessage
  | TicketSupportedMessage
  | EventUpdatedMessage
  | HeartbeatMessage;

/* ============== Connection State ============== */

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

/* ============== Listener Type ============== */

type MessageListener = (message: WSMessage) => void;
type StateListener = (state: ConnectionState) => void;

/* ============== WebSocket Client ============== */

const WS_BASE = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

/** Backoff config — exponential: 1s, 2s, 4s, 8s, 16s, capped at 30s */
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

/** Heartbeat timeout — if no heartbeat from server in this window, reconnect */
const HEARTBEAT_TIMEOUT_MS = 45_000;

/** Client heartbeat interval — send ping to keep connection alive */
const PING_INTERVAL_MS = 30_000;

class WSClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private messageListeners = new Set<MessageListener>();
  private stateListeners = new Set<StateListener>();
  private channels = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private intentionalClose = false;
  private refCount = 0;

  /* ---------- Public API ---------- */

  /** Increment ref count and connect if not already connected */
  connect(): void {
    this.refCount++;
    if (this.refCount === 1) {
      this.intentionalClose = false;
      this.doConnect();
    }
  }

  /** Decrement ref count and disconnect when nobody needs the connection */
  disconnect(): void {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0) {
      this.intentionalClose = true;
      this.cleanup();
      this.setState('disconnected');
    }
  }

  /** Subscribe to a channel — sends subscribe message if connected */
  subscribe(channel: string): void {
    this.channels.add(channel);
    this.sendSubscribe(channel);
  }

  /** Unsubscribe from a channel */
  unsubscribe(channel: string): void {
    this.channels.delete(channel);
    this.sendUnsubscribe(channel);
  }

  /** Add a message listener */
  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  /** Add a connection state listener */
  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    // Immediately notify of current state
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /** Get current connection state */
  getState(): ConnectionState {
    return this.state;
  }

  /* ---------- Internal ---------- */

  private doConnect(): void {
    // Don't attempt connection in SSR or if already connecting/connected
    if (typeof window === 'undefined') return;
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.setState(this.state === 'disconnected' ? 'connecting' : 'reconnecting');

    try {
      this.ws = new WebSocket(WS_BASE);
    } catch {
      // WebSocket constructor can throw if URL is invalid
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.setState('connected');
      this.backoffMs = INITIAL_BACKOFF_MS;
      // Re-subscribe to all active channels
      for (const channel of this.channels) {
        this.sendSubscribe(channel);
      }
      this.startHeartbeat();
      this.startPing();
    };

    this.ws.onmessage = (evt: MessageEvent) => {
      try {
        const data: unknown = JSON.parse(String(evt.data));
        if (isWSMessage(data)) {
          if (data.type === 'heartbeat') {
            this.resetHeartbeat();
          }
          for (const listener of this.messageListeners) {
            listener(data);
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.stopPing();
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onerror is always followed by onclose — reconnect logic lives there
    };
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    this.setState('reconnecting');
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, this.backoffMs);
    // Exponential backoff
    this.backoffMs = Math.min(this.backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.stopPing();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.stateListeners) {
      listener(next);
    }
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private sendSubscribe(channel: string): void {
    this.send({ action: 'subscribe', channel });
  }

  private sendUnsubscribe(channel: string): void {
    this.send({ action: 'unsubscribe', channel });
  }

  /* Heartbeat — detect stale connections */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setTimeout(() => {
      // No heartbeat received — force reconnect
      this.ws?.close();
    }, HEARTBEAT_TIMEOUT_MS);
  }

  private resetHeartbeat(): void {
    this.startHeartbeat();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /* Client-side ping to keep connection alive */
  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ action: 'ping' });
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

/* ============== Type Guard ============== */

const VALID_TYPES = new Set<string>([
  'raffle:new_entry',
  'ticket:supported',
  'event:updated',
  'heartbeat',
]);

function isWSMessage(data: unknown): data is WSMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    typeof (data as { type: unknown }).type === 'string' &&
    VALID_TYPES.has((data as { type: string }).type)
  );
}

/* ============== Singleton export ============== */

export const wsClient = new WSClient();
