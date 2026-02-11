/* ------------------------------------------------------------------
   Mock WebSocket for testing WS-dependent components.
   Simulates the browser WebSocket API with controllable behavior.
   Uses vi.stubGlobal to avoid read-only property errors in happy-dom.
   ------------------------------------------------------------------ */

import { vi } from 'vitest';

interface MockWSInstance {
  url: string;
  readyState: number;
  onopen: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

let instances: MockWSInstance[] = [];

export function getWSInstances(): MockWSInstance[] {
  return instances;
}

export function getLatestWSInstance(): MockWSInstance | undefined {
  return instances[instances.length - 1];
}

export function clearWSInstances(): void {
  instances = [];
}

/**
 * Simulate the server sending a message to the latest WS instance.
 */
export function simulateWSMessage(data: Record<string, unknown>): void {
  const ws = getLatestWSInstance();
  if (ws?.onmessage) {
    ws.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
}

/**
 * Simulate the WebSocket opening successfully.
 */
export function simulateWSOpen(): void {
  const ws = getLatestWSInstance();
  if (ws) {
    ws.readyState = 1; // OPEN
    ws.onopen?.(new Event('open'));
  }
}

/**
 * Simulate the WebSocket closing.
 */
export function simulateWSClose(code = 1000): void {
  const ws = getLatestWSInstance();
  if (ws) {
    ws.readyState = 3; // CLOSED
    ws.onclose?.(new CloseEvent('close', { code }));
  }
}

/**
 * Simulate a WebSocket error.
 */
export function simulateWSError(): void {
  const ws = getLatestWSInstance();
  if (ws) {
    ws.onerror?.(new Event('error'));
  }
}

/**
 * Install the mock WebSocket globally using vi.stubGlobal.
 * Returns a cleanup function for afterEach.
 */
export function installMockWebSocket(): () => void {
  const OriginalWebSocket = globalThis.WebSocket;

  clearWSInstances();

  const MockWebSocket = vi.fn().mockImplementation((url: string) => {
    const instance: MockWSInstance = {
      url,
      readyState: 0, // CONNECTING
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      send: vi.fn(),
      close: vi.fn().mockImplementation(function (this: MockWSInstance) {
        this.readyState = 3; // CLOSED
        this.onclose?.(new CloseEvent('close', { code: 1000 }));
      }),
    };
    instances.push(instance);
    return instance;
  });

  // Copy static constants
  MockWebSocket.CONNECTING = 0;
  MockWebSocket.OPEN = 1;
  MockWebSocket.CLOSING = 2;
  MockWebSocket.CLOSED = 3;

  vi.stubGlobal('WebSocket', MockWebSocket);

  return () => {
    vi.stubGlobal('WebSocket', OriginalWebSocket);
    clearWSInstances();
  };
}
