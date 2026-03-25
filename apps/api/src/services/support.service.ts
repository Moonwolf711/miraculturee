import type { PrismaClient } from '@prisma/client';
import type { POSClient } from '@miraculturee/pos';
import type { SupportPurchaseResult } from '@miraculturee/shared';
import { SUPPORT_FEE_PER_TICKET_CENTS } from '@miraculturee/shared';
import { CampaignStateMachineService } from './campaign-state-machine.service.js';
import { UserPreferencesService } from './user-preferences.service.js';

export class SupportService {
  constructor(
    private prisma: PrismaClient,
    private pos: POSClient,
  ) {}

  async purchase(
    userId: string,
    eventId: string,
    ticketCount: number,
    message?: string,
    optInConnection?: boolean,
    socials?: { instagram?: string; twitter?: string },
  ): Promise<SupportPurchaseResult> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw Object.assign(new Error('Event not found'), { statusCode: 404 });
    }
    if (event.status !== 'PUBLISHED') {
      throw Object.assign(new Error('Event is not accepting support'), { statusCode: 400 });
    }
    if (event.ticketPriceCents === 0) {
      throw Object.assign(new Error('Ticket pricing not yet available for this event'), { statusCode: 400 });
    }

    const totalAmountCents = (event.ticketPriceCents + SUPPORT_FEE_PER_TICKET_CENTS) * ticketCount;

    // Create support ticket record
    const supportTicket = await this.prisma.supportTicket.create({
      data: {
        eventId,
        userId,
        ticketCount,
        totalAmountCents,
        message,
      },
    });

    // Create DonorConnection records if donor opted in (one per ticket)
    if (optInConnection) {
      const connections = Array.from({ length: ticketCount }, () => ({
        eventId,
        donorUserId: userId,
        ...(socials ? { donorSocials: socials } : {}),
      }));
      await this.prisma.donorConnection.createMany({ data: connections });
    }

    // Create POS payment
    const payment = await this.pos.createPayment({
      amountCents: totalAmountCents,
      currency: 'usd',
      metadata: {
        type: 'support_purchase',
        supportTicketId: supportTicket.id,
        eventId,
        userId,
      },
    });

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        userId,
        type: 'SUPPORT_PURCHASE',
        amountCents: totalAmountCents,
        stripePaymentId: payment.id,
        posReference: supportTicket.id,
        status: 'pending',
      },
    });

    return {
      id: supportTicket.id,
      eventId,
      ticketCount,
      totalAmountCents,
      clientSecret: payment.clientSecret,
    };
  }

  /** Called after Stripe webhook confirms payment */
  async confirmPurchase(supportTicketId: string, stripePaymentId: string): Promise<void> {
    const supportTicket = await this.prisma.supportTicket.update({
      where: { id: supportTicketId },
      data: { confirmed: true, stripePaymentId },
    });

    // Create pool tickets (1 per ticket purchased)
    const poolTickets = Array.from({ length: supportTicket.ticketCount }, () => ({
      eventId: supportTicket.eventId,
      supportTicketId: supportTicket.id,
    }));

    await this.prisma.poolTicket.createMany({ data: poolTickets });

    // Update transaction status
    await this.prisma.transaction.updateMany({
      where: { posReference: supportTicketId },
      data: { status: 'completed', stripePaymentId },
    });

    // Record preference signal for AgentDB
    const eventWithArtist = await this.prisma.event.findUnique({
      where: { id: supportTicket.eventId },
      include: { artist: { select: { stageName: true, genre: true } } },
    });
    if (eventWithArtist) {
      const prefs = new UserPreferencesService(this.prisma);
      prefs.recordPreference({
        userId: supportTicket.userId,
        type: 'support',
        artistName: eventWithArtist.artist.stageName,
        genre: eventWithArtist.artist.genre,
        venueCity: eventWithArtist.venueCity,
        amountCents: supportTicket.totalAmountCents,
      }).catch(() => {}); // Fire-and-forget, don't block the purchase flow
    }

    // Update campaign funding if there's an active campaign for this event
    const event = eventWithArtist;
    if (event) {
      const donationCents = event.ticketPriceCents * supportTicket.ticketCount;
      // Find campaign in any active lifecycle state (not just ACTIVE)
      const campaign = await this.prisma.campaign.findFirst({
        where: {
          eventId: supportTicket.eventId,
          status: { in: ['ACTIVE', 'GOAL_REACHED', 'TICKETS_OPEN', 'OVERFLOW'] },
        },
      });
      if (campaign) {
        const newFunded = campaign.fundedCents + donationCents;
        await this.prisma.campaign.update({
          where: { id: campaign.id },
          data: { fundedCents: newFunded },
        });

        // Let the state machine handle transitions
        const stateMachine = new CampaignStateMachineService(this.prisma);
        await stateMachine.onFundingUpdate(campaign.id, newFunded);
      }
    }
  }
}
