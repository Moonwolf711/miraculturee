export const ROLES = {
  FAN: 'FAN',
  LOCAL_FAN: 'LOCAL_FAN',
  ARTIST: 'ARTIST',
  ADMIN: 'ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

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
  ARTIST_PAYOUT: 'ARTIST_PAYOUT',
  REFUND: 'REFUND',
} as const;

export type TransactionType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

export const JWT_ACCESS_EXPIRY = '15m';
export const JWT_REFRESH_EXPIRY = '7d';
export const DEFAULT_LOCAL_RADIUS_KM = 50;
export const EARTH_RADIUS_KM = 6371;
