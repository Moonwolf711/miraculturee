import type { Role, EventStatus, RaffleStatus, PoolTicketStatus, TransactionType } from './constants.js';

export interface UserPayload {
  id: string;
  email: string;
  role: Role;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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
  status: EventStatus;
}

export interface EventDetail extends EventSummary {
  description: string | null;
  venueAddress: string;
  venueLat: number;
  venueLng: number;
  localRadiusKm: number;
  rafflePools: RafflePoolSummary[];
}

export interface RafflePoolSummary {
  id: string;
  tierCents: number;
  status: RaffleStatus;
  availableTickets: number;
  totalEntries: number;
  drawTime: string | null;
}

export interface SupportPurchaseResult {
  id: string;
  eventId: string;
  ticketCount: number;
  totalAmountCents: number;
  clientSecret: string;
}

export interface RaffleEntryResult {
  id: string;
  poolId: string;
  status: 'ENTERED';
  clientSecret: string;
}

export interface DrawResult {
  poolId: string;
  winners: { userId: string; ticketId: string }[];
  totalDrawn: number;
}

export interface ArtistDashboard {
  totalEvents: number;
  totalSupport: number;
  totalSupportAmountCents: number;
  totalRaffleEntries: number;
  upcomingEvents: EventSummary[];
}

export interface TransactionRecord {
  id: string;
  type: TransactionType;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
}
