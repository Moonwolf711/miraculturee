import type { FastifyInstance } from 'fastify';
import {
  CreateManagerInviteSchema,
  AcceptManagerInviteSchema,
  ManagerTokenParamSchema,
  UuidParamSchema,
} from '@miraculturee/shared';

export async function managerRoutes(app: FastifyInstance) {
  // ─── Artist: Create invite link ───

  /** POST /artist/managers/invite — generate a manager invite link */
  app.post('/invite', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = CreateManagerInviteSchema.parse(req.body);
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    const invite = await app.prisma.managerInvite.create({
      data: {
        artistId: artist.id,
        permission: body.permission as any,
        email: body.email,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return reply.code(201).send({
      id: invite.id,
      token: invite.token,
      permission: invite.permission,
      expiresAt: invite.expiresAt.toISOString(),
      inviteUrl: `${req.headers.origin || 'https://mira-culture.com'}/manager/accept/${invite.token}`,
    });
  });

  /** GET /artist/managers — list all managers for the artist */
  app.get('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    const managers = await app.prisma.artistManager.findMany({
      where: { artistId: artist.id },
      include: { user: { select: { email: true, name: true } } },
      orderBy: { addedAt: 'desc' },
    });

    return { managers };
  });

  /** GET /artist/managers/invites — list pending invites */
  app.get('/invites', { preHandler: [app.authenticate] }, async (req, reply) => {
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    const invites = await app.prisma.managerInvite.findMany({
      where: { artistId: artist.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    return { invites };
  });

  /** DELETE /artist/managers/:id — remove a manager */
  app.delete('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    const manager = await app.prisma.artistManager.findFirst({
      where: { id, artistId: artist.id },
    });
    if (!manager) return reply.code(404).send({ error: 'Manager not found' });

    await app.prisma.artistManager.delete({ where: { id } });
    return { success: true };
  });

  /** DELETE /artist/managers/invites/:id — revoke an invite */
  app.delete('/invites/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    const invite = await app.prisma.managerInvite.findFirst({
      where: { id, artistId: artist.id },
    });
    if (!invite) return reply.code(404).send({ error: 'Invite not found' });

    await app.prisma.managerInvite.delete({ where: { id } });
    return { success: true };
  });

  // ─── Public: View & Accept invite ───

  /** GET /artist/managers/accept/:token — view invite details (public) */
  app.get('/accept/:token', async (req, reply) => {
    const { token } = ManagerTokenParamSchema.parse(req.params);
    const invite = await app.prisma.managerInvite.findUnique({
      where: { token },
      include: { artist: { select: { stageName: true } } },
    });

    if (!invite) return reply.code(404).send({ error: 'Invite not found' });
    if (invite.acceptedAt) return reply.code(400).send({ error: 'Invite already accepted' });
    if (invite.expiresAt < new Date()) return reply.code(400).send({ error: 'Invite expired' });

    return {
      artistName: invite.artist.stageName,
      permission: invite.permission,
      expiresAt: invite.expiresAt.toISOString(),
    };
  });

  /** POST /artist/managers/accept/:token — accept an invite (requires auth) */
  app.post('/accept/:token', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { token } = ManagerTokenParamSchema.parse(req.params);
    const body = AcceptManagerInviteSchema.parse(req.body);

    const invite = await app.prisma.managerInvite.findUnique({
      where: { token },
      include: { artist: true },
    });

    if (!invite) return reply.code(404).send({ error: 'Invite not found' });
    if (invite.acceptedAt) return reply.code(400).send({ error: 'Invite already accepted' });
    if (invite.expiresAt < new Date()) return reply.code(400).send({ error: 'Invite expired' });

    // Can't manage your own artist profile
    if (invite.artist.userId === req.user.id) {
      return reply.code(400).send({ error: 'You cannot be a manager of your own artist profile' });
    }

    // Check if already a manager
    const existing = await app.prisma.artistManager.findUnique({
      where: { artistId_userId: { artistId: invite.artistId, userId: req.user.id } },
    });
    if (existing) return reply.code(409).send({ error: 'You are already a manager for this artist' });

    // Create manager and mark invite accepted
    const [manager] = await app.prisma.$transaction([
      app.prisma.artistManager.create({
        data: {
          artistId: invite.artistId,
          userId: req.user.id,
          permission: invite.permission,
          displayName: body.displayName,
          bio: body.bio,
        },
      }),
      app.prisma.managerInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return reply.code(201).send(manager);
  });
}
