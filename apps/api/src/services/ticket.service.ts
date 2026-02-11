import type { PrismaClient } from '@prisma/client';
import type { POSClient } from '@miraculturee/pos';
import type { TicketPurchaseResult } from '@miraculturee/shared';
import { isDirectSalesOpen } from '@miraculturee/shared';
import { calculateDynamicFee } from './event.service.js';

export class TicketService {
  constructor(
    private prisma: PrismaClient,
    private pos: POSClient,
  ) {}

  async purchase(
    userId: string,
    eventId: string,
    ipAddress: string | undefined,
    deviceFingerprint: string | undefined,
  ): Promise<TicketPurchaseResult> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw Object.assign(new Error('Event not found'), { statusCode: 404 });
    }
    if (event.status !== 'PUBLISHED') {
      throw Object.assign(new Error('Event is not accepting ticket purchases'), { statusCode: 400 });
    }
    if (!isDirectSalesOpen(event.date)) {
      throw Object.assign(
        new Error('Direct ticket sales have closed. Remaining tickets will be available via raffle.'),
        { statusCode: 400 },
      );
    }

    // 1-per-user: DB unique constraint check
    const existing = await this.prisma.directTicket.findUnique({
      where: { eventId_ownerId: { eventId, ownerId: userId } },
    });
    if (existing) {
      throw Object.assign(new Error('You already have a ticket for this event'), { statusCode: 409 });
    }

    // 1-per-user: IP address check
    if (ipAddress) {
      const ipDuplicate = await this.prisma.directTicket.findFirst({
        where: { eventId, ipAddress, status: { not: 'REFUNDED' } },
      });
      if (ipDuplicate) {
        throw Object.assign(
          new Error('A ticket has already been purchased from this network for this event'),
          { statusCode: 409 },
        );
      }
    }

    // 1-per-user: device fingerprint check
    if (deviceFingerprint) {
      const fpDuplicate = await this.prisma.directTicket.findFirst({
        where: { eventId, deviceFingerprint, status: { not: 'REFUNDED' } },
      });
      if (fpDuplicate) {
        throw Object.assign(
          new Error('A ticket has already been purchased from this device for this event'),
          { statusCode: 409 },
        );
      }
    }

    const priceCents = event.ticketPriceCents;
    const feeCents = await calculateDynamicFee(this.prisma, eventId, event.totalTickets);
    const totalCents = priceCents + feeCents;

    // Create direct ticket record
    const ticket = await this.prisma.directTicket.create({
      data: {
        eventId,
        ownerId: userId,
        priceCents,
        feeCents,
        ipAddress,
        deviceFingerprint,
      },
    });

    // Create POS payment
    const payment = await this.pos.createPayment({
      amountCents: totalCents,
      currency: 'usd',
      metadata: {
        type: 'ticket_purchase',
        ticketId: ticket.id,
        eventId,
        userId,
      },
    });

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        userId,
        type: 'TICKET_PURCHASE',
        amountCents: totalCents,
        stripePaymentId: payment.id,
        posReference: ticket.id,
        status: 'pending',
      },
    });

    return {
      id: ticket.id,
      eventId,
      priceCents,
      feeCents,
      totalCents,
      clientSecret: payment.clientSecret,
    };
  }

  /** Called after Stripe webhook confirms payment */
  async confirmPurchase(ticketId: string, stripePaymentId: string): Promise<void> {
    await this.prisma.directTicket.update({
      where: { id: ticketId },
      data: { status: 'CONFIRMED', stripePaymentId },
    });

    // Update transaction status
    await this.prisma.transaction.updateMany({
      where: { posReference: ticketId, type: 'TICKET_PURCHASE' },
      data: { status: 'completed', stripePaymentId },
    });

    // Create in-app notification
    const ticket = await this.prisma.directTicket.findUnique({
      where: { id: ticketId },
      include: { event: { select: { title: true } } },
    });
    if (ticket) {
      await this.prisma.notification.create({
        data: {
          userId: ticket.ownerId,
          title: 'Ticket Confirmed',
          body: `Your ticket for ${ticket.event.title} has been confirmed. See you there!`,
          metadata: { eventId: ticket.eventId, ticketId },
        },
      });
    }
  }
}
