/* ------------------------------------------------------------------
   Mock Socket.IO client for testing WS-dependent components.
   Replaces the socket.io-client module with a controllable mock.
   ------------------------------------------------------------------ */

import { vi } from 'vitest';

/* ============== Mock io() function for vi.mock('socket.io-client') ============== */

export const mockIo = vi.fn();

/* ============== Mock Socket Instance ============== */

interface MockSocket {
  connected: boolean;
  id: string;
  /** Registered event handlers via .on() */
  _handlers: Map<string, Set<(...args: unknown[]) => void>>;
  /** Registered io-level event handlers */
  _ioHandlers: Map<string, Set<(...args: unknown[]) => void>>;
  /** Track emit calls */
  emit: ReturnType<typeof vi.fn>;
  on: (event: string, handler: (...args: unknown[]) => void) => MockSocket;
  off: (event: string, handler?: (...args: unknown[]) => void) => MockSocket;
  disconnect: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  io: {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    off: (event: string, handler?: (...args: unknown[]) => void) => void;
  };
}

let mockSocketInstance: MockSocket | null = null;

function createMockSocket(): MockSocket {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const ioHandlers = new Map<string, Set<(...args: unknown[]) => void>>();

  const socket: MockSocket = {
    connected: false,
    id: 'mock-socket-id',
    _handlers: handlers,
    _ioHandlers: ioHandlers,
    emit: vi.fn(),
    on(event: string, handler: (...args: unknown[]) => void) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return socket;
    },
    off(event: string, handler?: (...args: unknown[]) => void) {
      if (handler) {
        handlers.get(event)?.delete(handler);
      } else {
        handlers.delete(event);
      }
      return socket;
    },
    disconnect: vi.fn().mockImplementation(() => {
      socket.connected = false;
    }),
    removeAllListeners: vi.fn().mockImplementation(() => {
      handlers.clear();
      ioHandlers.clear();
    }),
    io: {
      on(event: string, handler: (...args: unknown[]) => void) {
        if (!ioHandlers.has(event)) ioHandlers.set(event, new Set());
        ioHandlers.get(event)!.add(handler);
      },
      off(event: string, handler?: (...args: unknown[]) => void) {
        if (handler) {
          ioHandlers.get(event)?.delete(handler);
        } else {
          ioHandlers.delete(event);
        }
      },
    },
  };

  return socket;
}

/* ============== Accessors ============== */

export function getMockSocket(): MockSocket | null {
  return mockSocketInstance;
}

/* ============== Simulation Helpers ============== */

/**
 * Simulate the Socket.IO connection opening.
 */
export function simulateWSOpen(): void {
  const socket = mockSocketInstance;
  if (!socket) return;
  socket.connected = true;
  const connectHandlers = socket._handlers.get('connect');
  if (connectHandlers) {
    for (const handler of connectHandlers) handler();
  }
}

/**
 * Simulate the Socket.IO connection closing.
 */
export function simulateWSClose(): void {
  const socket = mockSocketInstance;
  if (!socket) return;
  socket.connected = false;
  const disconnectHandlers = socket._handlers.get('disconnect');
  if (disconnectHandlers) {
    for (const handler of disconnectHandlers) handler();
  }
}

/**
 * Simulate the server emitting a typed message.
 * For Socket.IO, messages arrive as named events, not raw onmessage.
 */
export function simulateWSMessage(data: Record<string, unknown>): void {
  const socket = mockSocketInstance;
  if (!socket) return;

  const type = data.type as string;
  if (!type) return;

  // Socket.IO emits events by name — the ws.ts source listens on each event name
  const eventHandlers = socket._handlers.get(type);
  if (eventHandlers) {
    for (const handler of eventHandlers) handler(data);
  }
}

/**
 * Simulate a connection error.
 */
export function simulateWSError(): void {
  const socket = mockSocketInstance;
  if (!socket) return;
  const errorHandlers = socket._handlers.get('connect_error');
  if (errorHandlers) {
    for (const handler of errorHandlers) handler(new Error('mock error'));
  }
}

/**
 * Simulate reconnect attempt (io-level event).
 */
export function simulateReconnectAttempt(): void {
  const socket = mockSocketInstance;
  if (!socket) return;
  const ioHandlers = socket._ioHandlers.get('reconnect_attempt');
  if (ioHandlers) {
    for (const handler of ioHandlers) handler();
  }
}

/* ============== Install / Cleanup ============== */

/**
 * Install Socket.IO mock via vi.mock.
 * Must be called in beforeEach. Returns a cleanup function.
 */
export function installMockWebSocket(): () => void {
  mockSocketInstance = createMockSocket();
  mockIo.mockReturnValue(mockSocketInstance);

  return () => {
    mockSocketInstance = null;
    mockIo.mockReset();
  };
}

/* ============== Legacy aliases for backward compat ============== */
export const getLatestWSInstance = getMockSocket;
export const getWSInstances = () => mockSocketInstance ? [mockSocketInstance] : [];
export const clearWSInstances = () => { mockSocketInstance = null; };
