import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getMemory } from '../lib/agentdb.js';

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function semanticSearchRoutes(app: FastifyInstance) {
  /**
   * GET /search/artists?q=<query>&limit=10
   * Semantic search across indexed local artist profiles.
   */
  app.get('/artists', async (req, reply) => {
    const { q, limit } = SearchQuerySchema.parse(req.query);

    try {
      const memory = await getMemory();
      const results = await memory.searchArtists(q, limit);

      if (results.length === 0) {
        return { results: [], total: 0, query: q };
      }

      // Hydrate with Prisma data for the matched IDs
      const artistIds = results.map((r) => r.id);
      const artists = await app.prisma.localArtistProfile.findMany({
        where: { id: { in: artistIds } },
        select: {
          id: true,
          stageName: true,
          city: true,
          state: true,
          genres: true,
          professionalType: true,
          profileImageUrl: true,
          verificationStatus: true,
          totalShows: true,
          totalTicketsSold: true,
          availableForBooking: true,
        },
      });

      // Merge scores with Prisma data, preserving ranking order
      const scoreMap = new Map(results.map((r) => [r.id, r.score]));
      const ranked = artists
        .map((a) => ({ ...a, score: scoreMap.get(a.id) ?? 0 }))
        .sort((a, b) => b.score - a.score);

      return { results: ranked, total: ranked.length, query: q };
    } catch (err) {
      app.log.error(err, '[semantic-search] Artist search failed');
      return reply.code(503).send({ error: 'Semantic search temporarily unavailable' });
    }
  });

  /**
   * GET /search/agents?q=<query>&limit=10
   * Semantic search across indexed promoter agent profiles.
   */
  app.get('/agents', async (req, reply) => {
    const { q, limit } = SearchQuerySchema.parse(req.query);

    try {
      const memory = await getMemory();
      const results = await memory.matchAgentsForCampaign(q, limit);

      if (results.length === 0) {
        return { results: [], total: 0, query: q };
      }

      // Hydrate with Prisma data
      const agentIds = results.map((r) => r.id);
      const agents = await app.prisma.promoterAgent.findMany({
        where: { id: { in: agentIds } },
        select: {
          id: true,
          displayName: true,
          headline: true,
          city: true,
          state: true,
          genres: true,
          skills: true,
          profileImageUrl: true,
          verificationStatus: true,
          totalCampaigns: true,
          rating: true,
          ratingCount: true,
        },
      });

      const scoreMap = new Map(results.map((r) => [r.id, r.score]));
      const ranked = agents
        .map((a) => ({ ...a, score: scoreMap.get(a.id) ?? 0 }))
        .sort((a, b) => b.score - a.score);

      return { results: ranked, total: ranked.length, query: q };
    } catch (err) {
      app.log.error(err, '[semantic-search] Agent search failed');
      return reply.code(503).send({ error: 'Semantic search temporarily unavailable' });
    }
  });

  /**
   * GET /search/recommendations/:artistId
   * Find similar artists based on an existing artist's profile.
   */
  app.get('/recommendations/:artistId', async (req, reply) => {
    const { artistId } = z.object({ artistId: z.string().uuid() }).parse(req.params);

    try {
      const artist = await app.prisma.localArtistProfile.findUnique({
        where: { id: artistId },
        select: {
          stageName: true,
          city: true,
          state: true,
          bio: true,
          genres: true,
          professionalType: true,
        },
      });

      if (!artist) {
        return reply.code(404).send({ error: 'Artist not found' });
      }

      // Build a query string from the artist's profile
      const query = [
        artist.professionalType || 'musician',
        artist.genres.join(' '),
        artist.city,
        artist.state,
        artist.bio?.slice(0, 200) || '',
      ]
        .filter(Boolean)
        .join(' ');

      const memory = await getMemory();
      const results = await memory.searchArtists(query, 11); // +1 to exclude self

      // Filter out the queried artist
      const filtered = results.filter((r) => r.id !== artistId).slice(0, 10);

      if (filtered.length === 0) {
        return { results: [], total: 0, artistId };
      }

      // Hydrate
      const ids = filtered.map((r) => r.id);
      const artists = await app.prisma.localArtistProfile.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          stageName: true,
          city: true,
          state: true,
          genres: true,
          professionalType: true,
          profileImageUrl: true,
          totalShows: true,
          availableForBooking: true,
        },
      });

      const scoreMap = new Map(filtered.map((r) => [r.id, r.score]));
      const ranked = artists
        .map((a) => ({ ...a, score: scoreMap.get(a.id) ?? 0 }))
        .sort((a, b) => b.score - a.score);

      return { results: ranked, total: ranked.length, artistId };
    } catch (err) {
      app.log.error(err, '[semantic-search] Recommendations failed');
      return reply.code(503).send({ error: 'Recommendations temporarily unavailable' });
    }
  });

  /**
   * GET /search/stats
   * Get AgentDB memory system stats (admin/debug).
   */
  app.get('/stats', async (_req, reply) => {
    try {
      const memory = await getMemory();
      return await memory.getStats();
    } catch (err) {
      app.log.error(err, '[semantic-search] Stats failed');
      return reply.code(503).send({ error: 'Stats temporarily unavailable' });
    }
  });
}
