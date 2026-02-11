/* ------------------------------------------------------------------
   MSW request handlers for API mocking in tests.
   ------------------------------------------------------------------ */

import { http, HttpResponse } from 'msw';

/* ============== Mock Data ============== */

export const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'FAN',
};

export const mockArtistUser = {
  id: 'artist-1',
  email: 'artist@example.com',
  name: 'Test Artist',
  role: 'ARTIST',
};

export const mockEvents = {
  data: [
    {
      id: 'evt-1',
      title: 'Summer Vibes Tour',
      artistName: 'DJ Sunshine',
      venueName: 'The Warehouse',
      venueCity: 'Austin',
      date: '2026-07-15T20:00:00Z',
      ticketPriceCents: 5000,
      totalTickets: 200,
      supportedTickets: 75,
    },
    {
      id: 'evt-2',
      title: 'Midnight Jazz',
      artistName: 'Smooth Quartet',
      venueName: 'Blue Note',
      venueCity: 'New York',
      date: '2026-08-20T21:00:00Z',
      ticketPriceCents: 7500,
      totalTickets: 150,
      supportedTickets: 120,
    },
  ],
  total: 2,
  page: 1,
  totalPages: 1,
};

export const mockEventDetail = {
  id: 'evt-1',
  title: 'Summer Vibes Tour',
  description: 'An incredible night of music under the stars.',
  artistName: 'DJ Sunshine',
  venueName: 'The Warehouse',
  venueAddress: '123 Music Lane',
  venueCity: 'Austin',
  venueLat: 30.2672,
  venueLng: -97.7431,
  date: '2026-07-15T20:00:00Z',
  ticketPriceCents: 5000,
  totalTickets: 200,
  supportedTickets: 75,
  localRadiusKm: 50,
  status: 'PUBLISHED',
  rafflePools: [
    {
      id: 'pool-1',
      tierCents: 500,
      status: 'OPEN',
      availableTickets: 10,
      totalEntries: 45,
      drawTime: '2026-07-14T18:00:00Z',
    },
  ],
};

export const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};

/* ============== Request Handlers ============== */

const BASE = '/api';

export const handlers = [
  /* Auth */
  http.get(`${BASE}/auth/me`, () => {
    const token = localStorage?.getItem('accessToken');
    if (!token) {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json(mockUser);
  }),

  http.post(`${BASE}/auth/login`, () => {
    return HttpResponse.json(mockTokens);
  }),

  http.post(`${BASE}/auth/register`, () => {
    return HttpResponse.json(mockTokens);
  }),

  http.post(`${BASE}/auth/refresh`, () => {
    return HttpResponse.json({
      accessToken: 'refreshed-access-token',
      refreshToken: 'refreshed-refresh-token',
    });
  }),

  /* Events */
  http.get(`${BASE}/events`, ({ request }) => {
    const url = new URL(request.url);
    const city = url.searchParams.get('city');
    if (city) {
      const filtered = mockEvents.data.filter((e) =>
        e.venueCity.toLowerCase().includes(city.toLowerCase()),
      );
      return HttpResponse.json({
        data: filtered,
        total: filtered.length,
        page: 1,
        totalPages: 1,
      });
    }
    return HttpResponse.json(mockEvents);
  }),

  http.get(`${BASE}/events/:id`, ({ params }) => {
    if (params.id === 'evt-1') {
      return HttpResponse.json(mockEventDetail);
    }
    return new HttpResponse(null, { status: 404 });
  }),

  /* Support purchase */
  http.post(`${BASE}/support/purchase`, () => {
    return HttpResponse.json({
      id: 'sp-1',
      eventId: 'evt-1',
      ticketCount: 1,
      totalAmountCents: 5000,
      clientSecret: 'pi_mock_secret',
    });
  }),

  /* Raffle entry */
  http.post(`${BASE}/raffle/enter`, () => {
    return HttpResponse.json({
      id: 're-1',
      poolId: 'pool-1',
      status: 'PENDING',
      clientSecret: 'pi_raffle_secret',
    });
  }),

  /* Ticket purchase */
  http.post(`${BASE}/tickets/purchase`, () => {
    return HttpResponse.json({
      id: 'tp-1',
      eventId: 'evt-1',
      priceCents: 5000,
      feeCents: 500,
      totalCents: 5500,
      clientSecret: 'pi_ticket_secret',
    });
  }),
];
