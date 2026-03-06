/**
 * Public developer invite routes — NOT behind admin scope.
 * Handles invite validation and acceptance.
 */

import type { FastifyInstance } from 'fastify';

export async function devInviteRoutes(app: FastifyInstance) {
  /**
   * GET /auth/dev-invite/:token
   * Validate token and return invite details (public)
   */
  app.get('/:token', async (req, reply) => {
    const { token } = req.params as { token: string };

    const invite = await app.prisma.developerInvite.findUnique({
      where: { token },
      include: {
        invitedBy: { select: { name: true } },
      },
    });

    if (!invite) {
      return reply.code(404).send({ error: 'Invite not found' });
    }

    if (invite.status !== 'PENDING') {
      return reply.code(410).send({ error: `Invite has been ${invite.status.toLowerCase()}` });
    }

    if (new Date() > invite.expiresAt) {
      await app.prisma.developerInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });
      return reply.code(410).send({ error: 'Invite has expired' });
    }

    return {
      email: invite.email,
      permission: invite.permission,
      inviterName: invite.invitedBy.name,
      expiresAt: invite.expiresAt,
    };
  });

  /**
   * POST /auth/dev-invite/:token/accept
   * Accept invite (requires auth). Verifies email match, promotes to DEVELOPER.
   */
  app.post('/:token/accept', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { token } = req.params as { token: string };

    const invite = await app.prisma.developerInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      return reply.code(404).send({ error: 'Invite not found' });
    }

    if (invite.status !== 'PENDING') {
      return reply.code(410).send({ error: `Invite has been ${invite.status.toLowerCase()}` });
    }

    if (new Date() > invite.expiresAt) {
      await app.prisma.developerInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });
      return reply.code(410).send({ error: 'Invite has expired' });
    }

    // Verify email matches
    if (req.user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return reply.code(403).send({
        error: 'This invite was sent to a different email address',
      });
    }

    // Promote user and mark invite accepted in a transaction
    await app.prisma.$transaction([
      app.prisma.user.update({
        where: { id: req.user.id },
        data: { role: 'DEVELOPER' },
      }),
      app.prisma.developerInvite.update({
        where: { id: invite.id },
        data: {
          status: 'ACCEPTED',
          acceptedById: req.user.id,
          acceptedAt: new Date(),
        },
      }),
    ]);

    return { success: true, role: 'DEVELOPER' };
  });
}
