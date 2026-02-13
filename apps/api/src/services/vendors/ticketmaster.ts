/**
 * Ticketmaster Integration
 *
 * Uses the Ticketmaster Discovery API v2 for event search and details.
 * https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 *
 * API Key: Set TICKETMASTER_API_KEY env var (free at developer.ticketmaster.com).
 *
 * Purchase flow:
 *   - Discovery API provides the direct purchase URL (event.url)
 *   - Ticketmaster does NOT have a public Commerce/Purchase API
 *   - Automated purchasing uses Puppeteer + Stripe Issuing virtual card
 *     on the ticketmaster.com checkout page
 *   - The PurchaseAgentService handles the browser automation fallback
 *
 * Rate limits: 5,000 requests/day (free tier), 5 req/sec burst.
 */

import type {
  VendorAdapter,
  VendorEvent,
  VendorSearchParams,
  VendorSearchResult,
  VendorTicketClass,
} from './types.js';

const TM_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

interface TmImage {
  url: string;
  width: number;
  height: number;
  ratio?: string;
}

interface TmPriceRange {
  type: string;
  currency: string;
  min: number;
  max: number;
}

interface TmVenue {
  name?: string;
  address?: { line1?: string };
  city?: { name?: string };
  state?: { stateCode?: string; name?: string };
  country?: { countryCode?: string; name?: string };
  location?: { longitude?: string; latitude?: string };
  postalCode?: string;
}

interface TmAttraction {
  name?: string;
  classifications?: Array<{ genre?: { name?: string } }>;
}

interface TmEvent {
  id: string;
  name: string;
  url: string;
  dates?: {
    start?: { localDate?: string; localTime?: string; dateTime?: string };
    status?: { code?: string };
  };
  priceRanges?: TmPriceRange[];
  images?: TmImage[];
  _embedded?: {
    venues?: TmVenue[];
    attractions?: TmAttraction[];
  };
  classifications?: Array<{
    genre?: { name?: string };
    segment?: { name?: string };
  }>;
  sales?: {
    public?: { startDateTime?: string; endDateTime?: string };
  };
}

interface TmSearchResponse {
  _embedded?: { events?: TmEvent[] };
  page?: { size: number; totalElements: number; totalPages: number; number: number };
}

export class TicketmasterAdapter implements VendorAdapter {
  name = 'ticketmaster' as const;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TICKETMASTER_API_KEY || '';
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Search for events on Ticketmaster.
   *
   * Maps our generic search params to Ticketmaster Discovery API params:
   *   keyword → keyword
   *   city → city
   *   stateCode → stateCode
   *   lat/lng/radiusMiles → latlong + radius
   *   startDate/endDate → startDateTime/endDateTime
   *   genre → classificationName
   *   page → page (0-indexed in TM API)
   *   limit → size
   */
  async searchEvents(params: VendorSearchParams): Promise<VendorSearchResult> {
    if (!this.apiKey) {
      return { events: [], total: 0, page: 1, totalPages: 0 };
    }

    const qs = new URLSearchParams();
    qs.set('apikey', this.apiKey);
    qs.set('size', String(params.limit || 20));
    qs.set('page', String((params.page || 1) - 1)); // TM is 0-indexed
    qs.set('sort', 'date,asc');

    // Only return music events
    qs.set('classificationName', params.genre || 'music');

    if (params.keyword) qs.set('keyword', params.keyword);
    if (params.city) qs.set('city', params.city);
    if (params.stateCode) qs.set('stateCode', params.stateCode);

    if (params.lat != null && params.lng != null) {
      qs.set('latlong', `${params.lat},${params.lng}`);
      qs.set('radius', String(params.radiusMiles || 50));
      qs.set('unit', 'miles');
    }

    if (params.startDate) {
      qs.set('startDateTime', new Date(params.startDate).toISOString().replace('.000Z', 'Z'));
    }
    if (params.endDate) {
      qs.set('endDateTime', new Date(params.endDate).toISOString().replace('.000Z', 'Z'));
    }

    const res = await fetch(`${TM_BASE_URL}/events.json?${qs.toString()}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ticketmaster API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as TmSearchResponse;
    const tmEvents = data._embedded?.events ?? [];
    const page = data.page;

    return {
      events: tmEvents.map((e) => this.mapEvent(e)),
      total: page?.totalElements ?? tmEvents.length,
      page: (page?.number ?? 0) + 1, // Convert back to 1-indexed
      totalPages: page?.totalPages ?? 1,
    };
  }

  /**
   * Get details for a single Ticketmaster event by its ID.
   */
  async getEventDetails(tmEventId: string): Promise<VendorEvent | null> {
    if (!this.apiKey) return null;

    const res = await fetch(
      `${TM_BASE_URL}/events/${encodeURIComponent(tmEventId)}.json?apikey=${this.apiKey}`,
    );
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Ticketmaster event detail error ${res.status}`);
    }

    const data = (await res.json()) as TmEvent;
    return this.mapEvent(data);
  }

  /**
   * Get ticket price ranges for a Ticketmaster event.
   *
   * Note: Ticketmaster Discovery API only returns price ranges, not
   * individual ticket classes. For exact availability and pricing,
   * the Commerce API is required (partner access only).
   */
  async getTicketClasses(tmEventId: string): Promise<VendorTicketClass[]> {
    const event = await this.getEventDetails(tmEventId);
    if (!event || !event.raw) return [];

    const raw = event.raw as TmEvent;
    const ranges = raw.priceRanges ?? [];

    return ranges.map((r, i) => ({
      id: `tm-price-range-${i}`,
      name: r.type === 'standard' ? 'General Admission' : r.type,
      priceCents: Math.round(r.min * 100),
      feeCents: 0, // Fees included in TM prices but not broken out in Discovery API
      currency: r.currency?.toLowerCase() || 'usd',
      available: true,
      quantityAvailable: undefined, // Not available via Discovery API
    }));
  }

  /**
   * Suggest events from Ticketmaster using the keyword suggest endpoint.
   * Faster and lighter than full search — good for autocomplete.
   */
  async suggestEvents(keyword: string): Promise<VendorEvent[]> {
    if (!this.apiKey || !keyword) return [];

    const qs = new URLSearchParams({
      apikey: this.apiKey,
      keyword,
      size: '5',
    });

    const res = await fetch(`${TM_BASE_URL}/suggest.json?${qs.toString()}`);
    if (!res.ok) return [];

    const data = (await res.json()) as TmSearchResponse;
    const events = data._embedded?.events ?? [];
    return events.map((e) => this.mapEvent(e));
  }

  /**
   * Search Ticketmaster venues by keyword or location.
   */
  async searchVenues(params: {
    keyword?: string;
    city?: string;
    stateCode?: string;
    lat?: number;
    lng?: number;
    limit?: number;
  }): Promise<Array<{ id: string; name: string; city: string; state: string; address: string }>> {
    if (!this.apiKey) return [];

    const qs = new URLSearchParams({
      apikey: this.apiKey,
      size: String(params.limit || 10),
    });

    if (params.keyword) qs.set('keyword', params.keyword);
    if (params.city) qs.set('city', params.city);
    if (params.stateCode) qs.set('stateCode', params.stateCode);
    if (params.lat != null && params.lng != null) {
      qs.set('latlong', `${params.lat},${params.lng}`);
    }

    const res = await fetch(`${TM_BASE_URL}/venues.json?${qs.toString()}`);
    if (!res.ok) return [];

    const data = (await res.json()) as { _embedded?: { venues?: Array<TmVenue & { id: string }> } };
    const venues = data._embedded?.venues ?? [];
    return venues.map((v) => ({
      id: v.id,
      name: v.name ?? '',
      city: v.city?.name ?? '',
      state: v.state?.stateCode ?? '',
      address: v.address?.line1 ?? '',
    }));
  }

  /**
   * Map a Ticketmaster API event to our normalized VendorEvent format.
   */
  private mapEvent(e: TmEvent): VendorEvent {
    const venue = e._embedded?.venues?.[0];
    const attraction = e._embedded?.attractions?.[0];
    const priceRange = e.priceRanges?.[0];
    const bestImage = this.pickBestImage(e.images);

    const dateStr = e.dates?.start?.dateTime
      ?? (e.dates?.start?.localDate ? `${e.dates.start.localDate}T${e.dates.start.localTime || '20:00:00'}Z` : null);

    const statusCode = e.dates?.status?.code?.toLowerCase();
    let status: VendorEvent['status'] = 'on_sale';
    if (statusCode === 'cancelled') status = 'cancelled';
    else if (statusCode === 'postponed') status = 'postponed';
    else if (statusCode === 'rescheduled') status = 'rescheduled';
    else if (statusCode === 'offsale') status = 'off_sale';

    const genre = e.classifications?.[0]?.genre?.name
      ?? attraction?.classifications?.[0]?.genre?.name;

    return {
      vendorId: e.id,
      vendor: 'ticketmaster',
      title: e.name,
      artistName: attraction?.name ?? e.name,
      venueName: venue?.name ?? '',
      venueAddress: venue?.address?.line1 ?? '',
      venueCity: venue?.city?.name ?? '',
      venueState: venue?.state?.stateCode,
      venueCountry: venue?.country?.countryCode ?? 'US',
      venueLat: venue?.location?.latitude ? parseFloat(venue.location.latitude) : undefined,
      venueLng: venue?.location?.longitude ? parseFloat(venue.location.longitude) : undefined,
      date: dateStr ? new Date(dateStr) : new Date(),
      purchaseUrl: e.url,
      minPriceCents: priceRange ? Math.round(priceRange.min * 100) : undefined,
      maxPriceCents: priceRange ? Math.round(priceRange.max * 100) : undefined,
      currency: priceRange?.currency?.toLowerCase() || 'usd',
      genre: genre && genre !== 'Undefined' ? genre : undefined,
      imageUrl: bestImage,
      onSaleDate: e.sales?.public?.startDateTime
        ? new Date(e.sales.public.startDateTime)
        : undefined,
      status,
      raw: e,
    };
  }

  /**
   * Pick the best image from Ticketmaster's image array.
   * Prefers 16:9 ratio at ~1024px width.
   */
  private pickBestImage(images?: TmImage[]): string | undefined {
    if (!images?.length) return undefined;

    // Prefer 16_9 ratio at a good resolution
    const preferred = images.find(
      (i) => i.ratio === '16_9' && i.width >= 640 && i.width <= 1200,
    );
    if (preferred) return preferred.url;

    // Fall back to largest image
    return images.sort((a, b) => b.width - a.width)[0]?.url;
  }
}
