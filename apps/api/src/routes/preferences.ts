import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserPreferencesService } from '../services/user-preferences.service.js';

export async function preferencesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  const getService = () => new UserPreferencesService(app.prisma);

  // Get personalized recommendations
  app.get('/recommendations', async (req) => {
    const query = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(10),
    }).parse(req.query);

    const results = await getService().getRecommendations(req.user.id, query.limit);

    return {
      recommendations: results.map(r => {
        const meta = r.metadata ? JSON.parse(r.metadata) : {};
        return {
          artistName: meta.artistName ?? null,
          genre: meta.genre ?? null,
          venueCity: meta.venueCity ?? null,
          relevanceScore: r.successRate,
        };
      }),
    };
  });

  // Get top genres for user
  app.get('/genres', async (req) => {
    return { genres: await getService().getTopGenres(req.user.id) };
  });

  // Find fans with similar taste
  app.get('/similar-fans', async (req) => {
    const query = z.object({
      limit: z.coerce.number().int().min(1).max(20).default(5),
    }).parse(req.query);

    const userIds = await getService().findSimilarFans(req.user.id, query.limit);

    // Fetch public profiles
    const users = await app.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, city: true },
    });

    return { similarFans: users };
  });

  // Sync existing history into AgentDB (one-time bootstrap)
  app.post('/sync', async (req) => {
    const count = await getService().syncUserHistory(req.user.id);
    return { synced: count, message: `Synced ${count} preference signals` };
  });

  // Record a preference signal manually (e.g., event view)
  app.post('/signal', async (req) => {
    const body = z.object({
      type: z.enum(['event_view', 'support', 'raffle_entry', 'ticket_purchase']),
      artistName: z.string(),
      genre: z.string().nullable().default(null),
      venueCity: z.string().nullable().default(null),
      amountCents: z.number().int().optional(),
    }).parse(req.body);

    await getService().recordPreference({
      userId: req.user.id,
      ...body,
    });

    return { recorded: true };
  });
}
