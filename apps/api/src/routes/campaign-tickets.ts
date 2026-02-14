import type { FastifyInstance } from 'fastify';
import { UuidParamSchema } from '@miraculturee/shared';
import { z } from 'zod';

const LocalTicketBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export async function campaignTicketRoutes(app: FastifyInstance) {
  /** POST /campaign-tickets/:id/local — purchase a discounted local ticket */
  app.post('/:id/local', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id: campaignId } = UuidParamSchema.parse(req.params);
    const { lat, lng } = LocalTicketBodySchema.parse(req.body);
    const ip = req.ip;

    // Load campaign with event
    const campaign = await app.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { event: true },
    });
    if (!campaign) return reply.code(404).send({ error: 'Campaign not found' });
    if (campaign.status !== 'ACTIVE') {
      return reply.code(400).send({ error: 'Campaign is not active' });
    }
    if (!campaign.goalReached) {
      return reply.code(400).send({ error: 'Campaign goal has not been reached yet' });
    }

    // Check max local tickets sold for this campaign
    const soldCount = await app.prisma.directTicket.count({
      where: {
        eventId: campaign.eventId,
        priceCents: campaign.discountCents,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
    if (soldCount >= campaign.maxLocalTickets) {
      return reply.code(400).send({ error: 'All discounted local tickets have been claimed' });
    }

    // Prevent duplicate purchase per user per campaign
    const existingTicket = await app.prisma.directTicket.findFirst({
      where: {
        eventId: campaign.eventId,
        ownerId: req.user.id,
        priceCents: campaign.discountCents,
      },
    });
    if (existingTicket) {
      return reply.code(400).send({ error: 'You already have a discounted ticket for this event' });
    }

    // VPN check
    const vpnCheck = await app.vpnDetection.checkIP(ip);
    if (vpnCheck.isVPN || vpnCheck.isProxy || vpnCheck.isTor) {
      await app.prisma.suspiciousActivity.create({
        data: {
          userId: req.user.id,
          type: vpnCheck.isTor ? 'TOR_DETECTED' : vpnCheck.isVPN ? 'VPN_DETECTED' : 'PROXY_DETECTED',
          ip,
          riskScore: vpnCheck.riskScore,
          metadata: vpnCheck as any,
        },
      });
      return reply.code(403).send({ error: 'VPN, proxy, or Tor connections are not allowed for local ticket purchases.' });
    }

    // Geo-verification
    const geoCheck = await app.geoVerification.verifyLocation(lat, lng, ip);
    if (!geoCheck.verified) {
      await app.prisma.suspiciousActivity.create({
        data: {
          userId: req.user.id,
          type: 'GEO_MISMATCH',
          ip,
          riskScore: Math.min(Math.floor(geoCheck.discrepancyKm), 100),
          metadata: geoCheck as any,
        },
      });
      return reply.code(403).send({
        error: `Location verification failed. Your IP is ${geoCheck.discrepancyKm.toFixed(0)}km from your reported location.`,
      });
    }

    // Create POS payment for discounted ticket
    const payment = await app.pos.createPayment({
      amountCents: campaign.discountCents,
      currency: 'usd',
      metadata: {
        type: 'local_ticket',
        campaignId,
        eventId: campaign.eventId,
        userId: req.user.id,
      },
    });

    // Create direct ticket record
    const ticket = await app.prisma.directTicket.create({
      data: {
        eventId: campaign.eventId,
        ownerId: req.user.id,
        priceCents: campaign.discountCents,
        feeCents: 0,
        ipAddress: ip,
      },
    });

    // Create transaction
    await app.prisma.transaction.create({
      data: {
        userId: req.user.id,
        type: 'LOCAL_TICKET',
        amountCents: campaign.discountCents,
        stripePaymentId: payment.id,
        posReference: ticket.id,
        status: 'pending',
      },
    });

    // Match with oldest unmatched donor connection for this event
    let connectionId: string | undefined;
    const donorConnection = await app.prisma.donorConnection.findFirst({
      where: { eventId: campaign.eventId, matched: false },
      orderBy: { createdAt: 'asc' },
    });
    if (donorConnection) {
      await app.prisma.donorConnection.update({
        where: { id: donorConnection.id },
        data: { receiverUserId: req.user.id, matched: true, matchedAt: new Date() },
      });
      connectionId = donorConnection.id;

      // Notify donor
      await app.prisma.notification.create({
        data: {
          userId: donorConnection.donorUserId,
          title: 'Your gift was received!',
          body: 'A local fan claimed the ticket you donated. They can choose to connect with you.',
          metadata: { connectionId: donorConnection.id, type: 'donor_matched' },
        },
      });
      // Notify receiver
      await app.prisma.notification.create({
        data: {
          userId: req.user.id,
          title: 'Your supporter wants to connect!',
          body: 'The fan who donated your ticket would like to connect. You can exchange socials or stay anonymous.',
          metadata: { connectionId: donorConnection.id, type: 'receiver_can_choose' },
        },
      });
    }

    return reply.code(201).send({
      ticketId: ticket.id,
      priceCents: campaign.discountCents,
      clientSecret: payment.clientSecret,
      connectionId,
    });
  });
}
