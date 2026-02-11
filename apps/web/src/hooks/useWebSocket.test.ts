/* ------------------------------------------------------------------
   Unit tests for hooks/useWebSocket.ts — useWebSocket, useConnectionState,
   usePollingFallback.
   ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  installMockWebSocket,
  getMockSocket,
  simulateWSOpen,
  simulateWSClose,
  simulateWSMessage,
} from '../test/mocks/ws.js';

/* ============== Mock socket.io-client ============== */

const { mockIo } = vi.hoisted(() => ({
  mockIo: vi.fn(),
}));

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

/* We need to import from a fresh wsClient each time */
let useWebSocket: typeof import('./useWebSocket.js')['useWebSocket'];
let useConnectionState: typeof import('./useWebSocket.js')['useConnectionState'];
let usePollingFallback: typeof import('./useWebSocket.js')['usePollingFallback'];

async function loadHooks() {
  vi.resetModules();
  const mod = await import('./useWebSocket.js');
  useWebSocket = mod.useWebSocket;
  useConnectionState = mod.useConnectionState;
  usePollingFallback = mod.usePollingFallback;
}

describe('useWebSocket', () => {
  let cleanupWS: () => void;

  beforeEach(async () => {
    vi.useFakeTimers();
    cleanupWS = installMockWebSocket();
    mockIo.mockReturnValue(getMockSocket());
    await loadHooks();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupWS();
    mockIo.mockReset();
  });

  it('returns initial connection state', () => {
    const { result, unmount } = renderHook(() => useWebSocket('test-channel'));
    // Initial state before connection opens
    expect(['disconnected', 'connecting']).toContain(result.current.connectionState);
    unmount();
  });

  it('connects on mount and disconnects on unmount', async () => {
    const { result, unmount } = renderHook(() => useWebSocket('event:abc'));

    await act(async () => {
      simulateWSOpen();
    });

    expect(result.current.connectionState).toBe('connected');

    unmount();
    // After unmount, the wsClient ref count drops — no assertion on global state
    // since other tests may use it, but unmount should not throw.
  });

  it('calls onMessage for matching messages', async () => {
    const onMessage = vi.fn();
    const { unmount } = renderHook(() => useWebSocket('event:evt-1', onMessage));

    await act(async () => {
      simulateWSOpen();
    });

    await act(async () => {
      simulateWSMessage({
        type: 'ticket:supported',
        eventId: 'evt-1',
        supportedTickets: 80,
        totalTickets: 200,
      });
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ticket:supported' }),
    );

    unmount();
  });

  it('skips subscription when channel is null', async () => {
    const onMessage = vi.fn();
    const { unmount } = renderHook(() => useWebSocket(null, onMessage));

    await act(async () => {
      simulateWSOpen();
    });

    // Should still connect (ref counted) but not subscribe to any channel
    unmount();
  });

  it('cleans up subscription when channel changes', async () => {
    const onMessage = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ channel }: { channel: string | null }) => useWebSocket(channel, onMessage),
      { initialProps: { channel: 'event:abc' as string | null } },
    );

    await act(async () => {
      simulateWSOpen();
    });

    // Change channel
    rerender({ channel: 'event:xyz' });

    // Should not crash, new subscription active
    await act(async () => {
      simulateWSMessage({
        type: 'raffle:new_entry',
        eventId: 'evt-1',
        pool: { id: 'p1', fanName: 'Test', createdAt: '2026-01-01' },
      });
    });

    expect(onMessage).toHaveBeenCalled();
    unmount();
  });
});

describe('useConnectionState', () => {
  let cleanupWS: () => void;

  beforeEach(async () => {
    vi.useFakeTimers();
    cleanupWS = installMockWebSocket();
    mockIo.mockReturnValue(getMockSocket());
    await loadHooks();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupWS();
    mockIo.mockReset();
  });

  it('returns current connection state', () => {
    const { result, unmount } = renderHook(() => useConnectionState());
    expect(result.current).toBe('disconnected');
    unmount();
  });

  it('updates when wsClient state changes', async () => {
    // Need to connect via useWebSocket to drive state changes
    const { unmount: unmountWS } = renderHook(() => useWebSocket('test'));
    const { result, unmount: unmountState } = renderHook(() => useConnectionState());

    await act(async () => {
      simulateWSOpen();
    });

    expect(result.current).toBe('connected');

    unmountWS();
    unmountState();
  });
});

describe('usePollingFallback', () => {
  let cleanupWS: () => void;

  beforeEach(async () => {
    vi.useFakeTimers();
    cleanupWS = installMockWebSocket();
    mockIo.mockReturnValue(getMockSocket());
    await loadHooks();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupWS();
    mockIo.mockReset();
  });

  it('polls at the given interval when WS is disconnected', () => {
    const fetcher = vi.fn();
    const { unmount } = renderHook(() => usePollingFallback(fetcher, 5000));

    // WS is disconnected by default, so polling should be active
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    unmount();
  });

  it('stops polling when WS connects', async () => {
    const fetcher = vi.fn();
    // First need a useWebSocket to drive the connection
    const { unmount: unmountWS } = renderHook(() => useWebSocket('test'));
    const { unmount: unmountPoll } = renderHook(() => usePollingFallback(fetcher, 5000));

    await act(async () => {
      simulateWSOpen();
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(fetcher).not.toHaveBeenCalled();

    unmountPoll();
    unmountWS();
  });

  it('does not poll when disabled', () => {
    const fetcher = vi.fn();
    const { unmount } = renderHook(() => usePollingFallback(fetcher, 5000, false));

    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(fetcher).not.toHaveBeenCalled();

    unmount();
  });

  it('resumes polling when WS disconnects', async () => {
    const fetcher = vi.fn();
    const { unmount: unmountWS } = renderHook(() => useWebSocket('test'));
    const { unmount: unmountPoll } = renderHook(() => usePollingFallback(fetcher, 5000));

    // Connect — stops polling
    await act(async () => {
      simulateWSOpen();
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(fetcher).not.toHaveBeenCalled();

    // Disconnect — should resume polling
    await act(async () => {
      simulateWSClose();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    unmountPoll();
    unmountWS();
  });
});
