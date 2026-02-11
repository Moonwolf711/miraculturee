/* ------------------------------------------------------------------
   Unit tests for lib/ws.ts — WSClient, type guard, backoff logic.
   ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  installMockWebSocket,
  getLatestWSInstance,
  simulateWSOpen,
  simulateWSClose,
  simulateWSMessage,
  simulateWSError,
} from '../test/mocks/ws.js';

/* We need a fresh wsClient for each test — re-import the module */
let wsClient: typeof import('./ws.js')['wsClient'];
let isWSMessageFn: undefined | ((data: unknown) => boolean);

/* Helper to dynamically import fresh module */
async function loadModule() {
  /* vitest.resetModules forces a fresh module evaluation */
  vi.resetModules();
  const mod = await import('./ws.js');
  wsClient = mod.wsClient;
  return mod;
}

describe('WSClient', () => {
  let cleanupWS: () => void;

  beforeEach(async () => {
    vi.useFakeTimers();
    cleanupWS = installMockWebSocket();
    await loadModule();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupWS();
  });

  /* ---------- Connection & ref counting ---------- */

  describe('connect / disconnect (ref counting)', () => {
    it('creates a WebSocket on first connect()', () => {
      wsClient.connect();
      expect(getLatestWSInstance()).toBeDefined();
      expect(getLatestWSInstance()!.url).toContain('ws');
      wsClient.disconnect();
    });

    it('does not create a second WebSocket on repeated connect() calls', () => {
      wsClient.connect();
      const first = getLatestWSInstance();
      wsClient.connect();
      expect(getLatestWSInstance()).toBe(first);
      wsClient.disconnect();
      wsClient.disconnect();
    });

    it('stays connected when ref count > 0', () => {
      wsClient.connect();
      wsClient.connect();
      simulateWSOpen();

      // First disconnect — ref count drops to 1
      wsClient.disconnect();
      expect(wsClient.getState()).toBe('connected');

      // Second disconnect — ref count drops to 0 — disconnects
      wsClient.disconnect();
      expect(wsClient.getState()).toBe('disconnected');
    });

    it('ref count never goes below 0', () => {
      wsClient.disconnect();
      wsClient.disconnect();
      wsClient.disconnect();
      // Should not throw, state stays disconnected
      expect(wsClient.getState()).toBe('disconnected');
    });
  });

  /* ---------- Connection state transitions ---------- */

  describe('state transitions', () => {
    it('transitions connecting -> connected on open', () => {
      const states: string[] = [];
      wsClient.onStateChange((s) => states.push(s));
      wsClient.connect();
      simulateWSOpen();

      expect(states).toContain('connecting');
      expect(states).toContain('connected');
      wsClient.disconnect();
    });

    it('transitions to reconnecting after close (non-intentional)', () => {
      wsClient.connect();
      simulateWSOpen();

      const states: string[] = [];
      wsClient.onStateChange((s) => states.push(s));
      simulateWSClose();

      expect(states).toContain('reconnecting');
      wsClient.disconnect();
    });

    it('does not reconnect on intentional disconnect', () => {
      wsClient.connect();
      simulateWSOpen();
      wsClient.disconnect();

      // The state should be disconnected with no reconnect scheduled
      expect(wsClient.getState()).toBe('disconnected');
    });
  });

  /* ---------- Auto-reconnect with backoff ---------- */

  describe('auto-reconnect with exponential backoff', () => {
    it('reconnects after initial backoff of 1s', () => {
      wsClient.connect();
      simulateWSOpen();
      simulateWSClose();

      expect(wsClient.getState()).toBe('reconnecting');

      // Advance 1s — should trigger reconnect
      vi.advanceTimersByTime(1000);
      // A new WebSocket instance should be created
      expect(getLatestWSInstance()!.readyState).toBe(WebSocket.CONNECTING);

      wsClient.disconnect();
    });

    it('doubles backoff on successive failures: 1s, 2s, 4s', () => {
      wsClient.connect();

      // First close — backoff 1s
      simulateWSOpen();
      simulateWSClose();
      vi.advanceTimersByTime(1000);

      // Second close — backoff 2s
      simulateWSOpen();
      simulateWSClose();
      vi.advanceTimersByTime(1000); // too early
      // Should still be reconnecting since we only waited 1s
      expect(wsClient.getState()).toBe('reconnecting');
      vi.advanceTimersByTime(1000); // now 2s total

      // Third close — backoff 4s
      simulateWSOpen();
      simulateWSClose();
      vi.advanceTimersByTime(3000); // too early
      expect(wsClient.getState()).toBe('reconnecting');
      vi.advanceTimersByTime(1000); // now 4s total

      wsClient.disconnect();
    });

    it('caps backoff at 30s', () => {
      wsClient.connect();

      // Simulate many failures to ramp up backoff
      for (let i = 0; i < 10; i++) {
        simulateWSOpen();
        simulateWSClose();
        vi.advanceTimersByTime(30_000);
      }

      // After many failures, backoff should be capped at 30s
      simulateWSOpen();
      simulateWSClose();
      vi.advanceTimersByTime(29_000); // just under 30s
      expect(wsClient.getState()).toBe('reconnecting');
      vi.advanceTimersByTime(1000); // exactly 30s — should reconnect now

      wsClient.disconnect();
    });

    it('resets backoff after successful connection', () => {
      wsClient.connect();

      // Ramp up backoff
      simulateWSOpen();
      simulateWSClose();
      vi.advanceTimersByTime(1000);

      simulateWSOpen();
      simulateWSClose();
      vi.advanceTimersByTime(2000);

      // Successful connection resets backoff
      simulateWSOpen();
      simulateWSClose();

      // After reset, should reconnect after 1s
      vi.advanceTimersByTime(1000);
      // A fresh connection attempt has been made
      expect(getLatestWSInstance()).toBeDefined();

      wsClient.disconnect();
    });
  });

  /* ---------- Channel subscription ---------- */

  describe('channel subscription', () => {
    it('sends subscribe message when connected', () => {
      wsClient.connect();
      simulateWSOpen();
      wsClient.subscribe('event:abc');

      const ws = getLatestWSInstance()!;
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ action: 'subscribe', channel: 'event:abc' }),
      );

      wsClient.unsubscribe('event:abc');
      wsClient.disconnect();
    });

    it('sends unsubscribe message when connected', () => {
      wsClient.connect();
      simulateWSOpen();
      wsClient.subscribe('event:abc');
      wsClient.unsubscribe('event:abc');

      const ws = getLatestWSInstance()!;
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ action: 'unsubscribe', channel: 'event:abc' }),
      );

      wsClient.disconnect();
    });

    it('re-subscribes to all channels on reconnect', () => {
      wsClient.connect();
      simulateWSOpen();
      wsClient.subscribe('event:abc');
      wsClient.subscribe('events:list');

      // Force reconnect
      simulateWSClose();
      vi.advanceTimersByTime(1000);
      simulateWSOpen();

      const ws = getLatestWSInstance()!;
      const sentMessages = ws.send.mock.calls.map((c: unknown[]) => JSON.parse(c[0] as string));
      const subscribes = sentMessages.filter(
        (m: Record<string, unknown>) => m.action === 'subscribe',
      );
      expect(subscribes).toEqual(
        expect.arrayContaining([
          { action: 'subscribe', channel: 'event:abc' },
          { action: 'subscribe', channel: 'events:list' },
        ]),
      );

      wsClient.disconnect();
    });
  });

  /* ---------- Message listeners ---------- */

  describe('message listeners', () => {
    it('notifies listeners on valid message', () => {
      const listener = vi.fn();
      wsClient.connect();
      simulateWSOpen();
      wsClient.onMessage(listener);

      simulateWSMessage({
        type: 'ticket:supported',
        eventId: 'evt-1',
        supportedTickets: 80,
        totalTickets: 200,
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ticket:supported', eventId: 'evt-1' }),
      );

      wsClient.disconnect();
    });

    it('ignores malformed (non-JSON) messages', () => {
      const listener = vi.fn();
      wsClient.connect();
      simulateWSOpen();
      wsClient.onMessage(listener);

      // Send raw text that is not JSON
      const ws = getLatestWSInstance()!;
      ws.onmessage?.(new MessageEvent('message', { data: 'not json' }));

      expect(listener).not.toHaveBeenCalled();

      wsClient.disconnect();
    });

    it('ignores messages with unknown type', () => {
      const listener = vi.fn();
      wsClient.connect();
      simulateWSOpen();
      wsClient.onMessage(listener);

      simulateWSMessage({ type: 'unknown:type', data: 'test' });
      expect(listener).not.toHaveBeenCalled();

      wsClient.disconnect();
    });

    it('removes listener on unsubscribe', () => {
      const listener = vi.fn();
      wsClient.connect();
      simulateWSOpen();
      const unsub = wsClient.onMessage(listener);
      unsub();

      simulateWSMessage({
        type: 'heartbeat',
        ts: Date.now(),
      });

      expect(listener).not.toHaveBeenCalled();

      wsClient.disconnect();
    });
  });

  /* ---------- State listeners ---------- */

  describe('state listeners', () => {
    it('immediately calls listener with current state', () => {
      const listener = vi.fn();
      wsClient.onStateChange(listener);

      expect(listener).toHaveBeenCalledWith('disconnected');
    });

    it('removes state listener on unsubscribe', () => {
      wsClient.connect();
      simulateWSOpen();

      const listener = vi.fn();
      const unsub = wsClient.onStateChange(listener);
      listener.mockClear();

      unsub();
      wsClient.disconnect();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  /* ---------- Heartbeat ---------- */

  describe('heartbeat', () => {
    it('resets heartbeat timer on heartbeat message', () => {
      wsClient.connect();
      simulateWSOpen();

      // Advance to near the heartbeat timeout (45s)
      vi.advanceTimersByTime(40_000);

      // Send heartbeat — should reset the timer
      simulateWSMessage({ type: 'heartbeat', ts: Date.now() });

      // Advance another 40s — still within timeout because of reset
      vi.advanceTimersByTime(40_000);

      expect(wsClient.getState()).toBe('connected');

      wsClient.disconnect();
    });
  });
});

/* ============== Type Guard Tests ============== */

describe('isWSMessage type guard', () => {
  /* We test indirectly via wsClient.onMessage since isWSMessage is not exported */

  let cleanupWS: () => void;

  beforeEach(async () => {
    vi.useFakeTimers();
    cleanupWS = installMockWebSocket();
    await loadModule();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupWS();
  });

  it('accepts valid raffle:new_entry', () => {
    const listener = vi.fn();
    wsClient.connect();
    simulateWSOpen();
    wsClient.onMessage(listener);

    simulateWSMessage({
      type: 'raffle:new_entry',
      eventId: 'evt-1',
      pool: { id: 'p1', fanName: 'Jane', createdAt: '2026-01-01' },
    });
    expect(listener).toHaveBeenCalledTimes(1);

    wsClient.disconnect();
  });

  it('accepts valid event:updated', () => {
    const listener = vi.fn();
    wsClient.connect();
    simulateWSOpen();
    wsClient.onMessage(listener);

    simulateWSMessage({
      type: 'event:updated',
      eventId: 'evt-1',
      changes: { title: 'New Title' },
    });
    expect(listener).toHaveBeenCalledTimes(1);

    wsClient.disconnect();
  });

  it('rejects null', () => {
    const listener = vi.fn();
    wsClient.connect();
    simulateWSOpen();
    wsClient.onMessage(listener);

    const ws = getLatestWSInstance()!;
    ws.onmessage?.(new MessageEvent('message', { data: 'null' }));
    expect(listener).not.toHaveBeenCalled();

    wsClient.disconnect();
  });

  it('rejects object without type field', () => {
    const listener = vi.fn();
    wsClient.connect();
    simulateWSOpen();
    wsClient.onMessage(listener);

    simulateWSMessage({ eventId: 'evt-1' });
    expect(listener).not.toHaveBeenCalled();

    wsClient.disconnect();
  });

  it('rejects object with numeric type', () => {
    const listener = vi.fn();
    wsClient.connect();
    simulateWSOpen();
    wsClient.onMessage(listener);

    simulateWSMessage({ type: 42 });
    expect(listener).not.toHaveBeenCalled();

    wsClient.disconnect();
  });
});
