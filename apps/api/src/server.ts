import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { dbPlugin } from './plugins/db.js';
import { authPlugin } from './plugins/auth.js';
import { posPlugin } from './plugins/pos.js';
import { socketPlugin } from './plugins/socket.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { authRoutes } from './routes/auth.js';
import { eventRoutes } from './routes/events.js';
import { supportRoutes } from './routes/support.js';
import { raffleRoutes } from './routes/raffle.js';
import { posRoutes } from './routes/pos.js';
import { artistRoutes } from './routes/artist.js';
import { initWorkers } from './jobs/workers.js';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
});

async function start() {
  // Plugins
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(dbPlugin);
  await app.register(authPlugin);
  await app.register(posPlugin);
  await app.register(socketPlugin);
  await app.register(errorHandlerPlugin);

  // Routes
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(eventRoutes, { prefix: '/events' });
  await app.register(supportRoutes, { prefix: '/support' });
  await app.register(raffleRoutes, { prefix: '/raffle' });
  await app.register(posRoutes, { prefix: '/pos' });
  await app.register(artistRoutes, { prefix: '/artist' });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Start BullMQ workers
  await initWorkers();

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
