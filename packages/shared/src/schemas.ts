import { z } from 'zod';

// --- Auth ---

/** Validates user registration input. */
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  role: z.enum(['FAN', 'LOCAL_FAN', 'ARTIST']).default('FAN'),
});

/** Validates user login input. */
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/** Validates token refresh input. */
export const RefreshSchema = z.object({
  refreshToken: z.string(),
});

// --- Password Reset & Email Verification ---

/** Validates forgot-password request input. */
export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

/** Validates password reset input (token + new password). */
export const ResetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(128),
});

/** Validates email verification input. */
export const VerifyEmailSchema = z.object({
  token: z.string(),
});

// --- Events ---

/** Validates event creation input. */
export const CreateEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  venueName: z.string().min(1).max(200),
  venueAddress: z.string().min(1).max(500),
  venueLat: z.number().min(-90).max(90),
  venueLng: z.number().min(-180).max(180),
  date: z.string().datetime(),
  ticketPriceCents: z.number().int().min(100),
  totalTickets: z.number().int().min(1).max(100000),
  localRadiusKm: z.number().min(1).max(500).default(50),
});

/** Validates event search query parameters. */
export const EventSearchSchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  artistName: z.string().optional(),
  genre: z.string().optional(),
  type: z.enum(['SHOW', 'FESTIVAL']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  sort: z.string().default('date'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Validates nearby-events geo query parameters. */
export const NearbyEventsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(500).default(50),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// --- Support ---

/** Validates support ticket purchase input. */
export const SupportPurchaseSchema = z.object({
  eventId: z.string().uuid(),
  ticketCount: z.number().int().min(1).max(100),
  message: z.string().max(500).optional(),
  captchaToken: z.string().optional(),
  optInConnection: z.boolean().optional(),
  socials: z.object({
    instagram: z.string().max(100).optional(),
    twitter: z.string().max(100).optional(),
  }).optional(),
});

/** Validates donor connection response input (receiver choosing connect or anonymous). */
export const ConnectionChoiceSchema = z.object({
  choice: z.enum(['connect', 'anonymous']),
  socials: z.object({
    instagram: z.string().max(100).optional(),
    twitter: z.string().max(100).optional(),
  }).optional(),
  thankYouMessage: z.string().max(500).optional(),
});

// --- Raffle ---

/** Validates raffle entry input. */
export const RaffleEntrySchema = z.object({
  poolId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  captchaToken: z.string().optional(),
});

// --- Ticket Purchase ---

/** Validates direct ticket purchase input. */
export const TicketPurchaseSchema = z.object({
  eventId: z.string().uuid(),
  deviceFingerprint: z.string().optional(),
  captchaToken: z.string().optional(),
});

// --- POS ---

/** Validates POS payment creation input. */
export const CreatePaymentSchema = z.object({
  amountCents: z.number().int().min(50),
  currency: z.string().length(3).default('usd'),
  metadata: z.record(z.string()).optional(),
});

// --- Admin: Issuing ---

/** Validates cardholder creation input. */
export const CreateCardholderSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  line1: z.string().min(1).max(500),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(2),
  postalCode: z.string().min(5).max(10),
});

/** Validates acquisitions list query. */
export const AcquisitionsQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Validates ticket acquire input. */
export const AcquireTicketsSchema = z.object({
  eventId: z.string().uuid(),
  ticketCount: z.number().int().min(1).max(1000),
  cardholderId: z.string().optional(),
  purchaseUrl: z.string().url().optional(),
});

/** Validates acquisition completion input. */
export const CompleteAcquisitionSchema = z.object({
  confirmationRef: z.string().min(1).max(500),
});

/** Validates acquisition failure input. */
export const FailAcquisitionSchema = z.object({
  errorMessage: z.string().max(2000).optional(),
});

/** Validates n8n webhook acquisition status input. */
export const WebhookAcquisitionStatusSchema = z.object({
  acquisitionId: z.string().uuid(),
  action: z.enum(['complete', 'fail', 'status']),
  confirmationRef: z.string().optional(),
  errorMessage: z.string().optional(),
});

// --- Admin: External Events ---

/** Validates external events list query. */
export const ExternalEventsQuerySchema = z.object({
  source: z.string().optional(),
  status: z.string().optional(),
  city: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Validates sync logs query. */
export const SyncLogsQuerySchema = z.object({
  source: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

// --- Artist Campaigns ---

/** Validates campaign creation input. */
export const CreateCampaignSchema = z.object({
  eventId: z.string().uuid(),
  headline: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  discountCents: z.number().int().min(500).max(1000).optional(),
});

/** Validates campaign update input. */
export const UpdateCampaignSchema = z.object({
  headline: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(2000).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ENDED']).optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
});

/** Validates campaign list query. */
export const CampaignListSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'ENDED']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// --- Shared param schemas ---

/** Validates a generic UUID path parameter. */
export const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

/** Validates an event UUID path parameter. */
export const EventIdParamSchema = z.object({
  eventId: z.string().uuid(),
});

/** Validates a raffle pool UUID path parameter. */
export const PoolIdParamSchema = z.object({
  poolId: z.string().uuid(),
});
