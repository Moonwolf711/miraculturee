/**
 * Event Normalizer
 * 
 * Converts platform-specific event data to a common format for storage
 */

import type { TicketmasterEvent } from './ticketmaster.client.js';
import type { EdmtrainEvent } from './edmtrain.client.js';

export interface NormalizedEvent {
  externalId: string;
  source: string;
  sourceUrl: string;
  
  title: string;
  description: string | null;
  artistName: string;
  
  venueName: string;
  venueAddress: string;
  venueCity: string;
  venueState: string | null;
  venueCountry: string;
  venueLat: number | null;
  venueLng: number | null;
  
  eventDate: Date;
  onSaleDate: Date | null;
  offSaleDate: Date | null;
  
  minPriceCents: number | null;
  maxPriceCents: number | null;
  currency: string;
  
  genre: string | null;
  category: string | null;
  
  rawData: any;
}

export class EventNormalizer {
  /**
   * Normalize Ticketmaster event to common format
   */
  static normalizeTicketmasterEvent(event: TicketmasterEvent): NormalizedEvent {
    const venue = event._embedded?.venues?.[0];
    const attraction = event._embedded?.attractions?.[0];
    const classification = event.classifications?.[0];
    const priceRange = event.priceRanges?.[0];

    // Parse event date/time
    let eventDate: Date;
    if (event.dates.start.dateTime) {
      eventDate = new Date(event.dates.start.dateTime);
    } else {
      // If no time, use local date at noon
      const dateStr = event.dates.start.localDate;
      const timeStr = event.dates.start.localTime || '12:00:00';
      eventDate = new Date(`${dateStr}T${timeStr}`);
    }

    // Parse on-sale dates
    const onSaleDate = event.sales?.public?.startDateTime
      ? new Date(event.sales.public.startDateTime)
      : null;
    const offSaleDate = event.sales?.public?.endDateTime
      ? new Date(event.sales.public.endDateTime)
      : null;

    // Extract pricing (convert dollars to cents)
    const minPriceCents = priceRange?.min ? Math.round(priceRange.min * 100) : null;
    const maxPriceCents = priceRange?.max ? Math.round(priceRange.max * 100) : null;

    // Extract artist name (use first attraction or event name)
    const artistName = attraction?.name || event.name;

    // Extract genre
    const genre = classification?.genre?.name || classification?.segment?.name || null;

    // Build venue address
    const venueAddress = venue?.address?.line1 || venue?.name || 'TBD';

    return {
      externalId: event.id,
      source: 'ticketmaster',
      sourceUrl: event.url,
      
      title: event.name,
      description: event.description || null,
      artistName,
      
      venueName: venue?.name || 'TBD',
      venueAddress,
      venueCity: venue?.city?.name || 'TBD',
      venueState: venue?.state?.stateCode || null,
      venueCountry: venue?.country?.countryCode || 'US',
      venueLat: venue?.location?.latitude ? parseFloat(venue.location.latitude) : null,
      venueLng: venue?.location?.longitude ? parseFloat(venue.location.longitude) : null,
      
      eventDate,
      onSaleDate,
      offSaleDate,
      
      minPriceCents,
      maxPriceCents,
      currency: priceRange?.currency || 'USD',
      
      genre,
      category: classification?.segment?.name || null,
      
      rawData: event,
    };
  }

  /**
   * Normalize EDMTrain event to common format
   */
  static normalizeEdmtrainEvent(event: EdmtrainEvent): NormalizedEvent {
    const artistName = event.artistList.length > 0
      ? event.artistList.map((a) => a.name).join(', ')
      : event.name || 'TBA';

    const title = event.name || artistName;

    // Parse location string like "Denver, CO"
    const locationParts = event.venue.location?.split(', ') || [];
    const city = locationParts[0] || 'TBD';
    const stateAbbr = locationParts[1] || event.venue.state || null;

    // Parse date — EDMTrain gives "YYYY-MM-DD" format
    let eventDate: Date;
    if (event.startTime) {
      eventDate = new Date(event.startTime);
    } else {
      eventDate = new Date(`${event.date}T20:00:00`);
    }

    const genre = event.electronicGenreInd ? 'Electronic' : event.otherGenreInd ? 'Other' : null;

    return {
      externalId: String(event.id),
      source: 'edmtrain',
      sourceUrl: event.link,

      title,
      description: null,
      artistName,

      venueName: event.venue.name || 'TBD',
      venueAddress: event.venue.address || event.venue.name || 'TBD',
      venueCity: city,
      venueState: stateAbbr,
      venueCountry: event.venue.country || 'United States',
      venueLat: event.venue.latitude,
      venueLng: event.venue.longitude,

      eventDate,
      onSaleDate: null,
      offSaleDate: null,

      minPriceCents: null,
      maxPriceCents: null,
      currency: 'USD',

      genre,
      category: event.festivalInd ? 'Festival' : 'Concert',

      rawData: event,
    };
  }

  /**
   * Validate normalized event has required fields
   */
  static isValid(event: NormalizedEvent): boolean {
    return !!(
      event.externalId &&
      event.source &&
      event.sourceUrl &&
      event.title &&
      event.artistName &&
      event.venueName &&
      event.venueCity &&
      event.eventDate
    );
  }
}
