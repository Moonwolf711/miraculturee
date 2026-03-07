/**
 * Price Resolver
 *
 * Cross-references events (especially EDMTrain, which has no pricing)
 * with Ticketmaster Discovery API to find real ticket prices.
 */

import type { FastifyBaseLogger } from 'fastify';
import type { NormalizedEvent } from './normalizer.js';

const TM_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

interface ResolvedPrice {
  minPriceCents: number | null;
  maxPriceCents: number | null;
  priceSource: string;
  feesIncluded: boolean;
}

export class PriceResolver {
  private apiKey: string;
  private log: FastifyBaseLogger;

  constructor(log: FastifyBaseLogger) {
    this.apiKey = process.env.TICKETMASTER_API_KEY || '';
    this.log = log;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Resolve pricing for an event that has no price data.
   * Searches Ticketmaster by artist + city + date to find a match.
   */
  async resolvePrice(event: NormalizedEvent): Promise<ResolvedPrice> {
    // Already has pricing — keep it
    if (event.minPriceCents != null) {
      return {
        minPriceCents: event.minPriceCents,
        maxPriceCents: event.maxPriceCents,
        priceSource: event.source,
        feesIncluded: false,
      };
    }

    if (!this.apiKey) {
      return { minPriceCents: null, maxPriceCents: null, priceSource: 'none', feesIncluded: false };
    }

    try {
      const match = await this.searchTicketmaster(event);
      if (match) {
        this.log.info(
          { artist: event.artistName, city: event.venueCity, min: match.min, max: match.max },
          'Cross-referenced price from Ticketmaster',
        );
        return {
          minPriceCents: Math.round(match.min * 100),
          maxPriceCents: Math.round(match.max * 100),
          priceSource: 'ticketmaster_crossref',
          feesIncluded: false, // TM Discovery API prices are face value
        };
      }
    } catch (err) {
      this.log.warn({ err, artist: event.artistName }, 'Ticketmaster cross-reference failed');
    }

    return { minPriceCents: null, maxPriceCents: null, priceSource: 'none', feesIncluded: false };
  }

  /**
   * Batch resolve prices with rate limiting (200ms between requests).
   */
  async resolveBatch(events: NormalizedEvent[]): Promise<Map<string, ResolvedPrice>> {
    const results = new Map<string, ResolvedPrice>();

    for (const event of events) {
      if (event.minPriceCents != null) {
        results.set(event.externalId, {
          minPriceCents: event.minPriceCents,
          maxPriceCents: event.maxPriceCents,
          priceSource: event.source,
          feesIncluded: false,
        });
        continue;
      }

      const resolved = await this.resolvePrice(event);
      results.set(event.externalId, resolved);

      // Rate limit: 5 req/sec max for TM free tier
      if (resolved.priceSource !== 'none' || this.apiKey) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    return results;
  }

  private async searchTicketmaster(
    event: NormalizedEvent,
  ): Promise<{ min: number; max: number } | null> {
    // Build a date window: event date +/- 1 day
    const eventDate = new Date(event.eventDate);
    const dayBefore = new Date(eventDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayAfter = new Date(eventDate);
    dayAfter.setDate(dayAfter.getDate() + 1);

    // Use first artist name (EDMTrain may list "Artist1, Artist2")
    const keyword = event.artistName.split(',')[0].trim();

    const params = new URLSearchParams({
      apikey: this.apiKey,
      keyword,
      size: '5',
      classificationName: 'music',
      startDateTime: this.formatDateTime(dayBefore),
      endDateTime: this.formatDateTime(dayAfter),
    });

    if (event.venueCity && event.venueCity !== 'TBD') {
      params.set('city', event.venueCity);
    }

    const url = `${TM_BASE_URL}/events.json?${params}`;
    const res = await fetch(url);

    if (!res.ok) {
      this.log.warn({ status: res.status }, 'Ticketmaster search failed');
      return null;
    }

    const data = (await res.json()) as {
      _embedded?: {
        events?: Array<{
          name: string;
          priceRanges?: Array<{ min: number; max: number }>;
          _embedded?: {
            venues?: Array<{ name?: string }>;
            attractions?: Array<{ name?: string }>;
          };
        }>;
      };
    };

    const tmEvents = data._embedded?.events ?? [];
    if (tmEvents.length === 0) return null;

    // Find best match by artist name + venue name
    for (const tmEvent of tmEvents) {
      const tmArtist = tmEvent._embedded?.attractions?.[0]?.name ?? tmEvent.name;
      const tmVenue = tmEvent._embedded?.venues?.[0]?.name ?? '';

      const artistMatch = this.fuzzyMatch(keyword, tmArtist);
      const venueMatch =
        !event.venueName ||
        event.venueName === 'TBD' ||
        this.fuzzyMatch(event.venueName, tmVenue);

      if (artistMatch && venueMatch && tmEvent.priceRanges?.length) {
        const range = tmEvent.priceRanges[0];
        return { min: range.min, max: range.max };
      }
    }

    // Fallback: if only one result with prices, use it
    if (tmEvents.length === 1 && tmEvents[0].priceRanges?.length) {
      const range = tmEvents[0].priceRanges[0];
      return { min: range.min, max: range.max };
    }

    return null;
  }

  private fuzzyMatch(a: string, b: string): boolean {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/\b(the|and|&|at|in|of|live)\b/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();

    const na = normalize(a);
    const nb = normalize(b);

    return na.includes(nb) || nb.includes(na) || na === nb;
  }

  private formatDateTime(date: Date): string {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
}
