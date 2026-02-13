import type { PrismaClient } from '@prisma/client';
import type { POSClient } from '@miraculturee/pos';

/**
 * Manages the real-world ticket acquisition flow:
 * 1. Fan pays on MiraCulture → funds land in Stripe
 * 2. System creates a Stripe Issuing virtual card
 * 3. Card is funded automatically from the Stripe balance
 * 4. Admin (or future automation) uses the card to purchase from the venue
 * 5. Acquisition is marked complete with confirmation reference
 */
export class TicketAcquisitionService {
  constructor(
    private prisma: PrismaClient,
    private pos: POSClient,
  ) {}

  /**
   * Create a new ticket acquisition request for an event.
   * Optionally creates a virtual card immediately.
   */
  async createAcquisition(params: {
    eventId: string;
    ticketCount: number;
    totalAmountCents: number;
    purchaseUrl?: string;
    cardholderId?: string;
  }) {
    const event = await this.prisma.event.findUnique({ where: { id: params.eventId } });
    if (!event) throw Object.assign(new Error('Event not found'), { statusCode: 404 });

    // Look up the EDMTrain source URL if not provided
    let purchaseUrl = params.purchaseUrl;
    if (!purchaseUrl) {
      const ext = await this.prisma.externalEvent.findFirst({
        where: {
          OR: [
            { importedEventId: params.eventId },
            { title: event.title, venueName: event.venueName },
          ],
        },
        select: { sourceUrl: true },
      });
      purchaseUrl = ext?.sourceUrl ?? undefined;
    }

    const acquisition = await this.prisma.ticketAcquisition.create({
      data: {
        eventId: params.eventId,
        ticketCount: params.ticketCount,
        totalAmountCents: params.totalAmountCents,
        purchaseUrl,
        status: 'PENDING',
      },
    });

    // Auto-create virtual card if cardholder ID is available
    if (params.cardholderId) {
      return this.createCardForAcquisition(acquisition.id, params.cardholderId);
    }

    return acquisition;
  }

  /**
   * Create a Stripe Issuing virtual card for a specific acquisition.
   * The card spending limit is set to the acquisition amount.
   */
  async createCardForAcquisition(acquisitionId: string, cardholderId: string) {
    const acquisition = await this.prisma.ticketAcquisition.findUnique({
      where: { id: acquisitionId },
    });
    if (!acquisition) throw Object.assign(new Error('Acquisition not found'), { statusCode: 404 });

    const card = await this.pos.createVirtualCard(cardholderId, acquisition.totalAmountCents);

    return this.prisma.ticketAcquisition.update({
      where: { id: acquisitionId },
      data: {
        stripeCardId: card.id,
        cardLast4: card.last4,
        status: 'CARD_CREATED',
      },
    });
  }

  /**
   * Get the full card details (number, exp, cvc) for an acquisition.
   * Used by admin to make the actual purchase on the venue's website.
   */
  async getCardDetailsForAcquisition(acquisitionId: string) {
    const acquisition = await this.prisma.ticketAcquisition.findUnique({
      where: { id: acquisitionId },
      include: { event: { select: { title: true, venueName: true, date: true } } },
    });
    if (!acquisition) throw Object.assign(new Error('Acquisition not found'), { statusCode: 404 });
    if (!acquisition.stripeCardId) {
      throw Object.assign(new Error('No card assigned to this acquisition'), { statusCode: 400 });
    }

    const card = await this.pos.getCardDetails(acquisition.stripeCardId);

    return {
      acquisition: {
        id: acquisition.id,
        eventId: acquisition.eventId,
        eventTitle: acquisition.event.title,
        venueName: acquisition.event.venueName,
        eventDate: acquisition.event.date,
        ticketCount: acquisition.ticketCount,
        totalAmountCents: acquisition.totalAmountCents,
        purchaseUrl: acquisition.purchaseUrl,
        status: acquisition.status,
      },
      card: {
        number: card.number,
        expMonth: card.expMonth,
        expYear: card.expYear,
        cvc: card.cvc,
        last4: card.last4,
      },
    };
  }

  /**
   * Mark an acquisition as complete after tickets have been purchased.
   * Freezes the virtual card to prevent further charges.
   */
  async completeAcquisition(acquisitionId: string, confirmationRef: string) {
    const acquisition = await this.prisma.ticketAcquisition.findUnique({
      where: { id: acquisitionId },
    });
    if (!acquisition) throw Object.assign(new Error('Acquisition not found'), { statusCode: 404 });

    // Freeze the card so it can't be used again
    if (acquisition.stripeCardId) {
      try {
        await this.pos.freezeCard(acquisition.stripeCardId);
      } catch {
        // Card may already be frozen — continue
      }
    }

    return this.prisma.ticketAcquisition.update({
      where: { id: acquisitionId },
      data: {
        status: 'COMPLETED',
        confirmationRef,
      },
    });
  }

  /**
   * Mark an acquisition as failed.
   */
  async failAcquisition(acquisitionId: string, errorMessage: string) {
    // Freeze the card
    const acquisition = await this.prisma.ticketAcquisition.findUnique({
      where: { id: acquisitionId },
    });
    if (acquisition?.stripeCardId) {
      try {
        await this.pos.freezeCard(acquisition.stripeCardId);
      } catch {
        // continue
      }
    }

    return this.prisma.ticketAcquisition.update({
      where: { id: acquisitionId },
      data: { status: 'FAILED', errorMessage },
    });
  }

  /**
   * List all acquisitions, optionally filtered by status.
   */
  async listAcquisitions(params: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (params.status) where.status = params.status;

    const [acquisitions, total] = await Promise.all([
      this.prisma.ticketAcquisition.findMany({
        where,
        include: {
          event: {
            select: { title: true, artistId: true, venueName: true, date: true, ticketPriceCents: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
      }),
      this.prisma.ticketAcquisition.count({ where }),
    ]);

    return { acquisitions, total };
  }

  /**
   * Get pending events that need ticket acquisitions.
   * These are events with confirmed support ticket funds but no acquisition yet.
   */
  async getPendingEvents() {
    const events = await this.prisma.event.findMany({
      where: {
        status: 'PUBLISHED',
        date: { gte: new Date() },
        supportTickets: { some: { confirmed: true } },
      },
      include: {
        supportTickets: { where: { confirmed: true } },
        ticketAcquisitions: true,
        _count: { select: { directTickets: { where: { status: { in: ['CONFIRMED', 'REDEEMED'] } } } } },
      },
    });

    return events
      .map((event) => {
        const totalFunded = event.supportTickets.reduce((s, t) => s + t.totalAmountCents, 0);
        const alreadyAcquired = event.ticketAcquisitions
          .filter((a) => a.status !== 'FAILED')
          .reduce((s, a) => s + a.ticketCount, 0);
        const ticketsFromFunds = Math.floor(totalFunded / event.ticketPriceCents);
        const remaining = ticketsFromFunds - alreadyAcquired;

        return {
          eventId: event.id,
          title: event.title,
          venueName: event.venueName,
          date: event.date.toISOString(),
          ticketPriceCents: event.ticketPriceCents,
          totalFundedCents: totalFunded,
          ticketsFromFunds,
          alreadyAcquired,
          remainingToAcquire: Math.max(0, remaining),
          directTicketsSold: event._count.directTickets,
        };
      })
      .filter((e) => e.remainingToAcquire > 0);
  }
}
