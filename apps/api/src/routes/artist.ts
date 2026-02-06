import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/authenticate.js';
import { ArtistService } from '../services/artist.service.js';

export async function artistRoutes(app: FastifyInstance) {
  const artistService = new ArtistService(app.prisma);

  app.get('/dashboard', { preHandler: [requireRole('ARTIST')] }, async (req) => {
    return artistService.getDashboard(req.user.id);
  });

  app.get('/earnings', { preHandler: [requireRole('ARTIST')] }, async (req) => {
    return artistService.getEarnings(req.user.id);
  });
}
