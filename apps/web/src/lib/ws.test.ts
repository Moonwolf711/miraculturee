/* ------------------------------------------------------------------
   Unit tests for lib/ws.ts — WSClient (Socket.IO based).
   ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  installMockWebSocket,
  getMockSocket,
  simulateWSOpen,
  simulateWSClose,
  simulateWSMessage,
  simulateWSError,
  simulateReconnectAttempt,
} from '../test/mocks/ws.js';

/* ============== Mock socket.io-client ============== */

const { mockIo } = vi.hoisted(() => ({
  mockIo: vi.fn(),
}));

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

/* We need a fresh wsClient for each test — re-import the module */
let wsClient: typeof import('./ws.js')['wsClient'];

/* Helper to dynamically import fresh module */
async function loadModule() {
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
    // Wire the HOISTED mockIo (used by vi.mock) to return the same mock socket
    mockIo.mockReturnValue(getMockSocket());
    await loadModule();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupWS();
    mockIo.mockReset();
  });

  /* ---------- Connection & ref counting ---------- */

  describe('connect / disconnect (ref counting)', () => {
    it('creates a Socket.IO connection on first connect()', () => {
      wsClient.connect();
      expect(mockIo).toHaveBeenCalled();
      wsClient.disconnect();
    });

    it('does not create a second connection on repeated connect() calls', () => {
      wsClient.connect();
      const callCount = mockIo.mock.calls.length;
      wsClient.connect();
      expect(mockIo.mock.calls.length).toBe(callCount);
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

  /* ---------- Reconnection (handled by Socket.IO internally) ---------- */

  describe('reconnection', () => {
    it('enters reconnecting state on disconnect with active refs', () => {
      wsClient.connect();
      simulateWSOpen();
      simulateWSClose();

      expect(wsClient.getState()).toBe('reconnecting');
      wsClient.disconnect();
    });

    it('enters reconnecting state on reconnect_attempt io event', () => {
      wsClient.connect();
      simulateWSOpen();

      simulateReconnectAttempt();

      expect(wsClient.getState()).toBe('reconnecting');
      wsClient.disconnect();
    });

    it('returns to connected when reconnection succeeds', () => {
      wsClient.connect();
      simulateWSOpen();
      simulateWSClose();

      expect(wsClient.getState()).toBe('reconnecting');

      // Simulate successful reconnection
      simulateWSOpen();
      expect(wsClient.getState()).toBe('connected');

      wsClient.disconnect();
    });

    it('enters reconnecting state on connect_error', () => {
      wsClient.connect();
      simulateWSOpen();

      simulateWSError();

      expect(wsClient.getState()).toBe('reconnecting');
      wsClient.disconnect();
    });

    it('configures Socket.IO with reconnection settings', () => {
      wsClient.connect();

      // Verify io() was called with reconnection options
      const options = mockIo.mock.calls[0]?.[1];
      expect(options).toEqual(
        expect.objectContaining({
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 30000,
        }),
      );

      wsClient.disconnect();
    });
  });

  /* ---------- Channel subscription ---------- */

  describe('channel subscription', () => {
    it('emits subscribe when connected', () => {
      wsClient.connect();
      simulateWSOpen();
      wsClient.subscribe('event:abc');

      const socket = getMockSocket()!;
      expect(socket.emit).toHaveBeenCalledWith('subscribe', 'event:abc');

      wsClient.unsubscribe('event:abc');
      wsClient.disconnect();
    });

    it('emits join:event for event-type channels', () => {
      wsClient.connect();
      simulateWSOpen();
      wsClient.subscribe('event:abc');

      const socket = getMockSocket()!;
      expect(socket.emit).toHaveBeenCalledWith('join:event', 'abc');

      wsClient.unsubscribe('event:abc');
      wsClient.disconnect();
    });

    it('emits unsubscribe when connected', () => {
      wsClient.connect();
      simulateWSOpen();
      wsClient.subscribe('event:abc');
      wsClient.unsubscribe('event:abc');

      const socket = getMockSocket()!;
      expect(socket.emit).toHaveBeenCalledWith('unsubscribe', 'event:abc');

      wsClient.disconnect();
    });

    it('re-subscribes to all channels on reconnect', () => {
      wsClient.connect();
      simulateWSOpen();
      wsClient.subscribe('event:abc');
      wsClient.subscribe('events:list');

      const socket = getMockSocket()!;
      socket.emit.mockClear();

      // Force reconnect
      simulateWSClose();
      simulateWSOpen();

      const emitCalls = socket.emit.mock.calls;
      const subscribes = emitCalls.filter(
        (c: unknown[]) => c[0] === 'subscribe',
      );
      expect(subscribes).toEqual(
        expect.arrayContaining([
          ['subscribe', 'event:abc'],
          ['subscribe', 'events:list'],
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
    it('forwards heartbeat messages to listeners', () => {
      const listener = vi.fn();
      wsClient.connect();
      simulateWSOpen();
      wsClient.onMessage(listener);

      simulateWSMessage({ type: 'heartbeat', ts: Date.now() });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'heartbeat' }),
      );
      expect(wsClient.getState()).toBe('connected');

      wsClient.disconnect();
    });
  });
});

/* ============== Type Guard Tests ============== */

describe('isWSMessage type guard', () => {
  let cleanupWS: () => void;

  beforeEach(async () => {
    vi.useFakeTimers();
    cleanupWS = installMockWebSocket();
    mockIo.mockReturnValue(getMockSocket());
    await loadModule();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupWS();
    mockIo.mockReset();
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

  it('rejects messages with unknown type', () => {
    const listener = vi.fn();
    wsClient.connect();
    simulateWSOpen();
    wsClient.onMessage(listener);

    simulateWSMessage({ type: 'bogus:event' });
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
});
