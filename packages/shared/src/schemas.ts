import { z } from 'zod';

// --- Auth ---

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  role: z.enum(['FAN', 'LOCAL_FAN', 'ARTIST']).default('FAN'),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const RefreshSchema = z.object({
  refreshToken: z.string(),
});

// --- Password Reset & Email Verification ---

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(128),
});

export const VerifyEmailSchema = z.object({
  token: z.string(),
});

// --- Events ---

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

export const EventSearchSchema = z.object({
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

export const NearbyEventsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(500).default(50),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// --- Support ---

export const SupportPurchaseSchema = z.object({
  eventId: z.string().uuid(),
  ticketCount: z.number().int().min(1).max(100),
  message: z.string().max(500).optional(),
  captchaToken: z.string().optional(),
});

// --- Raffle ---

export const RaffleEntrySchema = z.object({
  poolId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  captchaToken: z.string().optional(),
});

// --- Ticket Purchase ---

export const TicketPurchaseSchema = z.object({
  eventId: z.string().uuid(),
  deviceFingerprint: z.string().optional(),
  captchaToken: z.string().optional(),
});

// --- POS ---

export const CreatePaymentSchema = z.object({
  amountCents: z.number().int().min(50),
  currency: z.string().length(3).default('usd'),
  metadata: z.record(z.string()).optional(),
});

// --- Shared param schemas ---

export const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const EventIdParamSchema = z.object({
  eventId: z.string().uuid(),
});

export const PoolIdParamSchema = z.object({
  poolId: z.string().uuid(),
});
