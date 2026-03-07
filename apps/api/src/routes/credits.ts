import type { FastifyInstance } from 'fastify';
import { CreditsService } from '../services/credits.service.js';

export async function creditsRoutes(app: FastifyInstance) {
  const creditsService = new CreditsService(app.prisma);

  // Get current credits balance
  app.get('/balance', { preHandler: [app.authenticate] }, async (req) => {
    const balance = await creditsService.getBalance(req.user.id);
    return { balanceCents: balance, balanceDollars: (balance / 100).toFixed(2) };
  });

  // Get credit transaction history
  app.get('/history', { preHandler: [app.authenticate] }, async (req) => {
    const query = req.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit || '20', 10), 50);
    const offset = Math.max(parseInt(query.offset || '0', 10), 0);

    const transactions = await creditsService.getHistory(req.user.id, limit, offset);
    return transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amountCents: t.amountCents,
      amountDollars: (t.amountCents / 100).toFixed(2),
      status: t.status,
      metadata: t.metadata,
      createdAt: t.createdAt.toISOString(),
    }));
  });
}
