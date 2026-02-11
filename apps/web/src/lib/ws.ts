/* ------------------------------------------------------------------
   WebSocket client using Socket.IO with auto-reconnect and typed messages.
   Designed for graceful degradation — the app works without WS.
   ------------------------------------------------------------------ */

import { io, type Socket } from 'socket.io-client';

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

/* ============== Socket.IO Client ============== */

const WS_BASE = import.meta.env.VITE_WS_URL || '';

/** All event names the server can emit that we care about */
const MESSAGE_EVENTS = [
  'raffle:new_entry',
  'ticket:supported',
  'event:updated',
  'heartbeat',
] as const;

class WSClient {
  private socket: Socket | null = null;
  private state: ConnectionState = 'disconnected';
  private messageListeners = new Set<MessageListener>();
  private stateListeners = new Set<StateListener>();
  private channels = new Set<string>();
  private refCount = 0;

  /* ---------- Public API ---------- */

  /** Increment ref count and connect if not already connected */
  connect(): void {
    this.refCount++;
    if (this.refCount === 1) {
      this.doConnect();
    }
  }

  /** Decrement ref count and disconnect when nobody needs the connection */
  disconnect(): void {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0) {
      this.cleanup();
      this.setState('disconnected');
    }
  }

  /** Subscribe to a channel — joins Socket.IO room via server */
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
    if (typeof window === 'undefined') return;
    if (this.socket?.connected) return;

    this.setState('connecting');

    try {
      this.socket = io(WS_BASE || undefined, {
        path: '/ws',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
      });
    } catch {
      this.setState('disconnected');
      return;
    }

    this.socket.on('connect', () => {
      this.setState('connected');
      // Re-subscribe to all active channels
      for (const channel of this.channels) {
        this.sendSubscribe(channel);
      }
    });

    // Listen for all typed message events
    for (const eventName of MESSAGE_EVENTS) {
      this.socket.on(eventName, (data: unknown) => {
        const msg = typeof data === 'object' && data !== null && 'type' in data
          ? (data as WSMessage)
          : { type: eventName, ...(typeof data === 'object' && data !== null ? data : {}) } as WSMessage;
        for (const listener of this.messageListeners) {
          listener(msg);
        }
      });
    }

    this.socket.on('disconnect', () => {
      if (this.refCount > 0) {
        this.setState('reconnecting');
      }
    });

    this.socket.io.on('reconnect_attempt', () => {
      this.setState('reconnecting');
    });

    this.socket.on('connect_error', () => {
      if (this.state !== 'reconnecting') {
        this.setState('reconnecting');
      }
    });
  }

  private cleanup(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.stateListeners) {
      listener(next);
    }
  }

  private sendSubscribe(channel: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe', channel);
      // Also emit join:event for event-specific channels (backward compat)
      const match = channel.match(/^event:(.+)$/);
      if (match) {
        this.socket.emit('join:event', match[1]);
      }
    }
  }

  private sendUnsubscribe(channel: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe', channel);
    }
  }
}

/* ============== Singleton export ============== */

export const wsClient = new WSClient();
