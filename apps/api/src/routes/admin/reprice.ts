/**
 * Admin: Bulk reprice events using Ticketmaster Discovery API.
 *
 * Finds events with unknown/default/random pricing and cross-references
 * with Ticketmaster to get real face-value prices.
 */

import type { FastifyInstance } from 'fastify';

const TM_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

interface TmPriceRange {
  type: string;
  currency: string;
  min: number;
  max: number;
}

interface TmEvent {
  id: string;
  name: string;
  priceRanges?: TmPriceRange[];
  _embedded?: {
    venues?: Array<{ name?: string }>;
    attractions?: Array<{ name?: string }>;
  };
}

interface TmSearchResponse {
  _embedded?: { events?: TmEvent[] };
}

function fuzzyMatch(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(the|and|&|at|in|of|live|presents?)\b/g, '')
      .replace(/[^a-z0-9]/g, '');
  const na = normalize(a);
  const nb = normalize(b);
  return na.includes(nb) || nb.includes(na) || na === nb;
}

export default async function repriceRoutes(app: FastifyInstance) {
  /**
   * POST /admin/reprice
   *
   * Finds all events with suspect pricing and resolves via Ticketmaster.
   * Query params:
   *   dryRun=true  — preview changes without saving
   *   force=true   — reprice ALL events, not just unknown/default
   */
  app.post('/reprice', async (request, reply) => {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
      return reply.status(400).send({ error: 'TICKETMASTER_API_KEY not configured' });
    }

    const query = request.query as { dryRun?: string; force?: string };
    const dryRun = query.dryRun === 'true';
    const force = query.force === 'true';

    // Find events that need repricing
    const where = force
      ? { date: { gte: new Date() } } // All future events
      : {
          date: { gte: new Date() },
          OR: [
            { priceSource: 'unknown' },
            { priceSource: 'default' },
            { priceSource: 'manual', ticketPriceCents: { gt: 10000 } }, // Suspiciously high random prices
          ],
        };

    const events = await app.prisma.event.findMany({
      where,
      include: {
        artist: { select: { stageName: true, isPlaceholder: true } },
      },
      orderBy: { date: 'asc' },
    });

    app.log.info(`Found ${events.length} events to reprice`);

    const results: Array<{
      eventId: string;
      title: string;
      oldPrice: number;
      newMin: number | null;
      newMax: number | null;
      source: string;
      status: string;
    }> = [];

    let updated = 0;
    let notFound = 0;
    let alreadyCorrect = 0;
    let delayMs = 350;

    for (const event of events) {
      await new Promise((r) => setTimeout(r, delayMs));

      try {
        const artistName = event.artist.isPlaceholder
          ? event.title.split(' at ')[0].split(' @ ')[0].split(' - ')[0].trim()
          : event.artist.stageName;

        // Search TM by artist + city + date
        const eventDate = new Date(event.date);
        const dayBefore = new Date(eventDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        const dayAfter = new Date(eventDate);
        dayAfter.setDate(dayAfter.getDate() + 1);

        const params = new URLSearchParams({
          apikey: apiKey,
          keyword: artistName.split(',')[0].trim(),
          size: '5',
          classificationName: 'music',
          startDateTime: dayBefore.toISOString().replace(/\.\d{3}Z$/, 'Z'),
          endDateTime: dayAfter.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        });

        const city = event.venueCity.split(',')[0].trim();
        if (city) params.set('city', city);

        let res = await fetch(`${TM_BASE_URL}/events.json?${params}`);
        if (res.status === 429) {
          // Backoff and retry once
          delayMs = Math.min(delayMs * 2, 10000);
          app.log.warn({ delay: delayMs, event: event.title }, 'TM rate limited, backing off');
          await new Promise((r) => setTimeout(r, delayMs));
          res = await fetch(`${TM_BASE_URL}/events.json?${params}`);
        }
        if (!res.ok) {
          app.log.warn({ status: res.status, event: event.title }, 'TM search failed');
          results.push({
            eventId: event.id,
            title: event.title,
            oldPrice: event.ticketPriceCents,
            newMin: null,
            newMax: null,
            source: 'error',
            status: `TM API error ${res.status}`,
          });
          continue;
        }
        // Success — gradually recover delay
        delayMs = Math.max(350, delayMs * 0.9);

        const data = (await res.json()) as TmSearchResponse;
        const tmEvents = data._embedded?.events ?? [];

        // Find best match
        let matched: TmEvent | null = null;
        for (const tm of tmEvents) {
          const tmArtist = tm._embedded?.attractions?.[0]?.name ?? tm.name;
          const tmVenue = tm._embedded?.venues?.[0]?.name ?? '';

          if (fuzzyMatch(artistName.split(',')[0].trim(), tmArtist)) {
            if (!event.venueName || fuzzyMatch(event.venueName, tmVenue)) {
              matched = tm;
              break;
            }
          }
        }

        // Fallback: single result with prices
        if (!matched && tmEvents.length === 1 && tmEvents[0].priceRanges?.length) {
          matched = tmEvents[0];
        }

        if (!matched || !matched.priceRanges?.length) {
          notFound++;
          results.push({
            eventId: event.id,
            title: event.title,
            oldPrice: event.ticketPriceCents,
            newMin: null,
            newMax: null,
            source: 'not_found',
            status: `No TM match (${tmEvents.length} results)`,
          });
          continue;
        }

        const range = matched.priceRanges[0];
        const minCents = Math.round(range.min * 100);
        const maxCents = Math.round(range.max * 100);

        // Check if price actually changed
        if (event.ticketPriceCents === minCents && event.maxPriceCents === maxCents) {
          alreadyCorrect++;
          results.push({
            eventId: event.id,
            title: event.title,
            oldPrice: event.ticketPriceCents,
            newMin: minCents,
            newMax: maxCents,
            source: 'ticketmaster',
            status: 'already_correct',
          });
          continue;
        }

        if (!dryRun) {
          await app.prisma.event.update({
            where: { id: event.id },
            data: {
              ticketPriceCents: minCents,
              maxPriceCents: maxCents !== minCents ? maxCents : null,
              priceSource: 'ticketmaster',
              feesIncluded: false,
            },
          });
        }

        updated++;
        results.push({
          eventId: event.id,
          title: event.title,
          oldPrice: event.ticketPriceCents,
          newMin: minCents,
          newMax: maxCents,
          source: 'ticketmaster',
          status: dryRun ? 'would_update' : 'updated',
        });
      } catch (err) {
        app.log.error({ err, event: event.title }, 'Reprice error');
        results.push({
          eventId: event.id,
          title: event.title,
          oldPrice: event.ticketPriceCents,
          newMin: null,
          newMax: null,
          source: 'error',
          status: (err as Error).message,
        });
      }
    }

    return {
      dryRun,
      total: events.length,
      updated,
      notFound,
      alreadyCorrect,
      errors: results.filter((r) => r.source === 'error').length,
      results,
    };
  });

  /**
   * GET /admin/reprice/status
   *
   * Show how many events have each priceSource value.
   */
  app.get('/reprice/status', async () => {
    const counts = await app.prisma.$queryRaw<
      Array<{ priceSource: string; count: bigint }>
    >`SELECT "priceSource", COUNT(*) as count FROM "Event" GROUP BY "priceSource" ORDER BY count DESC`;

    const zeroPriceCount = await app.prisma.event.count({
      where: { ticketPriceCents: 0 },
    });

    const futureBadPrice = await app.prisma.event.count({
      where: {
        date: { gte: new Date() },
        OR: [
          { priceSource: 'unknown' },
          { priceSource: 'default' },
          { ticketPriceCents: 0 },
        ],
      },
    });

    return {
      priceSources: counts.map((c) => ({
        priceSource: c.priceSource,
        count: Number(c.count),
      })),
      zeroPriceEvents: zeroPriceCount,
      futureEventsNeedingReprice: futureBadPrice,
    };
  });
}
