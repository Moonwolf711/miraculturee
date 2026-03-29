# Project Index: MiraCulture

Generated: 2026-03-14 | Source files: 172 | Migrations: 30 | Tests: 8

## Mission
**"WHERE FANS POWER THE SHOW"** — Fan-powered ticketing platform. 100% artist support, no scalpers, cryptographically fair raffles, geolocation-verified local tickets.

## Architecture
pnpm monorepo (Turbo) → Railway auto-deploy from master

```
miraculturee/
├── apps/
│   ├── api/          # Fastify 5 + Prisma + PostgreSQL (Node/TS)
│   └── web/          # React 19 + Vite 6 + Tailwind (SPA)
├── packages/
│   ├── shared/       # Types, schemas, constants, geo utils
│   └── pos/          # Point-of-sale Stripe Terminal client
├── tools/
│   ├── nfc-writer/   # NFC ticket writer (HTML)
│   └── pi-nfc/       # Raspberry Pi NFC tap service (Python)
└── docker/           # docker-compose + n8n workflows
```

## Entry Points

| App | Entry | Start Command |
|-----|-------|---------------|
| API | `apps/api/src/server.ts` | `tsx watch src/server.ts` (dev) / `node dist/server.js` (prod) |
| Web | `apps/web/src/main.tsx` → `App.tsx` | `vite` (dev) / `node server.cjs dist` (prod) |

## API Routes (Fastify, `apps/api/src/routes/`)

| Prefix | File | Auth | Purpose |
|--------|------|------|---------|
| `/auth` | auth.ts | Public | Register, login, refresh, password reset |
| `/auth/spotify` | auth/spotify.ts | Public | Spotify OAuth |
| `/auth/soundcloud` | auth/soundcloud.ts | Public | SoundCloud OAuth |
| `/auth/tidal` | auth/tidal.ts | Public | Tidal OAuth |
| `/auth` (2FA) | two-factor.ts | JWT | TOTP setup/verify, passkeys |
| `/auth` (social) | auth/social.ts | Public | Google/social SSO |
| `/events` | events.ts | Public | CRUD events, search, geo-filter |
| `/support` | support.ts | JWT | Buy support tickets (donations) |
| `/raffle` | raffle.ts | JWT | Enter/draw/verify raffles |
| `/tickets` | ticket.ts | JWT | Direct ticket purchase |
| `/campaign-tickets` | campaign-tickets.ts | JWT | Campaign-discounted local tickets |
| `/credits` | credits.ts | JWT | Credit balance, conversion |
| `/artist` | artist.ts | JWT | Artist profile, dashboard |
| `/artist/managers` | manager.ts | JWT | Manager invite/accept system |
| `/connect` | connect.ts | JWT | Stripe Connect onboarding |
| `/donor-connections` | donor-connections.ts | JWT | Donor↔receiver social exchange |
| `/share` | share.ts | Public | Share invite links, tracking |
| `/agents` | agents.ts | JWT | Promoter agent marketplace |
| `/upload` | upload.ts | JWT | File uploads |
| `/pos` | pos.ts | JWT | Point-of-sale terminal |
| `/chat` | public-chat.ts | Public | Fan chat (rate-limited) |
| `/newsletter` | newsletter.ts | Public | Subscribe/unsubscribe |
| `/webhook` | webhook.ts | Stripe sig | Stripe payment webhooks |
| `/connect-webhooks` | connect-webhooks.ts | Stripe sig | Connect account webhooks |
| `/admin/*` | admin/*.ts | ADMIN role | Dashboard, cleanup, vendors, issuing, integrations |
| `/auth/dev-invite` | dev-invite.ts | Public | Developer invite accept |

## Core Services (`apps/api/src/services/`)

| Service | Purpose |
|---------|---------|
| `campaign-state-machine.service.ts` (316L) | Campaign lifecycle: DRAFT→ACTIVE→GOAL_REACHED→TICKETS_OPEN→OVERFLOW→RAFFLE_MODE→ENDED |
| `raffle.service.ts` (408L) | Cryptographic raffle (SHA-256 + Fisher-Yates + Seedrandom), provably fair |
| `ticket.service.ts` | Direct ticket purchase with fee calc |
| `ticket-acquisition.service.ts` | Automated ticket buying via Stripe Issuing virtual cards |
| `browser-purchase.service.ts` | Puppeteer-based ticket purchase from vendor sites |
| `support.service.ts` | Support ticket (donation) processing |
| `geo-verification.service.ts` | IP-based geolocation (100km radius), VPN detection |
| `vpn-detection.service.ts` | VPN/proxy detection via ip-api.com |
| `captcha.service.ts` | hCaptcha verification |
| `credits.service.ts` | Credit balance management, conversion |
| `artist.service.ts` | Artist CRUD, achievement levels (1-10, 6 tiers each) |
| `artist-matching.service.ts` | Match external events to platform artists |
| `artistVerification.ts` | Social account verification logic |
| `email.service.ts` | Resend email service |
| `auth.service.ts` | JWT, bcrypt, refresh tokens |
| `webauthn.service.ts` | Passkey (WebAuthn) registration/authentication |
| `purchase-agent.service.ts` | AI agent ticket purchasing orchestration |
| `agent-subscription.service.ts` | Promoter agent $19.99/mo subscription |
| `edmtrain.service.ts` | EDMTrain event sync |
| `event-ingestion/*.ts` | Multi-source event ingestion (Ticketmaster, EDMTrain) |
| `vendors/*.ts` | Vendor ticket orchestrator (Ticketmaster, Eventbrite) |

## Plugins (`apps/api/src/plugins/`)

| Plugin | Purpose |
|--------|---------|
| `db.ts` | Prisma client decorator |
| `auth.ts` | JWT verification decorator |
| `security.ts` | hCaptcha, VPN detection, geo-verify decorators |
| `email.ts` | Resend email decorator |
| `pos.ts` | Stripe Terminal POS decorator |
| `socket.ts` | Socket.IO WebSocket decorator |
| `error-handler.ts` | Global error handler |

## Frontend Pages (`apps/web/src/pages/`)

| Page | Route | Auth |
|------|-------|------|
| HomePage | `/` | Public |
| EventsPage | `/events` | Public |
| EventDetailPage (1149L) | `/events/:id` | Public (payment tabs: Buy/Support/Raffle) |
| LoginPage | `/login` | Public |
| RegisterPage | `/register` | Public |
| DashboardPage | `/dashboard` | JWT |
| ArtistDashboardPage | `/artist/dashboard` | JWT |
| ArtistEarningsPage | `/artist/earnings` | JWT |
| ArtistRegisterPage | `/artist/register` | Public |
| ArtistVerifyPage | `/artist/verify` | JWT |
| CreateCampaignPage | `/artist/campaigns/new` | Admin |
| ConnectDashboardPage | `/connect/dashboard` | JWT |
| StorefrontPage | `/connect/storefront/:accountId` | Public |
| AgentMarketplacePage | `/agents` | Public |
| AgentRegisterPage | `/agents/register` | JWT |
| AgentDashboardPage | `/agents/dashboard` | JWT |
| AdminPage | `/admin` | Admin/Dev |
| ManagerAcceptPage | `/manager/accept/:token` | Public |

## Database Models (Prisma, 30 migrations)

**Core:** User, Artist, Event, Campaign
**Tickets:** SupportTicket, PoolTicket, DirectTicket, TicketAcquisition
**Raffle:** RafflePool, RaffleEntry
**Financial:** Transaction, ConnectedAccount, ConnectSubscription
**Social:** DonorConnection, ShareInvite, ArtistSocialAccount, SocialLogin
**Security:** SuspiciousActivity, Passkey
**Auth:** DeveloperInvite, ManagerInvite, ArtistManager
**Agents:** PromoterAgent, AgentCampaign
**Events:** ExternalEvent, EventSyncLog
**Platform:** TicketingPlatform, PlatformContactLog, NewsletterSubscriber

**Roles:** FAN, LOCAL_FAN, ARTIST, AGENT, ADMIN, DEVELOPER

## Shared Package (`packages/shared/src/`)

| File | Exports |
|------|---------|
| `constants.ts` | Role, EventType, EventStatus, RaffleStatus, TransactionType, CampaignStatus enums |
| `types.ts` | UserPayload, TokenPair, EventSummary, EventDetail, ArtistDashboard, CampaignDetail, PayoutSummary, etc. |
| `schemas.ts` | Zod validation schemas |
| `geo.ts` | Haversine distance, geo utilities |

## POS Package (`packages/pos/src/`)

| File | Purpose |
|------|---------|
| `pos-client.ts` | Stripe Terminal client wrapper |
| `stripe-provider.ts` | Stripe provider implementation |
| `types.ts` | POS type definitions |

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| fastify | ^5.1.0 | HTTP server |
| @prisma/client | ^6.1.0 | Database ORM |
| stripe | ^17.0.0 | Payments, Connect, Issuing |
| bullmq + ioredis | ^5.30.0 | Job queues |
| puppeteer-core | ^23.0.0 | Automated ticket purchasing |
| bcrypt + otplib | auth | Password hashing, TOTP |
| @simplewebauthn/* | ^11.0.0 | Passkeys/WebAuthn |
| resend | ^4.8.0 | Transactional email |
| seedrandom | ^3.0.5 | Deterministic raffle draws |
| arctic | ^3.5.0 | OAuth helpers |
| react | ^19.0.0 | Frontend framework |
| react-router-dom | ^7.1.0 | Client routing |
| @stripe/react-stripe-js | ^3.5.0 | Payment elements |
| @hcaptcha/react-hcaptcha | ^2.0.2 | Bot protection |
| socket.io / client | ^4.8.0 | Real-time updates |
| tailwindcss | ^3.4.17 | Styling (Concert Poster Noir theme) |
| i18next | ^25.8.14 | Internationalization |

## Tests (8 files, web only)

- `ConnectionStatus.test.tsx` — WebSocket connection indicator
- `ErrorBoundary.test.tsx` — Error boundary rendering
- `Layout.test.tsx` — Layout component
- `useWebSocket.test.ts` — WebSocket hook
- `api.test.ts` — API client
- `ws.test.ts` — WebSocket lib
- `EventDetailPage.test.tsx` — Event detail page
- `EventsPage.test.tsx` — Events listing page

## Tools

| Tool | Purpose |
|------|---------|
| `tools/nfc-writer/` | Browser-based NFC ticket writer |
| `tools/pi-nfc/` | Raspberry Pi NFC tap-to-enter service (Python + systemd) |
| `docker/` | docker-compose for local services + n8n ticket acquisition workflow |

## Quick Start

```bash
pnpm install                    # Install all deps
pnpm db:migrate                 # Run Prisma migrations
pnpm db:seed                    # Seed database
pnpm dev                        # Start all (Turbo: API + Web)
pnpm build                      # Build all
pnpm test                       # Run all tests
```

## Deployment

- **Host:** Railway (auto-deploy from `master`)
- **API domain:** `api.miraculture.com` (Cloudflare DNS)
- **Web domain:** `mira-culture.com` / `www.mira-culture.com`
- **Start script:** `prisma migrate deploy && setup-admin.ts && node dist/server.js`
- **Config:** `railway.json` (restart on failure, max 10 retries)

## Campaign State Machine

```
DRAFT → ACTIVE → GOAL_REACHED → TICKETS_OPEN → OVERFLOW → SURPLUS_RESOLVED → ENDED
                       ↓ (time's up, partial funding)
                  RAFFLE_MODE → ENDED
```

## Security Stack

- hCaptcha (bot protection)
- VPN/Proxy detection (ip-api.com, vpnapi.io)
- Server-side geolocation (IP-based, 100km radius)
- Cryptographic raffle (SHA-256 + Fisher-Yates + Seedrandom, publicly verifiable)
- WebAuthn passkeys + TOTP 2FA
- Stripe webhook signature verification
- Rate limiting (100 req/min global)
