/**
 * Shared types for multi-vendor ticket acquisition.
 *
 * Each vendor (Ticketmaster, Eventbrite, AXS, etc.) implements the
 * VendorAdapter interface. The PurchaseAgentService routes acquisitions
 * to the correct adapter based on event source.
 */

export type VendorName = 'ticketmaster' | 'eventbrite' | 'axs' | 'dice' | 'venue_direct' | 'unknown';

export interface VendorEvent {
  vendorId: string;         // Vendor's own event ID
  vendor: VendorName;
  title: string;
  artistName: string;
  venueName: string;
  venueAddress: string;
  venueCity: string;
  venueState?: string;
  venueCountry: string;
  venueLat?: number;
  venueLng?: number;
  date: Date;
  purchaseUrl: string;      // Direct link to buy tickets
  minPriceCents?: number;
  maxPriceCents?: number;
  currency: string;
  genre?: string;
  imageUrl?: string;
  onSaleDate?: Date;
  status: 'on_sale' | 'off_sale' | 'cancelled' | 'postponed' | 'rescheduled';
  raw?: unknown;            // Original vendor response for debugging
}

export interface VendorTicketClass {
  id: string;
  name: string;
  priceCents: number;
  feeCents: number;
  currency: string;
  available: boolean;
  quantityAvailable?: number;
}

export interface VendorSearchParams {
  keyword?: string;
  city?: string;
  stateCode?: string;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  startDate?: string;       // ISO date
  endDate?: string;         // ISO date
  genre?: string;
  page?: number;
  limit?: number;
}

export interface VendorSearchResult {
  events: VendorEvent[];
  total: number;
  page: number;
  totalPages: number;
}

export interface VendorPurchaseResult {
  success: boolean;
  orderId?: string;
  confirmationRef?: string;
  error?: string;
  requiresManual?: boolean;
}

/**
 * Every vendor adapter must implement these methods.
 * searchEvents and getEventDetails are required.
 * purchaseTickets is optional — not all vendors have a purchase API.
 */
export interface VendorAdapter {
  name: VendorName;
  searchEvents(params: VendorSearchParams): Promise<VendorSearchResult>;
  getEventDetails(vendorEventId: string): Promise<VendorEvent | null>;
  getTicketClasses?(vendorEventId: string): Promise<VendorTicketClass[]>;
  purchaseTickets?(vendorEventId: string, ticketClassId: string, quantity: number, cardDetails: {
    number: string;
    expMonth: string;
    expYear: string;
    cvc: string;
  }): Promise<VendorPurchaseResult>;
}
