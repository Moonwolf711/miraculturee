import type { FastifyInstance } from 'fastify';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://mira-culture.com';

export async function shareRoutes(app: FastifyInstance) {
  /** POST /share/create — create a share invite link for an event */
  app.post('/create', async (req, reply) => {
    const { eventId, platform } = req.body as { eventId?: string; platform?: string };
    if (!eventId) return reply.code(400).send({ error: 'eventId is required' });

    const event = await app.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return reply.code(404).send({ error: 'Event not found' });

    // Optionally associate with authenticated fan
    let fanUserId: string | null = null;
    try {
      await req.jwtVerify();
      fanUserId = req.user.id;
    } catch {
      // Anonymous share is fine
    }

    const invite = await app.prisma.shareInvite.create({
      data: {
        eventId,
        fanUserId,
        platform: platform || null,
      },
    });

    const shareUrl = `${FRONTEND_URL}/invite/${invite.shareToken}`;
    return reply.code(201).send({
      shareUrl,
      shareToken: invite.shareToken,
    });
  });

  /** GET /share/:token — track click and return eventId for redirect */
  app.get('/:token', async (req, reply) => {
    const { token } = req.params as { token: string };

    const invite = await app.prisma.shareInvite.findUnique({
      where: { shareToken: token },
    });
    if (!invite) return reply.code(404).send({ error: 'Invalid share link' });

    // Increment click count (fire and forget)
    app.prisma.shareInvite.update({
      where: { id: invite.id },
      data: { clickCount: { increment: 1 } },
    }).catch(() => {});

    return { eventId: invite.eventId };
  });
}
