/* ------------------------------------------------------------------
   EventsPage honors ?page= on first load, matching the page of events
   server.cjs renders for crawlers (and its self-referencing canonical).
   ------------------------------------------------------------------ */

import { describe, it, expect, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server.js';
import { renderWithProviders } from '../test/utils.js';
import EventsPage from './EventsPage.js';

vi.mock('../hooks/useWebSocket.js', () => ({
  useWebSocket: () => ({ connectionState: 'connected' }),
  usePollingFallback: () => undefined,
}));

describe('EventsPage pagination from the URL', () => {
  it('loads the page named in ?page= on first render', async () => {
    const requestedPages: string[] = [];
    server.use(
      http.get('*/events', ({ request }) => {
        requestedPages.push(new URL(request.url).searchParams.get('page') ?? '1');
        return HttpResponse.json({ data: [], total: 60, page: 2, limit: 20, totalPages: 3 });
      }),
    );

    renderWithProviders(<EventsPage />, { routerProps: { initialEntries: ['/events?page=2'] } });

    await waitFor(() => expect(requestedPages.length).toBeGreaterThan(0));
    expect(requestedPages[0]).toBe('2');
    expect(requestedPages).not.toContain('1');
  });
});
