import type { PrismaClient, Prisma } from '@prisma/client';

export class CreditsService {
  constructor(private prisma: PrismaClient) {}

  /** Get a user's current credits balance in cents. */
  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { creditsBalanceCents: true },
    });
    return user?.creditsBalanceCents ?? 0;
  }

  /**
   * Convert a donation amount to credits when a campaign fails to reach its goal.
   * Called for each donor when campaign enters RAFFLE_MODE.
   */
  async convertDonationToCredits(
    userId: string,
    amountCents: number,
    metadata: { campaignId: string; eventId: string },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: userId },
        data: { creditsBalanceCents: { increment: amountCents } },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'CREDIT_CONVERSION',
          amountCents,
          status: 'completed',
          metadata: {
            reason: 'campaign_goal_not_reached',
            ...metadata,
          },
        },
      });

      await tx.notification.create({
        data: {
          userId,
          title: 'Donation Converted to Credits',
          body: `Your $${(amountCents / 100).toFixed(2)} donation has been converted to platform credits since the campaign didn't reach its goal. Use credits toward any show or to support another artist.`,
          metadata: { type: 'credit_conversion', ...metadata },
        },
      });
    });
  }

  /**
   * Spend credits toward a purchase (ticket, support, or raffle entry).
   * Returns the amount actually deducted (may be less than requested if balance is insufficient).
   */
  async spendCredits(
    userId: string,
    amountCents: number,
    metadata: { type: string; eventId?: string; [key: string]: any },
  ): Promise<{ deductedCents: number; remainingBalanceCents: number }> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditsBalanceCents: true },
      });
      if (!user) throw new Error('User not found');

      const deductedCents = Math.min(amountCents, user.creditsBalanceCents);
      if (deductedCents <= 0) {
        return { deductedCents: 0, remainingBalanceCents: user.creditsBalanceCents };
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { creditsBalanceCents: { decrement: deductedCents } },
        select: { creditsBalanceCents: true },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'CREDIT_SPEND',
          amountCents: deductedCents,
          status: 'completed',
          metadata,
        },
      });

      return { deductedCents, remainingBalanceCents: updated.creditsBalanceCents };
    });
  }

  /**
   * Convert all donors' contributions to credits for a failed campaign.
   * Called when campaign transitions to RAFFLE_MODE (goal not reached in time).
   */
  async convertCampaignDonationsToCredits(campaignId: string): Promise<{ converted: number; totalCents: number }> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { event: true },
    });
    if (!campaign) return { converted: 0, totalCents: 0 };

    // Find all confirmed support tickets (donations) for this event
    const supportTickets = await this.prisma.supportTicket.findMany({
      where: { eventId: campaign.eventId, confirmed: true },
    });

    let converted = 0;
    let totalCents = 0;

    for (const ticket of supportTickets) {
      await this.convertDonationToCredits(ticket.userId, ticket.totalAmountCents, {
        campaignId,
        eventId: campaign.eventId,
      });
      converted++;
      totalCents += ticket.totalAmountCents;
    }

    return { converted, totalCents };
  }

  /** Get credit transaction history for a user. */
  async getHistory(userId: string, limit = 20, offset = 0) {
    return this.prisma.transaction.findMany({
      where: {
        userId,
        type: { in: ['CREDIT_CONVERSION', 'CREDIT_SPEND'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}
