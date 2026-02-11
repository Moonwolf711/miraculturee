/* ------------------------------------------------------------------
   Integration tests for EventDetailPage.
   Tests rendering, support flow, raffle pool display, WS updates.
   ------------------------------------------------------------------ */

import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils.js';
import EventDetailPage from './EventDetailPage.js';

/* Mock useWebSocket and usePollingFallback */
const mockOnMessage = vi.fn();
const mockUseWebSocket = vi.fn().mockReturnValue({ connectionState: 'connected' });
const mockUsePollingFallback = vi.fn();

vi.mock('../hooks/useWebSocket.js', () => ({
  useWebSocket: (...args: unknown[]) => {
    mockUseWebSocket(...args);
    return { connectionState: 'connected' };
  },
  usePollingFallback: (...args: unknown[]) => mockUsePollingFallback(...args),
  useConnectionState: () => 'connected',
}));

/* Mock StripeCheckout to avoid Stripe SDK loading */
vi.mock('../components/StripeCheckout.js', () => ({
  default: ({ onSuccess, onCancel, submitLabel }: {
    onSuccess: () => void;
    onCancel?: () => void;
    submitLabel?: string;
  }) => (
    <div data-testid="stripe-checkout">
      <button onClick={onSuccess}>{submitLabel || 'Pay Now'}</button>
      {onCancel && <button onClick={onCancel}>Cancel</button>}
    </div>
  ),
}));

/* Mock react-router useParams */
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'evt-1' }),
  };
});

describe('EventDetailPage', () => {
  it('shows loading state initially', () => {
    renderWithProviders(<EventDetailPage />, {
      routerProps: { initialEntries: ['/events/evt-1'] },
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders event details after loading', async () => {
    renderWithProviders(<EventDetailPage />, {
      routerProps: { initialEntries: ['/events/evt-1'] },
    });

    const title = await screen.findByText('Summer Vibes Tour');
    expect(title).toBeInTheDocument();
    expect(screen.getByText('DJ Sunshine')).toBeInTheDocument();
    expect(screen.getByText('The Warehouse')).toBeInTheDocument();
    expect(screen.getByText('123 Music Lane')).toBeInTheDocument();
  });

  it('shows event description', async () => {
    renderWithProviders(<EventDetailPage />, {
      routerProps: { initialEntries: ['/events/evt-1'] },
    });

    const desc = await screen.findByText('An incredible night of music under the stars.');
    expect(desc).toBeInTheDocument();
  });

  it('displays ticket stats', async () => {
    renderWithProviders(<EventDetailPage />, {
      routerProps: { initialEntries: ['/events/evt-1'] },
    });

    await screen.findByText('Summer Vibes Tour');

    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument(); // total tickets
    expect(screen.getByText('75')).toBeInTheDocument(); // supported
    expect(screen.getByText('50 km')).toBeInTheDocument(); // local radius
  });

  it('shows progress bar with support percentage', async () => {
    renderWithProviders(<EventDetailPage />, {
      routerProps: { initialEntries: ['/events/evt-1'] },
    });

    await screen.findByText('Summer Vibes Tour');

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '38'); // 75/200 = 37.5% rounded
  });

  /* ---------- Raffle Pools ---------- */

  describe('raffle pools', () => {
    it('displays raffle pool information', async () => {
      renderWithProviders(<EventDetailPage />, {
        routerProps: { initialEntries: ['/events/evt-1'] },
      });

      await screen.findByText('Summer Vibes Tour');

      expect(screen.getByText('RAFFLE POOLS')).toBeInTheDocument();
      expect(screen.getByText('$5.00')).toBeInTheDocument(); // pool tier
      expect(screen.getByText(/45 entries/)).toBeInTheDocument();
      expect(screen.getByText(/10 tickets available/)).toBeInTheDocument();
    });
  });

  /* ---------- Unauthenticated user ---------- */

  describe('unauthenticated user', () => {
    it('shows sign-in prompt when not logged in', async () => {
      renderWithProviders(<EventDetailPage />, {
        routerProps: { initialEntries: ['/events/evt-1'] },
      });

      await screen.findByText('Summer Vibes Tour');

      expect(screen.getByText('Sign in')).toBeInTheDocument();
    });
  });

  /* ---------- Authenticated user ---------- */

  describe('authenticated user', () => {
    it('shows support section when logged in', async () => {
      localStorage.setItem('accessToken', 'mock-token');

      renderWithProviders(<EventDetailPage />, {
        routerProps: { initialEntries: ['/events/evt-1'] },
      });

      await screen.findByText('Summer Vibes Tour');

      expect(screen.getByText('SUPPORT THIS ARTIST')).toBeInTheDocument();
      expect(screen.getByLabelText('Tickets')).toBeInTheDocument();
      expect(screen.getByLabelText('Message (optional)')).toBeInTheDocument();
    });

    it('shows raffle enter button when logged in', async () => {
      localStorage.setItem('accessToken', 'mock-token');

      renderWithProviders(<EventDetailPage />, {
        routerProps: { initialEntries: ['/events/evt-1'] },
      });

      await screen.findByText('Summer Vibes Tour');

      expect(screen.getByText('ENTER RAFFLE')).toBeInTheDocument();
    });

    it('shows ticket purchase section', async () => {
      localStorage.setItem('accessToken', 'mock-token');

      renderWithProviders(<EventDetailPage />, {
        routerProps: { initialEntries: ['/events/evt-1'] },
      });

      await screen.findByText('Summer Vibes Tour');

      expect(screen.getByText('GET YOUR TICKET')).toBeInTheDocument();
      expect(screen.getByText('Buy Ticket')).toBeInTheDocument();
    });
  });

  /* ---------- WS integration ---------- */

  describe('WebSocket integration', () => {
    it('subscribes to event-specific channel', () => {
      renderWithProviders(<EventDetailPage />, {
        routerProps: { initialEntries: ['/events/evt-1'] },
      });

      expect(mockUseWebSocket).toHaveBeenCalledWith(
        'event:evt-1',
        expect.any(Function),
      );
    });

    it('passes handleWSMessage callback that updates ticket counts', async () => {
      mockUseWebSocket.mockClear();

      renderWithProviders(<EventDetailPage />, {
        routerProps: { initialEntries: ['/events/evt-1'] },
      });

      await screen.findByText('Summer Vibes Tour');

      // Get the LAST onMessage callback for the event channel
      // (component may have rendered multiple times before data loaded)
      const allCalls = mockUseWebSocket.mock.calls;
      const wsCall = [...allCalls].reverse().find(
        (c: unknown[]) => c[0] === 'event:evt-1',
      );
      expect(wsCall).toBeDefined();
      const onMessage = wsCall![1] as ((msg: Record<string, unknown>) => void);
      expect(typeof onMessage).toBe('function');

      // Simulate a WS message updating ticket counts
      act(() => {
        onMessage({
          type: 'ticket:supported',
          eventId: 'evt-1',
          supportedTickets: 100,
          totalTickets: 200,
        });
      });

      // The progress bar label should update with new counts
      await waitFor(() => {
        const bar = screen.getByRole('progressbar');
        expect(bar).toHaveAttribute('aria-valuenow', '50'); // 100/200 = 50%
      });
    });
  });

  /* ---------- Error state ---------- */

  describe('error state', () => {
    it('shows error with retry on API failure', async () => {
      const { http, HttpResponse } = await import('msw');
      const { server } = await import('../test/mocks/server.js');

      server.use(
        http.get('/api/events/:id', () => {
          return HttpResponse.json({ error: 'Event not found' }, { status: 404 });
        }),
      );

      renderWithProviders(<EventDetailPage />, {
        routerProps: { initialEntries: ['/events/evt-1'] },
      });

      const errorMsg = await screen.findByText('Event not found');
      expect(errorMsg).toBeInTheDocument();
    });
  });
});
