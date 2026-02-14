import type { FastifyInstance } from 'fastify';
import { UuidParamSchema, ConnectionChoiceSchema } from '@miraculturee/shared';

export async function donorConnectionRoutes(app: FastifyInstance) {
  /** POST /:id/respond — receiver submits their choice (connect or anonymous) */
  app.post('/:id/respond', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const body = ConnectionChoiceSchema.parse(req.body);

    const connection = await app.prisma.donorConnection.findUnique({ where: { id } });
    if (!connection) return reply.code(404).send({ error: 'Connection not found' });
    if (connection.receiverUserId !== req.user.id) {
      return reply.code(403).send({ error: 'Only the ticket receiver can respond' });
    }
    if (connection.receiverChoice) {
      return reply.code(400).send({ error: 'You have already responded to this connection' });
    }

    await app.prisma.donorConnection.update({
      where: { id },
      data: {
        receiverChoice: body.choice,
        receiverSocials: body.choice === 'connect' ? (body.socials ?? undefined) : undefined,
        thankYouMessage: body.choice === 'anonymous' ? (body.thankYouMessage ?? undefined) : undefined,
      },
    });

    // Notify donor of the receiver's choice
    if (body.choice === 'connect') {
      await app.prisma.notification.create({
        data: {
          userId: connection.donorUserId,
          title: 'Connection accepted!',
          body: 'The fan who received your ticket wants to connect. Check your connections to see their info.',
          metadata: { connectionId: id, type: 'receiver_chose_connect' },
        },
      });
    } else {
      await app.prisma.notification.create({
        data: {
          userId: connection.donorUserId,
          title: 'Thank you from your fan!',
          body: body.thankYouMessage || 'The fan who received your ticket sent their thanks.',
          metadata: { connectionId: id, type: 'receiver_chose_anonymous' },
        },
      });
    }

    return reply.send({ success: true });
  });

  /** GET /mine — list user's connections (as donor and receiver) */
  app.get('/mine', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.id;

    const [asDonor, asReceiver] = await Promise.all([
      app.prisma.donorConnection.findMany({
        where: { donorUserId: userId },
        include: { event: { select: { id: true, title: true, date: true, venueName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      app.prisma.donorConnection.findMany({
        where: { receiverUserId: userId },
        include: { event: { select: { id: true, title: true, date: true, venueName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Privacy filter: donor only sees receiver socials if receiver chose 'connect'
    const filteredAsDonor = asDonor.map((c) => ({
      ...c,
      receiverSocials: c.receiverChoice === 'connect' ? c.receiverSocials : null,
    }));

    return reply.send({ asDonor: filteredAsDonor, asReceiver });
  });

  /** GET /:id — get single connection detail */
  app.get('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const userId = req.user.id;

    const connection = await app.prisma.donorConnection.findUnique({
      where: { id },
      include: { event: { select: { id: true, title: true, date: true, venueName: true } } },
    });
    if (!connection) return reply.code(404).send({ error: 'Connection not found' });
    if (connection.donorUserId !== userId && connection.receiverUserId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // Privacy: donor only sees receiver socials if receiver chose 'connect'
    const filtered = {
      ...connection,
      receiverSocials: connection.receiverChoice === 'connect' ? connection.receiverSocials : null,
      // Receiver sees donor socials only if they chose 'connect'
      donorSocials: connection.receiverUserId === userId && connection.receiverChoice !== 'connect'
        ? null
        : connection.donorSocials,
    };

    return reply.send(filtered);
  });
}
