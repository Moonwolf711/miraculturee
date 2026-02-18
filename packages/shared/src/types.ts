import type { Role, EventType, EventStatus, RaffleStatus, TransactionType, DirectTicketStatus } from './constants.js';

/** Decoded JWT payload for an authenticated user. */
export interface UserPayload {
  id: string;
  email: string;
  role: Role;
}

/** Access + refresh token pair returned on login/refresh. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Generic paginated API response wrapper. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Lightweight event data for list views. */
export interface EventSummary {
  id: string;
  title: string;
  artistName: string;
  venueName: string;
  venueCity: string;
  date: string;
  ticketPriceCents: number;
  totalTickets: number;
  supportedTickets: number;
  type: EventType;
  status: EventStatus;
  genre: string | null;
}

/** Full event data including venue coordinates and raffle pools. */
export interface EventDetail extends EventSummary {
  description: string | null;
  venueAddress: string;
  venueLat: number;
  venueLng: number;
  localRadiusKm: number;
  currentProcessingFeeCents: number;
  sourceUrl: string | null;
  rafflePools: RafflePoolSummary[];
  campaigns?: { id: string; headline: string; message: string }[];
  shareCount?: number;
}

/** Raffle pool data included in event detail responses. */
export interface RafflePoolSummary {
  id: string;
  tierCents: number;
  status: RaffleStatus;
  availableTickets: number;
  totalEntries: number;
  drawTime: string | null;
}

/** Result of a support ticket purchase, including the Stripe client secret. */
export interface SupportPurchaseResult {
  id: string;
  eventId: string;
  ticketCount: number;
  totalAmountCents: number;
  clientSecret: string;
}

/** Result of entering a raffle pool. */
export interface RaffleEntryResult {
  id: string;
  poolId: string;
  status: 'ENTERED';
  clientSecret: string;
}

/** Result of a raffle draw. */
export interface DrawResult {
  poolId: string;
  winners: { userId: string; ticketId: string }[];
  totalDrawn: number;
}

/** Aggregate data for the artist dashboard view. */
export interface ArtistDashboard {
  totalEvents: number;
  totalSupport: number;
  totalSupportAmountCents: number;
  totalRaffleEntries: number;
  upcomingEvents: EventSummary[];
}

/** Single financial transaction record. */
export interface TransactionRecord {
  id: string;
  type: TransactionType;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
}

/** Result of a direct ticket purchase including fee breakdown. */
export interface TicketPurchaseResult {
  id: string;
  eventId: string;
  priceCents: number;
  feeCents: number;
  platformFeeCents: number;
  totalCents: number;
  clientSecret: string;
}

/** Lightweight direct ticket data for list views. */
export interface DirectTicketSummary {
  id: string;
  eventId: string;
  status: DirectTicketStatus;
  priceCents: number;
  feeCents: number;
  createdAt: string;
}

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'ENDED';

export interface CampaignSummary {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  headline: string;
  message: string;
  status: CampaignStatus;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
}
