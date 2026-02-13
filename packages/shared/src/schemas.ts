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
