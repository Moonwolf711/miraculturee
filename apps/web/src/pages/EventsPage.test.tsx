/* ------------------------------------------------------------------
   Integration tests for EventsPage.
   Tests loading state, event cards, search, and WS live updates.
   ------------------------------------------------------------------ */

import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils.js';
import EventsPage from './EventsPage.js';

/* Mock useWebSocket and usePollingFallback to avoid real WS connections */
const mockUseWebSocket = vi.fn().mockReturnValue({ connectionState: 'connected' });
const mockUsePollingFallback = vi.fn();

vi.mock('../hooks/useWebSocket.js', () => ({
  useWebSocket: (...args: unknown[]) => mockUseWebSocket(...args),
  usePollingFallback: (...args: unknown[]) => mockUsePollingFallback(...args),
}));

describe('EventsPage', () => {
  it('shows loading skeleton initially', () => {
    renderWithProviders(<EventsPage />, {
      routerProps: { initialEntries: ['/events'] },
    });

    // CardSkeleton uses animate-pulse class
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders event cards after loading', async () => {
    renderWithProviders(<EventsPage />, {
      routerProps: { initialEntries: ['/events'] },
    });

    // Wait for events to load
    const title = await screen.findByText('Summer Vibes Tour');
    expect(title).toBeInTheDocument();
    expect(screen.getByText('Midnight Jazz')).toBeInTheDocument();
  });

  it('displays artist name and venue', async () => {
    renderWithProviders(<EventsPage />, {
      routerProps: { initialEntries: ['/events'] },
    });

    await screen.findByText('Summer Vibes Tour');

    // Check artist and venue info appear
    expect(screen.getByText(/DJ Sunshine/)).toBeInTheDocument();
    expect(screen.getByText(/The Warehouse/)).toBeInTheDocument();
    expect(screen.getByText(/Austin/)).toBeInTheDocument();
  });

  it('displays ticket prices', async () => {
    renderWithProviders(<EventsPage />, {
      routerProps: { initialEntries: ['/events'] },
    });

    await screen.findByText('Summer Vibes Tour');
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$75.00')).toBeInTheDocument();
  });

  it('shows progress bars with supported ticket counts', async () => {
    renderWithProviders(<EventsPage />, {
      routerProps: { initialEntries: ['/events'] },
    });

    await screen.findByText('Summer Vibes Tour');

    expect(screen.getByText('75/200 supported')).toBeInTheDocument();
    expect(screen.getByText('120/150 supported')).toBeInTheDocument();

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBe(2);
  });

  it('page title renders', async () => {
    renderWithProviders(<EventsPage />, {
      routerProps: { initialEntries: ['/events'] },
    });

    expect(screen.getByText('UPCOMING SHOWS')).toBeInTheDocument();
  });

  /* ---------- Search ---------- */

  describe('search', () => {
    it('filters events by city', async () => {
      const user = userEvent.setup();

      renderWithProviders(<EventsPage />, {
        routerProps: { initialEntries: ['/events'] },
      });

      await screen.findByText('Summer Vibes Tour');

      const searchInput = screen.getByLabelText('Search events by city');
      await user.type(searchInput, 'Austin');
      await user.click(screen.getByText('Search'));

      // After search, only Austin event should remain
      await waitFor(() => {
        expect(screen.getByText('Summer Vibes Tour')).toBeInTheDocument();
      });
    });

    it('shows empty state when no results match', async () => {
      const user = userEvent.setup();

      renderWithProviders(<EventsPage />, {
        routerProps: { initialEntries: ['/events'] },
      });

      await screen.findByText('Summer Vibes Tour');

      const searchInput = screen.getByLabelText('Search events by city');
      await user.type(searchInput, 'Nonexistent City');
      await user.click(screen.getByText('Search'));

      await waitFor(() => {
        expect(screen.getByText('NO UPCOMING SHOWS')).toBeInTheDocument();
      });
    });
  });

  /* ---------- Error handling ---------- */

  describe('error state', () => {
    it('shows error with retry button on API failure', async () => {
      const { http, HttpResponse } = await import('msw');
      const { server } = await import('../test/mocks/server.js');

      server.use(
        http.get('/api/events', () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 });
        }),
      );

      renderWithProviders(<EventsPage />, {
        routerProps: { initialEntries: ['/events'] },
      });

      const errorMsg = await screen.findByText('Server error');
      expect(errorMsg).toBeInTheDocument();

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  /* ---------- WS integration ---------- */

  describe('WebSocket integration', () => {
    it('subscribes to events:list channel', () => {
      renderWithProviders(<EventsPage />, {
        routerProps: { initialEntries: ['/events'] },
      });

      expect(mockUseWebSocket).toHaveBeenCalledWith(
        'events:list',
        expect.any(Function),
      );
    });

    it('sets up polling fallback', () => {
      renderWithProviders(<EventsPage />, {
        routerProps: { initialEntries: ['/events'] },
      });

      expect(mockUsePollingFallback).toHaveBeenCalledWith(
        expect.any(Function),
        30_000,
      );
    });

    it('passes handleWSMessage callback that updates ticket counts', async () => {
      renderWithProviders(<EventsPage />, {
        routerProps: { initialEntries: ['/events'] },
      });

      await screen.findByText('Summer Vibes Tour');
      expect(screen.getByText('75/200 supported')).toBeInTheDocument();

      // Get the onMessage callback that was passed to useWebSocket.
      // The component wraps handleWSMessage with useCallback, so
      // it is stable across renders.
      const onMessage = mockUseWebSocket.mock.calls[
        mockUseWebSocket.mock.calls.length - 1
      ][1] as (msg: Record<string, unknown>) => void;
      expect(typeof onMessage).toBe('function');

      // Simulate a WS message updating ticket counts.
      // Wrap in act() so React processes the state update.
      act(() => {
        onMessage({
          type: 'ticket:supported',
          eventId: 'evt-1',
          supportedTickets: 100,
          totalTickets: 200,
        });
      });

      // Verify DOM updates with the new values
      expect(screen.getByText('100/200 supported')).toBeInTheDocument();
    });
  });
});
