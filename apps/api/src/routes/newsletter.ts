import type { FastifyInstance } from 'fastify';

export async function newsletterRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string } }>('/subscribe', async (request, reply) => {
    const { email } = request.body ?? {};
    if (!email || typeof email !== 'string') {
      return reply.status(400).send({ error: 'Email is required' });
    }

    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return reply.status(400).send({ error: 'Invalid email address' });
    }

    // Upsert — reactivate if previously unsubscribed
    await app.prisma.newsletterSubscriber.upsert({
      where: { email: normalized },
      update: { active: true },
      create: { email: normalized },
    });

    return reply.status(200).send({ ok: true });
  });

  app.post<{ Body: { email: string } }>('/unsubscribe', async (request, reply) => {
    const { email } = request.body ?? {};
    if (!email || typeof email !== 'string') {
      return reply.status(400).send({ error: 'Email is required' });
    }

    const normalized = email.trim().toLowerCase();
    await app.prisma.newsletterSubscriber.updateMany({
      where: { email: normalized },
      data: { active: false },
    });

    return reply.status(200).send({ ok: true });
  });
}
