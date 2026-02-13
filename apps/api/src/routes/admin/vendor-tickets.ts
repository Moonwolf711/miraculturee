/**
 * Vendor Ticket Routes (Admin)
 *
 * Provides admin endpoints to:
 *   1. Search events across Ticketmaster and Eventbrite
 *   2. Get event details and ticket pricing from vendors
 *   3. Import vendor events into MiraCulture
 *   4. Trigger automated ticket purchases
 *   5. Check vendor API configuration status
 *
 * All routes require authentication. Most require ADMIN role.
 */

import type { FastifyInstance } from 'fastify';
import { TicketmasterAdapter } from '../../services/vendors/ticketmaster.js';
import { EventbriteAdapter } from '../../services/vendors/eventbrite.js';
import type { VendorSearchParams, VendorEvent } from '../../services/vendors/types.js';

export default async function vendorTicketRoutes(app: FastifyInstance) {
  const tm = new TicketmasterAdapter();
  const eb = new EventbriteAdapter();

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. VENDOR STATUS — Check which vendor APIs are configured
  //
  // GET /admin/vendors/status
  // ═══════════════════════════════════════════════════════════════════════════
  app.get('/status', async (_req, reply) => {
    return reply.send({
      ticketmaster: {
        configured: tm.isConfigured(),
        envVar: 'TICKETMASTER_API_KEY',
        signupUrl: 'https://developer.ticketmaster.com/',
        capabilities: ['search', 'event_details', 'pricing', 'purchase_url'],
        purchaseMethod: 'browser_automation',
      },
      eventbrite: {
        configured: eb.isConfigured(),
        envVar: 'EVENTBRITE_API_TOKEN',
        signupUrl: 'https://www.eventbrite.com/platform/',
        capabilities: ['search', 'event_details', 'ticket_classes', 'api_purchase'],
        purchaseMethod: 'api_direct',
      },
      stripeIssuing: {
        configured: !!process.env.STRIPE_ISSUING_CARDHOLDER_ID,
        envVar: 'STRIPE_ISSUING_CARDHOLDER_ID',
        note: 'Required for automated purchases. Must be in live mode for real transactions.',
        liveMode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ?? false,
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SEARCH ACROSS VENDORS — Unified event search
  //
  // Searches Ticketmaster and Eventbrite in parallel, merges results.
  //
  // GET /admin/vendors/search?keyword=...&city=...&vendor=ticketmaster
  // ═══════════════════════════════════════════════════════════════════════════
  app.get('/search', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const vendor = query.vendor; // 'ticketmaster', 'eventbrite', or undefined (both)

    const params: VendorSearchParams = {
      keyword: query.keyword || query.q,
      city: query.city,
      stateCode: query.state,
      lat: query.lat ? parseFloat(query.lat) : undefined,
      lng: query.lng ? parseFloat(query.lng) : undefined,
      radiusMiles: query.radius ? parseFloat(query.radius) : undefined,
      startDate: query.dateFrom,
      endDate: query.dateTo,
      genre: query.genre,
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
    };

    const results: { vendor: string; events: VendorEvent[]; total: number; error?: string }[] = [];

    // Search vendors in parallel
    const searches: Promise<void>[] = [];

    if (!vendor || vendor === 'ticketmaster') {
      searches.push(
        tm.searchEvents(params)
          .then((r) => { results.push({ vendor: 'ticketmaster', events: r.events, total: r.total }); })
          .catch((err) => { results.push({ vendor: 'ticketmaster', events: [], total: 0, error: err.message }); }),
      );
    }

    if (!vendor || vendor === 'eventbrite') {
      searches.push(
        eb.searchEvents(params)
          .then((r) => { results.push({ vendor: 'eventbrite', events: r.events, total: r.total }); })
          .catch((err) => { results.push({ vendor: 'eventbrite', events: [], total: 0, error: err.message }); }),
      );
    }

    await Promise.all(searches);

    // Merge and sort by date
    const allEvents = results.flatMap((r) => r.events);
    allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    return reply.send({
      events: allEvents.map(formatVendorEvent),
      vendors: results.map((r) => ({
        vendor: r.vendor,
        count: r.events.length,
        total: r.total,
        error: r.error,
      })),
      totalEvents: allEvents.length,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. TICKETMASTER EVENT DETAILS
  //
  // GET /admin/vendors/ticketmaster/:eventId
  // ═══════════════════════════════════════════════════════════════════════════
  app.get('/ticketmaster/:eventId', async (req, reply) => {
    const { eventId } = req.params as { eventId: string };

    const [event, tickets] = await Promise.all([
      tm.getEventDetails(eventId),
      tm.getTicketClasses(eventId),
    ]);

    if (!event) return reply.code(404).send({ error: 'Event not found on Ticketmaster' });

    return reply.send({
      event: formatVendorEvent(event),
      ticketClasses: tickets,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. EVENTBRITE EVENT DETAILS
  //
  // GET /admin/vendors/eventbrite/:eventId
  // ═══════════════════════════════════════════════════════════════════════════
  app.get('/eventbrite/:eventId', async (req, reply) => {
    const { eventId } = req.params as { eventId: string };

    const [event, tickets] = await Promise.all([
      eb.getEventDetails(eventId),
      eb.getTicketClasses(eventId),
    ]);

    if (!event) return reply.code(404).send({ error: 'Event not found on Eventbrite' });

    return reply.send({
      event: formatVendorEvent(event),
      ticketClasses: tickets,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. IMPORT VENDOR EVENT INTO MIRACULTURE
  //
  // Takes a vendor event and creates it in our database as a MiraCulture event.
  // Links it via the ExternalEvent table for tracking.
  //
  // POST /admin/vendors/import
  // Body: { vendor: 'ticketmaster' | 'eventbrite', vendorEventId: string }
  // ═══════════════════════════════════════════════════════════════════════════
  app.post('/import', async (req, reply) => {
    const { vendor, vendorEventId } = req.body as {
      vendor: 'ticketmaster' | 'eventbrite';
      vendorEventId: string;
    };

    if (!vendor || !vendorEventId) {
      return reply.code(400).send({ error: 'vendor and vendorEventId are required' });
    }

    // Fetch event details from the vendor
    const adapter = vendor === 'ticketmaster' ? tm : eb;
    const vendorEvent = await adapter.getEventDetails(vendorEventId);
    if (!vendorEvent) {
      return reply.code(404).send({ error: `Event ${vendorEventId} not found on ${vendor}` });
    }

    // Check if already imported
    const existing = await app.prisma.externalEvent.findUnique({
      where: { externalId_source: { externalId: vendorEventId, source: vendor } },
    });
    if (existing?.importedEventId) {
      return reply.code(409).send({
        error: 'Event already imported',
        eventId: existing.importedEventId,
      });
    }

    // Find or create artist
    let artist = await app.prisma.artist.findFirst({
      where: { stageName: vendorEvent.artistName },
    });
    if (!artist) {
      const slug = vendorEvent.artistName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'unknown';
      const user = await app.prisma.user.create({
        data: {
          email: `${slug}-${Date.now()}@${vendor}.miraculture.com`,
          passwordHash: `${vendor}-managed`,
          name: vendorEvent.artistName,
          role: 'ARTIST',
        },
      });
      artist = await app.prisma.artist.create({
        data: {
          userId: user.id,
          stageName: vendorEvent.artistName,
          genre: vendorEvent.genre || 'Music',
        },
      });
    }

    // Create the MiraCulture event
    const ticketPriceCents = vendorEvent.minPriceCents || 5000;
    const event = await app.prisma.event.create({
      data: {
        artistId: artist.id,
        title: vendorEvent.title,
        venueName: vendorEvent.venueName,
        venueAddress: vendorEvent.venueAddress,
        venueLat: vendorEvent.venueLat ?? 0,
        venueLng: vendorEvent.venueLng ?? 0,
        venueCity: vendorEvent.venueCity,
        date: vendorEvent.date,
        ticketPriceCents,
        totalTickets: 200,
        type: 'SHOW',
        status: 'PUBLISHED',
      },
    });

    // Create raffle pool
    const drawTime = new Date(vendorEvent.date);
    drawTime.setDate(drawTime.getDate() - 1);
    await app.prisma.rafflePool.create({
      data: { eventId: event.id, tierCents: 500, scheduledDrawTime: drawTime },
    });

    // Upsert external event record
    await app.prisma.externalEvent.upsert({
      where: { externalId_source: { externalId: vendorEventId, source: vendor } },
      update: { importedEventId: event.id, status: 'IMPORTED' },
      create: {
        externalId: vendorEventId,
        source: vendor,
        sourceUrl: vendorEvent.purchaseUrl,
        title: vendorEvent.title,
        artistName: vendorEvent.artistName,
        venueName: vendorEvent.venueName,
        venueAddress: vendorEvent.venueAddress,
        venueCity: vendorEvent.venueCity,
        venueState: vendorEvent.venueState,
        venueCountry: vendorEvent.venueCountry,
        venueLat: vendorEvent.venueLat,
        venueLng: vendorEvent.venueLng,
        eventDate: vendorEvent.date,
        minPriceCents: vendorEvent.minPriceCents,
        maxPriceCents: vendorEvent.maxPriceCents,
        currency: vendorEvent.currency.toUpperCase(),
        genre: vendorEvent.genre,
        status: 'IMPORTED',
        importedEventId: event.id,
        rawData: vendorEvent.raw ?? {},
      },
    });

    return reply.code(201).send({
      success: true,
      eventId: event.id,
      title: event.title,
      vendor,
      vendorEventId,
      purchaseUrl: vendorEvent.purchaseUrl,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. TICKETMASTER VENUE SEARCH
  //
  // GET /admin/vendors/ticketmaster-venues?keyword=...&city=...
  // ═══════════════════════════════════════════════════════════════════════════
  app.get('/ticketmaster-venues', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const venues = await tm.searchVenues({
      keyword: query.keyword,
      city: query.city,
      stateCode: query.state,
      limit: query.limit ? parseInt(query.limit) : 10,
    });
    return reply.send({ venues });
  });
}

/**
 * Format a VendorEvent for API response (strip raw data, serialize dates).
 */
function formatVendorEvent(e: VendorEvent) {
  return {
    vendorId: e.vendorId,
    vendor: e.vendor,
    title: e.title,
    artistName: e.artistName,
    venueName: e.venueName,
    venueAddress: e.venueAddress,
    venueCity: e.venueCity,
    venueState: e.venueState,
    date: e.date.toISOString(),
    purchaseUrl: e.purchaseUrl,
    minPriceCents: e.minPriceCents,
    maxPriceCents: e.maxPriceCents,
    currency: e.currency,
    genre: e.genre,
    imageUrl: e.imageUrl,
    status: e.status,
  };
}
