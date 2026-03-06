/**
 * Admin developer management routes
 * All routes are pre-guarded by requireRole('ADMIN') via the admin scope.
 */

import type { FastifyInstance } from 'fastify';
import { DeveloperInviteSchema } from '@miraculturee/shared';
import { randomUUID } from 'crypto';

const INVITE_EXPIRY_DAYS = 7;

export default async function developerRoutes(app: FastifyInstance) {
  /**
   * GET /admin/developers/
   * List users with DEVELOPER role
   */
  app.get('/', async () => {
    const developers = await app.prisma.user.findMany({
      where: { role: 'DEVELOPER' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        devInvitesAccepted: {
          select: {
            permission: true,
            invitedBy: { select: { name: true, email: true } },
            acceptedAt: true,
          },
          take: 1,
          orderBy: { acceptedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      developers: developers.map((d) => ({
        id: d.id,
        email: d.email,
        name: d.name,
        role: d.role,
        createdAt: d.createdAt,
        permission: d.devInvitesAccepted[0]?.permission ?? 'LIMITED',
        invitedBy: d.devInvitesAccepted[0]?.invitedBy ?? null,
        joinedAt: d.devInvitesAccepted[0]?.acceptedAt ?? d.createdAt,
      })),
    };
  });

  /**
   * GET /admin/developers/invites
   * List pending invites
   */
  app.get('/invites', async () => {
    const invites = await app.prisma.developerInvite.findMany({
      where: { status: 'PENDING' },
      include: {
        invitedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { invites };
  });

  /**
   * POST /admin/developers/invite
   * Create an invite + send email
   */
  app.post('/invite', async (req, reply) => {
    const parsed = DeveloperInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message });
    }

    const { email, permission } = parsed.data;

    // Check if already a developer or admin
    const existingUser = await app.prisma.user.findUnique({ where: { email } });
    if (existingUser && (existingUser.role === 'DEVELOPER' || existingUser.role === 'ADMIN')) {
      return reply.code(409).send({ error: 'User already has developer or admin access' });
    }

    // Check for existing pending invite
    const existingInvite = await app.prisma.developerInvite.findFirst({
      where: { email, status: 'PENDING' },
    });
    if (existingInvite) {
      return reply.code(409).send({ error: 'A pending invite already exists for this email' });
    }

    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invite = await app.prisma.developerInvite.create({
      data: {
        email,
        token,
        permission: permission as any,
        invitedById: req.user.id,
        expiresAt,
      },
      include: {
        invitedBy: { select: { name: true, email: true } },
      },
    });

    // Send email
    if (app.emailService) {
      const baseUrl = process.env.FRONTEND_URL || 'https://mira-culture.com';
      await app.emailService.sendDeveloperInvite(email, {
        inviteLink: `${baseUrl}/dev-invite/${token}`,
        inviterName: req.user.email,
        permission,
      });
    }

    return reply.code(201).send(invite);
  });

  /**
   * DELETE /admin/developers/invites/:id
   * Cancel a pending invite
   */
  app.delete('/invites/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const invite = await app.prisma.developerInvite.findUnique({ where: { id } });
    if (!invite) {
      return reply.code(404).send({ error: 'Invite not found' });
    }
    if (invite.status !== 'PENDING') {
      return reply.code(400).send({ error: 'Can only cancel pending invites' });
    }

    await app.prisma.developerInvite.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return { success: true };
  });

  /**
   * POST /admin/developers/invites/:id/resend
   * Resend invite email + reset expiry
   */
  app.post('/invites/:id/resend', async (req, reply) => {
    const { id } = req.params as { id: string };

    const invite = await app.prisma.developerInvite.findUnique({ where: { id } });
    if (!invite) {
      return reply.code(404).send({ error: 'Invite not found' });
    }
    if (invite.status !== 'PENDING') {
      return reply.code(400).send({ error: 'Can only resend pending invites' });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    await app.prisma.developerInvite.update({
      where: { id },
      data: { expiresAt },
    });

    if (app.emailService) {
      const baseUrl = process.env.FRONTEND_URL || 'https://mira-culture.com';
      await app.emailService.sendDeveloperInvite(invite.email, {
        inviteLink: `${baseUrl}/dev-invite/${invite.token}`,
        inviterName: req.user.email,
        permission: invite.permission,
      });
    }

    return { success: true };
  });

  /**
   * PUT /admin/developers/:id/revoke
   * Demote developer back to FAN
   */
  app.put('/:id/revoke', async (req, reply) => {
    const { id } = req.params as { id: string };

    const user = await app.prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    if (user.role !== 'DEVELOPER') {
      return reply.code(400).send({ error: 'User is not a developer' });
    }

    await app.prisma.user.update({
      where: { id },
      data: { role: 'FAN' },
    });

    return { success: true };
  });
}
