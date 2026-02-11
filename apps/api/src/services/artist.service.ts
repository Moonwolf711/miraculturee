import type { PrismaClient } from '@prisma/client';
import type { ArtistDashboard } from '@miraculturee/shared';

export class ArtistService {
  constructor(private prisma: PrismaClient) {}

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
      }));

    return {
      totalEvents: artist.events.length,
      totalSupport,
      totalSupportAmountCents,
      totalRaffleEntries,
      upcomingEvents,
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
}
