/** User role constants. */
export const ROLES = {
  FAN: 'FAN',
  LOCAL_FAN: 'LOCAL_FAN',
  ARTIST: 'ARTIST',
  ADMIN: 'ADMIN',
  DEVELOPER: 'DEVELOPER',
} as const;

/** Union type of all user roles. */
export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Event type constants. */
export const EVENT_TYPE = {
  SHOW: 'SHOW',
  FESTIVAL: 'FESTIVAL',
  SPORTS: 'SPORTS',
  COMEDY: 'COMEDY',
} as const;

/** Union type of event types. */
export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

/** Event lifecycle status constants. */
export const EVENT_STATUS = {
  DRAFT: 'DRAFT',
  AWAITING_ARTIST: 'AWAITING_ARTIST',
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
  CREDIT_CONVERSION: 'CREDIT_CONVERSION',
  CREDIT_SPEND: 'CREDIT_SPEND',
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

/** Campaign lifecycle status constants. */
export const CAMPAIGN_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  GOAL_REACHED: 'GOAL_REACHED',
  TICKETS_OPEN: 'TICKETS_OPEN',
  OVERFLOW: 'OVERFLOW',
  RAFFLE_MODE: 'RAFFLE_MODE',
  SURPLUS_RESOLVED: 'SURPLUS_RESOLVED',
  ENDED: 'ENDED',
} as const;

/** Union type of campaign statuses. */
export type CampaignStatus = (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

/** Campaign lifecycle check interval (every 5 minutes). */
export const CAMPAIGN_LIFECYCLE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Valid campaign state transitions.
 * Each key maps to an array of states it can transition TO.
 */
export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['GOAL_REACHED', 'RAFFLE_MODE', 'ENDED'],
  GOAL_REACHED: ['TICKETS_OPEN', 'ENDED'],
  TICKETS_OPEN: ['OVERFLOW', 'SURPLUS_RESOLVED', 'ENDED'],
  OVERFLOW: ['SURPLUS_RESOLVED', 'ENDED'],
  RAFFLE_MODE: ['ENDED'],
  SURPLUS_RESOLVED: ['ENDED'],
  ENDED: [],
};

/** EDMTrain sync runs every 6 hours */
export const EDMTRAIN_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Past-event cleanup runs every 1 hour */
export const EVENT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// --- Artist Achievement Progression ---

/** Number of successful campaigns needed to advance one tier within a level. */
export const ARTIST_CAMPAIGNS_PER_LEVEL = 6;
/** Maximum achievement level an artist can reach. */
export const ARTIST_MAX_LEVEL = 10;
/** Base number of local tickets at level 1. Each level multiplies this by level number. */
export const ARTIST_BASE_TICKETS = 10;

/** Full progression state for an artist based on their successful campaign count. */
export interface ArtistProgression {
  level: number;
  tierWithinLevel: number;
  discountCents: number;
  maxTicketsForLevel: number;
  currentLevel: number;
  nextLevelTickets: number;
  canLevelUp: boolean;
  isMaxed: boolean;
  totalTiersCompleted: number;
  totalTiersRequired: number;
}

/**
 * Computes the full artist progression state from their successful campaign count.
 *
 * level           = floor(min(campaigns, 59) / 6) + 1    → 1-10
 * tierWithinLevel = min(campaigns, 59) % 6               → 0-5
 * discountCents   = 500 + (tierWithinLevel × 100)        → $5-$10
 * maxTickets      = level × 10                           → 10-100
 * isMaxed         = campaigns >= 60
 */
export function computeArtistProgression(successfulCampaigns: number): ArtistProgression {
  const clamped = Math.min(Math.max(successfulCampaigns, 0), 59);
  const level = Math.floor(clamped / ARTIST_CAMPAIGNS_PER_LEVEL) + 1;
  const tierWithinLevel = clamped % ARTIST_CAMPAIGNS_PER_LEVEL;
  const discountCents = 500 + tierWithinLevel * 100;
  const maxTicketsForLevel = level * ARTIST_BASE_TICKETS;
  const isMaxed = successfulCampaigns >= ARTIST_MAX_LEVEL * ARTIST_CAMPAIGNS_PER_LEVEL;
  const nextLevel = Math.min(level + 1, ARTIST_MAX_LEVEL);

  return {
    level,
    tierWithinLevel,
    discountCents,
    maxTicketsForLevel,
    currentLevel: level,
    nextLevelTickets: nextLevel * ARTIST_BASE_TICKETS,
    canLevelUp: !isMaxed && level < ARTIST_MAX_LEVEL,
    isMaxed,
    totalTiersCompleted: Math.min(successfulCampaigns, 60),
    totalTiersRequired: ARTIST_MAX_LEVEL * ARTIST_CAMPAIGNS_PER_LEVEL,
  };
}

/** Backward-compatible wrapper that returns just the discount in cents. */
export function computeArtistDiscountCents(successfulCampaigns: number): number {
  return computeArtistProgression(successfulCampaigns).discountCents;
}

/** Returns the max local tickets for a given level (for validation when artist picks a lower level). */
export function computeMaxTicketsForLevel(level: number): number {
  return Math.max(1, Math.min(level, ARTIST_MAX_LEVEL)) * ARTIST_BASE_TICKETS;
}
