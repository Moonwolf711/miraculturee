/**
 * Eventbrite Integration
 *
 * Uses the Eventbrite API v3 for event search, details, and ticket classes.
 * https://www.eventbrite.com/platform/api
 *
 * API Key: Set EVENTBRITE_API_TOKEN env var (private OAuth token).
 *
 * Purchase flow:
 *   - Eventbrite has a full Orders API for programmatic purchases
 *   - The actual purchase logic lives in PurchaseAgentService.purchaseViaEventbrite()
 *   - This module handles search and event details only
 *
 * Note: The Eventbrite API has been partially deprecated. Some endpoints
 * require app approval. Event search via /events/search/ may return limited
 * results. The /destination/ endpoints are the newer alternative.
 */

import type {
  VendorAdapter,
  VendorEvent,
  VendorSearchParams,
  VendorSearchResult,
  VendorTicketClass,
} from './types.js';

const EB_BASE_URL = 'https://www.eventbriteapi.com/v3';

interface EbVenue {
  name?: string;
  address?: {
    address_1?: string;
    city?: string;
    region?: string;
    country?: string;
    latitude?: string;
    longitude?: string;
    postal_code?: string;
  };
}

interface EbEvent {
  id: string;
  name?: { text?: string; html?: string };
  description?: { text?: string };
  url?: string;
  start?: { utc?: string; local?: string };
  end?: { utc?: string };
  venue?: EbVenue;
  venue_id?: string;
  category?: { name?: string };
  subcategory?: { name?: string };
  logo?: { url?: string };
  status?: string;
  ticket_availability?: {
    minimum_ticket_price?: { major_value?: string; currency?: string };
    maximum_ticket_price?: { major_value?: string; currency?: string };
    has_available_tickets?: boolean;
  };
}

interface EbTicketClass {
  id: string;
  name: string;
  cost?: { value?: number; major_value?: string; currency?: string; display?: string };
  fee?: { value?: number; major_value?: string; currency?: string };
  on_sale_status?: string;
  quantity_total?: number;
  quantity_sold?: number;
  free?: boolean;
}

interface EbSearchResponse {
  events?: EbEvent[];
  pagination?: { object_count: number; page_number: number; page_count: number; page_size: number };
}

export class EventbriteAdapter implements VendorAdapter {
  name = 'eventbrite' as const;
  private token: string;

  constructor(token?: string) {
    this.token = token || process.env.EVENTBRITE_API_TOKEN || '';
  }

  isConfigured(): boolean {
    return this.token.length > 0;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Search for events on Eventbrite.
   *
   * Uses /events/search/ which requires keyword or location.
   * Note: This endpoint is legacy and may have limited results.
   */
  async searchEvents(params: VendorSearchParams): Promise<VendorSearchResult> {
    if (!this.token) {
      return { events: [], total: 0, page: 1, totalPages: 0 };
    }

    const qs = new URLSearchParams();
    if (params.keyword) qs.set('q', params.keyword);
    if (params.city) qs.set('location.address', params.city);
    if (params.lat != null && params.lng != null) {
      qs.set('location.latitude', String(params.lat));
      qs.set('location.longitude', String(params.lng));
      qs.set('location.within', `${params.radiusMiles || 50}mi`);
    }
    if (params.startDate) qs.set('start_date.range_start', new Date(params.startDate).toISOString().replace('.000Z', 'Z'));
    if (params.endDate) qs.set('start_date.range_end', new Date(params.endDate).toISOString().replace('.000Z', 'Z'));
    qs.set('page', String(params.page || 1));
    qs.set('expand', 'venue,ticket_availability');

    // Only music category (103)
    if (!params.genre) qs.set('categories', '103');

    const res = await fetch(`${EB_BASE_URL}/events/search/?${qs.toString()}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Eventbrite API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as EbSearchResponse;
    const ebEvents = data.events ?? [];
    const pagination = data.pagination;

    return {
      events: ebEvents.map((e) => this.mapEvent(e)),
      total: pagination?.object_count ?? ebEvents.length,
      page: pagination?.page_number ?? 1,
      totalPages: pagination?.page_count ?? 1,
    };
  }

  /**
   * Get details for a single Eventbrite event.
   */
  async getEventDetails(ebEventId: string): Promise<VendorEvent | null> {
    if (!this.token) return null;

    const res = await fetch(
      `${EB_BASE_URL}/events/${encodeURIComponent(ebEventId)}/?expand=venue,ticket_availability`,
      { headers: this.headers() },
    );

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Eventbrite event detail error ${res.status}`);
    }

    const data = (await res.json()) as EbEvent;
    return this.mapEvent(data);
  }

  /**
   * Get available ticket classes (types + pricing) for an Eventbrite event.
   * This is the key data needed for programmatic purchases.
   */
  async getTicketClasses(ebEventId: string): Promise<VendorTicketClass[]> {
    if (!this.token) return [];

    const res = await fetch(
      `${EB_BASE_URL}/events/${encodeURIComponent(ebEventId)}/ticket_classes/`,
      { headers: this.headers() },
    );

    if (!res.ok) return [];

    const data = (await res.json()) as { ticket_classes?: EbTicketClass[] };
    const classes = data.ticket_classes ?? [];

    return classes.map((tc) => {
      const priceCents = tc.cost?.value
        ? tc.cost.value
        : tc.cost?.major_value
          ? Math.round(parseFloat(tc.cost.major_value) * 100)
          : 0;

      const feeCents = tc.fee?.value
        ? tc.fee.value
        : tc.fee?.major_value
          ? Math.round(parseFloat(tc.fee.major_value) * 100)
          : 0;

      return {
        id: tc.id,
        name: tc.name,
        priceCents,
        feeCents,
        currency: tc.cost?.currency?.toLowerCase() || 'usd',
        available: tc.on_sale_status === 'AVAILABLE' && !tc.free,
        quantityAvailable: tc.quantity_total != null && tc.quantity_sold != null
          ? tc.quantity_total - tc.quantity_sold
          : undefined,
      };
    });
  }

  /**
   * Extract Eventbrite event ID from a URL.
   * Handles formats:
   *   - eventbrite.com/e/event-name-123456789
   *   - eventbrite.com/e/123456789
   */
  static extractEventId(url: string): string | null {
    const match = url.match(/eventbrite\.com\/e\/(?:[^-]+-)*?(\d{9,})/);
    if (match) return match[1];
    const simple = url.match(/eventbrite\.com\/e\/(\d+)/);
    return simple ? simple[1] : null;
  }

  /**
   * Map Eventbrite event to our normalized format.
   */
  private mapEvent(e: EbEvent): VendorEvent {
    const venue = e.venue;
    const addr = venue?.address;
    const ta = e.ticket_availability;

    const minPrice = ta?.minimum_ticket_price?.major_value
      ? Math.round(parseFloat(ta.minimum_ticket_price.major_value) * 100)
      : undefined;
    const maxPrice = ta?.maximum_ticket_price?.major_value
      ? Math.round(parseFloat(ta.maximum_ticket_price.major_value) * 100)
      : undefined;

    let status: VendorEvent['status'] = 'on_sale';
    if (e.status === 'canceled' || e.status === 'cancelled') status = 'cancelled';
    else if (e.status === 'ended' || e.status === 'completed') status = 'off_sale';
    else if (ta?.has_available_tickets === false) status = 'off_sale';

    return {
      vendorId: e.id,
      vendor: 'eventbrite',
      title: e.name?.text ?? '',
      artistName: e.name?.text ?? '', // Eventbrite doesn't separate artist from event name
      venueName: venue?.name ?? '',
      venueAddress: addr?.address_1 ?? '',
      venueCity: addr?.city ?? '',
      venueState: addr?.region,
      venueCountry: addr?.country ?? 'US',
      venueLat: addr?.latitude ? parseFloat(addr.latitude) : undefined,
      venueLng: addr?.longitude ? parseFloat(addr.longitude) : undefined,
      date: e.start?.utc ? new Date(e.start.utc) : new Date(),
      purchaseUrl: e.url ?? `https://www.eventbrite.com/e/${e.id}`,
      minPriceCents: minPrice,
      maxPriceCents: maxPrice,
      currency: ta?.minimum_ticket_price?.currency?.toLowerCase() || 'usd',
      genre: e.category?.name,
      imageUrl: e.logo?.url,
      status,
      raw: e,
    };
  }
}
