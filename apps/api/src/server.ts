import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { dbPlugin } from './plugins/db.js';
import { authPlugin } from './plugins/auth.js';
import { posPlugin } from './plugins/pos.js';
import { socketPlugin } from './plugins/socket.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { emailPlugin } from './plugins/email.js';
import securityPlugin from './plugins/security.js';
import { authRoutes } from './routes/auth.js';
import { eventRoutes } from './routes/events.js';
import { supportRoutes } from './routes/support.js';
import { raffleRoutes } from './routes/raffle.js';
import { posRoutes } from './routes/pos.js';
import { artistRoutes } from './routes/artist.js';
import { ticketRoutes } from './routes/ticket.js';
import { campaignTicketRoutes } from './routes/campaign-tickets.js';
import { webhookRoutes } from './routes/webhook.js';
import { userRoutes } from './routes/user.js';
import { applePayRoutes } from './routes/applepay.js';
import { connectRoutes } from './routes/connect.js';
import { connectWebhookRoutes } from './routes/connect-webhooks.js';
import { donorConnectionRoutes } from './routes/donor-connections.js';
import { shareRoutes } from './routes/share.js';
import { spotifyOAuthRoutes } from './routes/auth/spotify.js';
import { soundcloudOAuthRoutes } from './routes/auth/soundcloud.js';
import { tidalOAuthRoutes } from './routes/auth/tidal.js';
import { twoFactorRoutes } from './routes/two-factor.js';
import { socialOAuthRoutes } from './routes/auth/social.js';
import externalEventsRoutes from './routes/admin/external-events.js';
import issuingRoutes from './routes/admin/issuing.js';
import vendorTicketRoutes from './routes/admin/vendor-tickets.js';
import adminDashboardRoutes from './routes/admin/dashboard.js';
import adminCleanupRoutes from './routes/admin/cleanup.js';
import adminRepriceRoutes from './routes/admin/reprice.js';
import developerRoutes from './routes/admin/developers.js';
import integrationRoutes from './routes/admin/integrations.js';
import chatRoutes from './routes/admin/chat.js';
import { devInviteRoutes } from './routes/dev-invite.js';
import { publicChatRoutes } from './routes/public-chat.js';
import { newsletterRoutes } from './routes/newsletter.js';
import { creditsRoutes } from './routes/credits.js';
import { agentRoutes } from './routes/agents.js';
import { uploadRoutes } from './routes/upload.js';
import { managerRoutes } from './routes/manager.js';
import { managerDashboardRoutes } from './routes/manager-dashboard.js';
import { localArtistRoutes } from './routes/local-artists.js';
import { preferencesRoutes } from './routes/preferences.js';
import { requireRole } from './middleware/authenticate.js';
import { initWorkers } from './jobs/workers.js';
import { setupCronJobs } from './cron.js';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  trustProxy: true,
});

async function start() {
  // Plugins
  const allowedOrigins = [
    'https://miracultureeweb-production.up.railway.app',
    'https://www.mira-culture.com',
    'https://mira-culture.com',
    ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []),
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:3000'] : []),
  ];
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
  });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(dbPlugin);
  await app.register(authPlugin);
  await app.register(posPlugin);
  await app.register(socketPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(emailPlugin);
  await app.register(securityPlugin);

  // Routes
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(spotifyOAuthRoutes, { prefix: '/auth/spotify' });
  await app.register(soundcloudOAuthRoutes, { prefix: '/auth/soundcloud' });
  await app.register(tidalOAuthRoutes, { prefix: '/auth/tidal' });
  await app.register(twoFactorRoutes, { prefix: '/auth' });
  await app.register(socialOAuthRoutes, { prefix: '/auth' });
  await app.register(eventRoutes, { prefix: '/events' });
  await app.register(supportRoutes, { prefix: '/support' });
  await app.register(raffleRoutes, { prefix: '/raffle' });
  await app.register(posRoutes, { prefix: '/pos' });
  await app.register(artistRoutes, { prefix: '/artist' });
  await app.register(ticketRoutes, { prefix: '/tickets' });
  await app.register(campaignTicketRoutes, { prefix: '/campaign-tickets' });
  await app.register(userRoutes, { prefix: '/user' });
  await app.register(applePayRoutes, { prefix: '/apple-pay' });
  await app.register(connectRoutes, { prefix: '/connect' });
  await app.register(donorConnectionRoutes, { prefix: '/donor-connections' });
  await app.register(creditsRoutes, { prefix: '/credits' });
  await app.register(shareRoutes, { prefix: '/share' });
  await app.register(agentRoutes, { prefix: '/agents' });
  await app.register(uploadRoutes, { prefix: '/upload' });
  await app.register(managerRoutes, { prefix: '/artist/managers' });
  await app.register(managerDashboardRoutes, { prefix: '/manager' });
  await app.register(localArtistRoutes, { prefix: '/local-artists' });
  await app.register(preferencesRoutes, { prefix: '/preferences' });
  // Webhook routes — use their own raw body parsers for Stripe signature verification
  await app.register(webhookRoutes, { prefix: '/webhook' });
  await app.register(connectWebhookRoutes, { prefix: '/connect-webhooks' });
  // Admin routes — all require authentication + ADMIN role
  await app.register(async function adminRoutes(admin) {
    admin.addHook('onRequest', requireRole('ADMIN'));
    await admin.register(externalEventsRoutes, { prefix: '/external-events' });
    await admin.register(issuingRoutes, { prefix: '/issuing' });
    await admin.register(vendorTicketRoutes, { prefix: '/vendors' });
    await admin.register(adminDashboardRoutes, { prefix: '/dashboard' });
    await admin.register(adminCleanupRoutes, { prefix: '/cleanup' });
    await admin.register(adminRepriceRoutes);
    await admin.register(developerRoutes, { prefix: '/developers' });
    await admin.register(integrationRoutes, { prefix: '/integrations' });
  }, { prefix: '/admin' });
  // Admin chat — accessible to ADMIN + DEVELOPER
  await app.register(async function adminChatScope(scope) {
    scope.addHook('onRequest', requireRole('ADMIN', 'DEVELOPER'));
    await scope.register(chatRoutes);
  }, { prefix: '/admin' });
  // Public developer invite routes (not behind admin scope)
  await app.register(devInviteRoutes, { prefix: '/auth/dev-invite' });
  // Public fan chat (rate-limited, no auth required)
  await app.register(publicChatRoutes, { prefix: '/chat' });
  // Newsletter subscribe/unsubscribe (public, no auth required)
  await app.register(newsletterRoutes, { prefix: '/newsletter' });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    oauth: {
      spotify: {
        clientId: !!process.env.SPOTIFY_CLIENT_ID,
        clientSecret: !!process.env.SPOTIFY_CLIENT_SECRET,
        redirectUri: !!process.env.SPOTIFY_REDIRECT_URI,
      },
      soundcloud: {
        clientId: !!process.env.SOUNDCLOUD_CLIENT_ID,
        clientSecret: !!process.env.SOUNDCLOUD_CLIENT_SECRET,
        redirectUri: !!process.env.SOUNDCLOUD_REDIRECT_URI,
      },
    },
  }));

  // Start BullMQ workers
  await initWorkers();

  // Start event sync cron jobs (Ticketmaster, EDMTrain)
  setupCronJobs(app);

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen({ port, host });
  app.log.info(`Server running at http://${host}:${port}`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app };