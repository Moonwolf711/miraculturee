import type { PrismaClient } from '@prisma/client';
import type { ArtistDashboard, PayoutSummary, CampaignEarnings, PayoutRecord } from '@miraculturee/shared';
import { computeArtistProgression, PLATFORM_FEE_PERCENT } from '@miraculturee/shared';
import type { POSClient } from '@miraculturee/pos';

export class ArtistService {
  constructor(private prisma: PrismaClient, private pos?: POSClient) {}

  async getDashboard(userId: string): Promise<ArtistDashboard> {
    const artist = await this.prisma.artist.findUnique({
      where: { userId },
      include: {
        events: {
          include: {
            artist: true,
            supportTickets: { where: { confirmed: true } },
            rafflePools: { include: { entries: true } },
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!artist) {
      throw Object.assign(new Error('Artist profile not found'), { statusCode: 404 });
    }

    const totalSupport = artist.events.reduce(
      (sum, e) => sum + e.supportTickets.reduce((s, t) => s + t.ticketCount, 0),
      0,
    );

    const totalSupportAmountCents = artist.events.reduce(
      (sum, e) => sum + e.supportTickets.reduce((s, t) => s + t.totalAmountCents, 0),
      0,
    );

    const totalRaffleEntries = artist.events.reduce(
      (sum, e) => sum + e.rafflePools.reduce((s, p) => s + p.entries.length, 0),
      0,
    );

    const upcomingEvents = artist.events
      .filter((e) => e.date > new Date() && e.status === 'PUBLISHED')
      .map((e) => ({
        id: e.id,
        title: e.title,
        artistName: artist.stageName,
        venueName: e.venueName,
        venueCity: e.venueCity,
        date: e.date.toISOString(),
        ticketPriceCents: e.ticketPriceCents,
        totalTickets: e.totalTickets,
        supportedTickets: e.supportTickets.reduce((s, t) => s + t.ticketCount, 0),
        type: e.type,
        status: e.status,
        genre: artist.genre ?? null,
      }));

    // Count campaigns that reached their goal for progression
    const successfulCampaigns = await this.prisma.campaign.count({
      where: { artistId: artist.id, goalReached: true },
    });
    const prog = computeArtistProgression(successfulCampaigns);

    return {
      totalEvents: artist.events.length,
      totalSupport,
      totalSupportAmountCents,
      totalRaffleEntries,
      upcomingEvents,
      currentLevel: prog.currentLevel,
      tierWithinLevel: prog.tierWithinLevel,
      maxTicketsForLevel: prog.maxTicketsForLevel,
      nextLevelTickets: prog.nextLevelTickets,
      canLevelUp: prog.canLevelUp,
      isMaxed: prog.isMaxed,
      totalTiersCompleted: prog.totalTiersCompleted,
      totalTiersRequired: prog.totalTiersRequired,
      discountCents: prog.discountCents,
    };
  }

  async getEarnings(userId: string) {
    const artist = await this.prisma.artist.findUnique({ where: { userId } });
    if (!artist) {
      throw Object.assign(new Error('Artist profile not found'), { statusCode: 404 });
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        type: 'ARTIST_PAYOUT',
        metadata: { path: ['artistId'], equals: artist.id },
      },
      orderBy: { createdAt: 'desc' },
    });

    const supportIncome = await this.prisma.supportTicket.aggregate({
      where: { event: { artistId: artist.id }, confirmed: true },
      _sum: { totalAmountCents: true },
    });

    return {
      totalEarningsCents: supportIncome._sum.totalAmountCents ?? 0,
      payouts: transactions.map((t) => ({
        id: t.id,
        amountCents: t.amountCents,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  async getPayoutSummary(userId: string): Promise<PayoutSummary> {
    const artist = await this.prisma.artist.findUnique({ where: { userId } });
    if (!artist) {
      throw Object.assign(new Error('Artist profile not found'), { statusCode: 404 });
    }

    // Load Connect account status
    const connectAccount = await this.prisma.connectedAccount.findFirst({
      where: { userId },
    });
    let connectAccountStatus: 'none' | 'pending' | 'ready' = 'none';
    if (connectAccount) {
      connectAccountStatus = connectAccount.onboardingComplete && connectAccount.paymentsEnabled
        ? 'ready' : 'pending';
    }

    // Load all campaigns with their events
    const campaigns = await this.prisma.campaign.findMany({
      where: { artistId: artist.id },
      include: { event: { select: { id: true, title: true, date: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Load all ARTIST_PAYOUT transactions for this artist
    const allPayouts = await this.prisma.transaction.findMany({
      where: {
        type: 'ARTIST_PAYOUT',
        metadata: { path: ['artistId'], equals: artist.id },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build per-campaign earnings
    const campaignEarnings: CampaignEarnings[] = campaigns.map((c) => {
      const donationRevenue = c.fundedCents;
      const platformFeeCents = Math.floor(donationRevenue * PLATFORM_FEE_PERCENT);
      const artistEarningsCents = donationRevenue - platformFeeCents;

      // Sum payouts for this campaign
      const paidOutCents = allPayouts
        .filter((t) => {
          const meta = t.metadata as Record<string, unknown> | null;
          return meta?.campaignId === c.id;
        })
        .reduce((sum, t) => sum + t.amountCents, 0);

      const availableCents = Math.max(0, artistEarningsCents - paidOutCents);
      const eventPassed = c.event.date < new Date();
      const campaignEnded = c.status === 'ENDED' || eventPassed;

      let eligible = true;
      let eligibilityReason: string | undefined;
      if (!campaignEnded) {
        eligible = false;
        eligibilityReason = 'Campaign has not ended yet';
      } else if (donationRevenue <= 0) {
        eligible = false;
        eligibilityReason = 'No donations received';
      } else if (connectAccountStatus !== 'ready') {
        eligible = false;
        eligibilityReason = connectAccountStatus === 'none'
          ? 'Set up Stripe Connect to receive payouts'
          : 'Complete Stripe Connect onboarding';
      } else if (availableCents <= 0) {
        eligible = false;
        eligibilityReason = 'Already fully paid out';
      }

      return {
        campaignId: c.id,
        eventTitle: c.event.title,
        eventDate: c.event.date.toISOString(),
        campaignStatus: c.status as CampaignEarnings['campaignStatus'],
        fundedCents: donationRevenue,
        platformFeeCents,
        artistEarningsCents,
        paidOutCents,
        availableCents,
        eligible,
        eligibilityReason,
      };
    });

    // Build payout history with event title lookup
    const campaignById = new Map(campaigns.map((c) => [c.id, c]));
    const payoutHistory: PayoutRecord[] = allPayouts.map((t) => {
      const meta = t.metadata as Record<string, unknown> | null;
      const campId = (meta?.campaignId as string) ?? null;
      const camp = campId ? campaignById.get(campId) : undefined;
      return {
        id: t.id,
        campaignId: campId,
        eventTitle: camp?.event.title ?? 'Unknown',
        amountCents: t.amountCents,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      };
    });

    const totalEarningsCents = campaignEarnings.reduce((s, c) => s + c.artistEarningsCents, 0);
    const totalPaidOutCents = campaignEarnings.reduce((s, c) => s + c.paidOutCents, 0);
    const totalAvailableCents = campaignEarnings.reduce((s, c) => s + c.availableCents, 0);

    return {
      totalEarningsCents,
      totalPaidOutCents,
      totalAvailableCents,
      connectAccountStatus,
      campaigns: campaignEarnings,
      payoutHistory,
    };
  }

  async requestPayout(userId: string, campaignId: string) {
    if (!this.pos) {
      throw Object.assign(new Error('Payment system unavailable'), { statusCode: 503 });
    }

    const artist = await this.prisma.artist.findUnique({ where: { userId } });
    if (!artist) {
      throw Object.assign(new Error('Artist profile not found'), { statusCode: 404 });
    }

    // Verify artist owns the campaign
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, artistId: artist.id },
      include: { event: { select: { id: true, title: true, date: true } } },
    });
    if (!campaign) {
      throw Object.assign(new Error('Campaign not found'), { statusCode: 404 });
    }

    // Validate campaign ended or event passed
    const eventPassed = campaign.event.date < new Date();
    if (campaign.status !== 'ENDED' && !eventPassed) {
      throw Object.assign(new Error('Campaign has not ended yet'), { statusCode: 400 });
    }

    if (campaign.fundedCents <= 0) {
      throw Object.assign(new Error('No donations to pay out'), { statusCode: 400 });
    }

    // Validate Connect account
    const connectAccount = await this.prisma.connectedAccount.findFirst({
      where: { userId },
    });
    if (!connectAccount || !connectAccount.onboardingComplete || !connectAccount.paymentsEnabled) {
      throw Object.assign(new Error('Stripe Connect account not ready'), { statusCode: 400 });
    }

    // Calculate available amount
    const donationRevenue = campaign.fundedCents;
    const platformFeeCents = Math.floor(donationRevenue * PLATFORM_FEE_PERCENT);
    const artistEarningsCents = donationRevenue - platformFeeCents;

    const priorPayouts = await this.prisma.transaction.aggregate({
      where: {
        type: 'ARTIST_PAYOUT',
        metadata: { path: ['campaignId'], equals: campaignId },
      },
      _sum: { amountCents: true },
    });
    const alreadyPaid = priorPayouts._sum.amountCents ?? 0;
    const availableCents = artistEarningsCents - alreadyPaid;

    if (availableCents <= 0) {
      throw Object.assign(new Error('No funds available for payout'), { statusCode: 400 });
    }

    // Execute Stripe transfer
    const transfer = await this.pos.payoutToArtist(
      availableCents,
      connectAccount.stripeAccountId,
      campaign.event.id,
    );

    // Record the transaction
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'ARTIST_PAYOUT',
        amountCents: availableCents,
        posReference: transfer.id,
        status: 'completed',
        metadata: {
          campaignId,
          eventId: campaign.event.id,
          artistId: artist.id,
        },
      },
    });

    return {
      id: transaction.id,
      campaignId,
      eventTitle: campaign.event.title,
      amountCents: availableCents,
      status: transaction.status,
      createdAt: transaction.createdAt.toISOString(),
    };
  }
}
