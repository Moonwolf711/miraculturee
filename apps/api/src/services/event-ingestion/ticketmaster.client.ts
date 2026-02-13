/**
 * Ticketmaster Discovery API Client
 * 
 * Fetches events from Ticketmaster Discovery API v2
 * Documentation: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 */

import type { FastifyBaseLogger } from 'fastify';

const TICKETMASTER_API_BASE = 'https://app.ticketmaster.com/discovery/v2';
const DEFAULT_PAGE_SIZE = 200; // Max per request
const MAX_PAGES = 5; // Limit to 1000 events per sync (200 * 5)

export interface TicketmasterConfig {
  apiKey: string;
  markets?: string[]; // e.g., ['denver', 'los-angeles']
  dmaIds?: string[]; // e.g., ['751', '803']
  countryCode?: string; // e.g., 'US'
  classificationName?: string; // e.g., 'music'
  daysAhead?: number; // How many days in the future to fetch
}

export interface TicketmasterEvent {
  id: string;
  name: string;
  description?: string;
  url: string;
  dates: {
    start: {
      localDate: string;
      localTime?: string;
      dateTime?: string;
    };
    status: {
      code: string;
    };
  };
  priceRanges?: Array<{
    type: string;
    currency: string;
    min: number;
    max: number;
  }>;
  sales?: {
    public?: {
      startDateTime?: string;
      endDateTime?: string;
    };
  };
  classifications?: Array<{
    primary: boolean;
    segment: { name: string };
    genre?: { name: string };
    subGenre?: { name: string };
  }>;
  _embedded?: {
    venues?: Array<{
      id: string;
      name: string;
      address?: {
        line1?: string;
      };
      city?: {
        name: string;
      };
      state?: {
        name: string;
        stateCode: string;
      };
      country?: {
        name: string;
        countryCode: string;
      };
      location?: {
        latitude: string;
        longitude: string;
      };
    }>;
    attractions?: Array<{
      id: string;
      name: string;
      classifications?: Array<{
        primary: boolean;
        segment: { name: string };
        genre?: { name: string };
      }>;
    }>;
  };
}

interface TicketmasterResponse {
  _embedded?: {
    events: TicketmasterEvent[];
  };
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

export class TicketmasterClient {
  private apiKey: string;
  private config: TicketmasterConfig;
  private log: FastifyBaseLogger;

  constructor(config: TicketmasterConfig, log: FastifyBaseLogger) {
    this.apiKey = config.apiKey;
    this.config = config;
    this.log = log;
  }

  /**
   * Fetch events from Ticketmaster API
   */
  async fetchEvents(): Promise<TicketmasterEvent[]> {
    const allEvents: TicketmasterEvent[] = [];
    let page = 0;

    this.log.info('Starting Ticketmaster event fetch');

    while (page < MAX_PAGES) {
      try {
        const events = await this.fetchPage(page);
        
        if (events.length === 0) {
          this.log.info(`No more events found at page ${page}`);
          break;
        }

        allEvents.push(...events);
        this.log.info(`Fetched ${events.length} events from page ${page} (total: ${allEvents.length})`);

        page++;

        // Rate limiting: 5 requests per second
        await this.sleep(200); // 200ms between requests = 5 req/sec
      } catch (error) {
        this.log.error({ error, page }, 'Error fetching Ticketmaster events page');
        break;
      }
    }

    this.log.info(`Ticketmaster fetch complete: ${allEvents.length} events`);
    return allEvents;
  }

  /**
   * Fetch a single page of events
   */
  private async fetchPage(page: number): Promise<TicketmasterEvent[]> {
    const params = this.buildQueryParams(page);
    const url = `${TICKETMASTER_API_BASE}/events.json?${params}`;

    this.log.debug({ url, page }, 'Fetching Ticketmaster page');

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ticketmaster API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as TicketmasterResponse;

    return data._embedded?.events || [];
  }

  /**
   * Build query parameters for API request
   */
  private buildQueryParams(page: number): string {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      size: DEFAULT_PAGE_SIZE.toString(),
      page: page.toString(),
      sort: 'date,asc',
    });

    // Country filter
    if (this.config.countryCode) {
      params.append('countryCode', this.config.countryCode);
    }

    // Market filter (e.g., Denver, Los Angeles)
    if (this.config.markets && this.config.markets.length > 0) {
      params.append('marketId', this.config.markets.join(','));
    }

    // DMA filter (Designated Market Area)
    if (this.config.dmaIds && this.config.dmaIds.length > 0) {
      params.append('dmaId', this.config.dmaIds.join(','));
    }

    // Classification filter (e.g., music)
    if (this.config.classificationName) {
      params.append('classificationName', this.config.classificationName);
    }

    // Date range: today to X days ahead
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + (this.config.daysAhead || 90));

    params.append('startDateTime', this.formatDateTime(today));
    params.append('endDateTime', this.formatDateTime(futureDate));

    return params.toString();
  }

  /**
   * Format date for Ticketmaster API (ISO 8601 format)
   */
  private formatDateTime(date: Date): string {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  /**
   * Sleep for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
