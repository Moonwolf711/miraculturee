/** User role constants. */
export const ROLES = {
  FAN: 'FAN',
  LOCAL_FAN: 'LOCAL_FAN',
  ARTIST: 'ARTIST',
  ADMIN: 'ADMIN',
} as const;

/** Union type of all user roles. */
export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Event type constants. */
export const EVENT_TYPE = {
  SHOW: 'SHOW',
  FESTIVAL: 'FESTIVAL',
} as const;

/** Union type of event types. */
export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

/** Event lifecycle status constants. */
export const EVENT_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  SOLD_OUT: 'SOLD_OUT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

/** Union type of event statuses. */
export type EventStatus = (typeof EVENT_STATUS)[keyof typeof EVENT_STATUS];

/** Raffle lifecycle status constants. */
export const RAFFLE_STATUS = {
  OPEN: 'OPEN',
  DRAWING: 'DRAWING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

/** Union type of raffle statuses. */
export type RaffleStatus = (typeof RAFFLE_STATUS)[keyof typeof RAFFLE_STATUS];

/** Raffle tier price constants (in cents). */
export const RAFFLE_TIER = {
  FIVE: 500, // $5 in cents — MVP single tier
} as const;

/** Pool ticket lifecycle status constants. */
export const POOL_TICKET_STATUS = {
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  REDEEMED: 'REDEEMED',
} as const;

/** Union type of pool ticket statuses. */
export type PoolTicketStatus = (typeof POOL_TICKET_STATUS)[keyof typeof POOL_TICKET_STATUS];

/** Transaction type constants. */
export const TRANSACTION_TYPE = {
  SUPPORT_PURCHASE: 'SUPPORT_PURCHASE',
  RAFFLE_ENTRY: 'RAFFLE_ENTRY',
  TICKET_PURCHASE: 'TICKET_PURCHASE',
  ARTIST_PAYOUT: 'ARTIST_PAYOUT',
  REFUND: 'REFUND',
} as const;

/** Union type of transaction types. */
export type TransactionType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

/** Direct ticket lifecycle status constants. */
export const DIRECT_TICKET_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  TRANSFERRED: 'TRANSFERRED',
  REDEEMED: 'REDEEMED',
  REFUNDED: 'REFUNDED',
} as const;

/** Union type of direct ticket statuses. */
export type DirectTicketStatus = (typeof DIRECT_TICKET_STATUS)[keyof typeof DIRECT_TICKET_STATUS];

/** Minimum processing fee in cents. */
export const PROCESSING_FEE_MIN_CENTS = 500;
/** Maximum processing fee in cents. */
export const PROCESSING_FEE_MAX_CENTS = 1000;
/** Support fee charged per ticket in cents. */
export const SUPPORT_FEE_PER_TICKET_CENTS = 500;
/** Platform fee as a decimal fraction (2.5%). */
export const PLATFORM_FEE_PERCENT = 0.025;

/** Hours before event when direct sales close. */
export const DIRECT_SALES_CUTOFF_HOURS = 24;

/**
 * Checks whether direct ticket sales are still open for an event.
 * Sales close {@link DIRECT_SALES_CUTOFF_HOURS} hours before the event date.
 */
export function isDirectSalesOpen(eventDate: Date | string): boolean {
  const cutoff = new Date(eventDate);
  cutoff.setHours(cutoff.getHours() - DIRECT_SALES_CUTOFF_HOURS);
  return new Date() < cutoff;
}

/** JWT access token expiry duration. */
export const JWT_ACCESS_EXPIRY = '15m';
/** JWT refresh token expiry duration. */
export const JWT_REFRESH_EXPIRY = '7d';
/** Default local radius for geo queries in kilometers. */
export const DEFAULT_LOCAL_RADIUS_KM = 50;
/** Mean radius of the Earth in kilometers (used in Haversine calculations). */
export const EARTH_RADIUS_KM = 6371;

/** EDMTrain sync runs every 6 hours */
export const EDMTRAIN_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Past-event cleanup runs every 1 hour */
export const EVENT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
