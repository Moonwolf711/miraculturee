/* ------------------------------------------------------------------
   React hook for WebSocket subscriptions with channel filtering.
   Automatically connects on mount, disconnects on unmount, and
   subscribes/unsubscribes to the requested channel.
   ------------------------------------------------------------------ */

import { useEffect, useRef, useState, useCallback } from 'react';
import { wsClient, type WSMessage, type ConnectionState } from '../lib/ws.js';

/**
 * Subscribe to WebSocket messages for a specific channel.
 *
 * @param channel - Channel to subscribe to (e.g. "event:abc123" or "events:list").
 *                  Pass `null` to skip subscription (useful when an ID is not yet available).
 * @param onMessage - Called for every WSMessage that matches the channel's eventId filter.
 */
export function useWebSocket(
  channel: string | null,
  onMessage?: (message: WSMessage) => void,
): { connectionState: ConnectionState } {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    wsClient.getState(),
  );

  // Keep onMessage ref stable to avoid re-subscribing on every render
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    // Connect (ref-counted — multiple hooks share one connection)
    wsClient.connect();

    // Listen for state changes
    const unsubState = wsClient.onStateChange(setConnectionState);

    // Subscribe to channel if provided
    if (channel) {
      wsClient.subscribe(channel);
    }

    // Listen for messages and forward to callback
    const unsubMsg = wsClient.onMessage((msg) => {
      onMessageRef.current?.(msg);
    });

    return () => {
      unsubMsg();
      unsubState();
      if (channel) {
        wsClient.unsubscribe(channel);
      }
      wsClient.disconnect();
    };
  }, [channel]);

  return { connectionState };
}

/**
 * Get just the WebSocket connection state (for the ConnectionStatus component).
 * Does not subscribe to any channel — only tracks connection health.
 */
export function useConnectionState(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(wsClient.getState());

  useEffect(() => {
    const unsub = wsClient.onStateChange(setState);
    return unsub;
  }, []);

  return state;
}

/**
 * Polling fallback hook — use when WebSocket is unavailable.
 * Fetches data at the given interval and stops when WebSocket connects.
 *
 * @param fetcher - Function to call on each interval tick. Return void or a promise.
 * @param intervalMs - Polling interval in milliseconds (default 15s).
 * @param enabled - Set to false to disable polling entirely.
 */
export function usePollingFallback(
  fetcher: () => void | Promise<void>,
  intervalMs = 15_000,
  enabled = true,
): void {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const connectionState = useConnectionState();

  const isConnected = connectionState === 'connected';

  const poll = useCallback(() => {
    fetcherRef.current();
  }, []);

  useEffect(() => {
    // Don't poll if WS is connected or polling is disabled
    if (isConnected || !enabled) return;

    const id = setInterval(poll, intervalMs);
    return () => clearInterval(id);
  }, [isConnected, enabled, intervalMs, poll]);
}
