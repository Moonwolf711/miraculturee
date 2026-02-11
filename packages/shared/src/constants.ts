export const ROLES = {
  FAN: 'FAN',
  LOCAL_FAN: 'LOCAL_FAN',
  ARTIST: 'ARTIST',
  ADMIN: 'ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const EVENT_TYPE = {
  SHOW: 'SHOW',
  FESTIVAL: 'FESTIVAL',
} as const;

export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

export const EVENT_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  SOLD_OUT: 'SOLD_OUT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type EventStatus = (typeof EVENT_STATUS)[keyof typeof EVENT_STATUS];

export const RAFFLE_STATUS = {
  OPEN: 'OPEN',
  DRAWING: 'DRAWING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type RaffleStatus = (typeof RAFFLE_STATUS)[keyof typeof RAFFLE_STATUS];

export const RAFFLE_TIER = {
  FIVE: 500, // $5 in cents — MVP single tier
} as const;

export const POOL_TICKET_STATUS = {
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  REDEEMED: 'REDEEMED',
} as const;

export type PoolTicketStatus = (typeof POOL_TICKET_STATUS)[keyof typeof POOL_TICKET_STATUS];

export const TRANSACTION_TYPE = {
  SUPPORT_PURCHASE: 'SUPPORT_PURCHASE',
  RAFFLE_ENTRY: 'RAFFLE_ENTRY',
  TICKET_PURCHASE: 'TICKET_PURCHASE',
  ARTIST_PAYOUT: 'ARTIST_PAYOUT',
  REFUND: 'REFUND',
} as const;

export type TransactionType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

export const DIRECT_TICKET_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  TRANSFERRED: 'TRANSFERRED',
  REDEEMED: 'REDEEMED',
  REFUNDED: 'REFUNDED',
} as const;

export type DirectTicketStatus = (typeof DIRECT_TICKET_STATUS)[keyof typeof DIRECT_TICKET_STATUS];

export const PROCESSING_FEE_MIN_CENTS = 500;
export const PROCESSING_FEE_MAX_CENTS = 1000;
export const SUPPORT_FEE_PER_TICKET_CENTS = 500;
export const PLATFORM_FEE_PERCENT = 0.025;

export const DIRECT_SALES_CUTOFF_HOURS = 24;

export function isDirectSalesOpen(eventDate: Date | string): boolean {
  const cutoff = new Date(eventDate);
  cutoff.setHours(cutoff.getHours() - DIRECT_SALES_CUTOFF_HOURS);
  return new Date() < cutoff;
}

export const JWT_ACCESS_EXPIRY = '15m';
export const JWT_REFRESH_EXPIRY = '7d';
export const DEFAULT_LOCAL_RADIUS_KM = 50;
export const EARTH_RADIUS_KM = 6371;

/** EDMTrain sync runs every 6 hours */
export const EDMTRAIN_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Past-event cleanup runs every 1 hour */
export const EVENT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
