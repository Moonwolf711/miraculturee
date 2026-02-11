import type { PrismaClient, Prisma } from '@prisma/client';
import type { EventSummary, EventDetail, PaginatedResponse } from '@miraculturee/shared';
import type { POSClient } from '@miraculturee/pos';
import {
  haversineDistanceKm,
  PROCESSING_FEE_MIN_CENTS,
  PROCESSING_FEE_MAX_CENTS,
  PLATFORM_FEE_PERCENT,
} from '@miraculturee/shared';
import { schedulePreEventTicketPurchase } from '../jobs/workers.js';

/**
 * Compute demand-based processing fee using a sigmoid curve.
 * $5 at low demand → $10 at high demand, ramping around 60% capacity.
 */
export async function calculateDynamicFee(
  prisma: PrismaClient,
  eventId: string,
  totalCapacity: number,
): Promise<number> {
  const soldCount = await prisma.directTicket.count({
    where: { eventId, status: { in: ['CONFIRMED', 'REDEEMED'] } },
  });
  const demandRatio = totalCapacity > 0 ? soldCount / totalCapacity : 0;
  const sigmoid = 1 / (1 + Math.exp(-10 * (demandRatio - 0.6)));
  const fee = PROCESSING_FEE_MIN_CENTS + sigmoid * (PROCESSING_FEE_MAX_CENTS - PROCESSING_FEE_MIN_CENTS);
  return Math.round(fee);
}

export class EventService {
  constructor(
    private prisma: PrismaClient,
    private pos?: POSClient,
  ) {}

  async create(artistId: string, data: {
    title: string;
    description?: string;
    venueName: string;
    venueAddress: string;
    venueLat: number;
    venueLng: number;
    date: string;
    ticketPriceCents: number;
    totalTickets: number;
    localRadiusKm: number;
  }): Promise<EventDetail> {
    const event = await this.prisma.event.create({
      data: {
        artistId,
        title: data.title,
        description: data.description,
        venueName: data.venueName,
        venueAddress: data.venueAddress,
        venueLat: data.venueLat,
        venueLng: data.venueLng,
        date: new Date(data.date),
        ticketPriceCents: data.ticketPriceCents,
        totalTickets: data.totalTickets,
        localRadiusKm: data.localRadiusKm,
        status: 'PUBLISHED',
      },
      include: { artist: true },
    });

    // Auto-create $5 raffle pool for MVP
    const drawTime = new Date(event.date);
    drawTime.setDate(drawTime.getDate() - 1);

    await this.prisma.rafflePool.create({
      data: {
        eventId: event.id,
        tierCents: 500,
        scheduledDrawTime: drawTime,
      },
    });

    // Schedule pre-event automated ticket purchase (runs 24h before show)
    await schedulePreEventTicketPurchase(event.id, event.date);

    return this.getById(event.id) as Promise<EventDetail>;
  }

  async search(params: {
    city?: string;
    artistName?: string;
    type?: string;
    page: number;
    limit: number;
  }): Promise<PaginatedResponse<EventSummary>> {
    const where: Prisma.EventWhereInput = {
      status: 'PUBLISHED',
      date: { gte: new Date() },
    };

    if (params.type) {
      where.type = params.type as any;
    }
    if (params.city) {
      where.venueCity = { contains: params.city, mode: 'insensitive' };
    }
    if (params.artistName) {
      where.artist = { stageName: { contains: params.artistName, mode: 'insensitive' } };
    }

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: { artist: true, supportTickets: { where: { confirmed: true } } },
        orderBy: { date: 'asc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data: events.map((e) => this.toSummary(e)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async nearby(params: {
    lat: number;
    lng: number;
    radiusKm: number;
    page: number;
    limit: number;
  }): Promise<PaginatedResponse<EventSummary>> {
    // Fetch all published future events, then filter by distance
    const events = await this.prisma.event.findMany({
      where: { status: 'PUBLISHED', date: { gte: new Date() } },
      include: { artist: true, supportTickets: { where: { confirmed: true } } },
      orderBy: { date: 'asc' },
    });

    const nearby = events.filter(
      (e) => haversineDistanceKm(params.lat, params.lng, e.venueLat, e.venueLng) <= params.radiusKm,
    );

    const paginated = nearby.slice((params.page - 1) * params.limit, params.page * params.limit);

    return {
      data: paginated.map((e) => this.toSummary(e)),
      total: nearby.length,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(nearby.length / params.limit),
    };
  }

  async getById(id: string): Promise<EventDetail | null> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        artist: true,
        supportTickets: { where: { confirmed: true } },
        rafflePools: {
          include: { entries: true },
        },
      },
    });

    if (!event) return null;

    const supportedTickets = event.supportTickets.reduce((sum, s) => sum + s.ticketCount, 0);
    const availableTickets = await this.prisma.poolTicket.count({
      where: { eventId: id, status: 'AVAILABLE' },
    });
    const currentProcessingFeeCents = await calculateDynamicFee(this.prisma, id, event.totalTickets);

    return {
      id: event.id,
      title: event.title,
      artistName: event.artist.stageName,
      venueName: event.venueName,
      venueCity: event.venueCity,
      date: event.date.toISOString(),
      ticketPriceCents: event.ticketPriceCents,
      totalTickets: event.totalTickets,
      supportedTickets,
      type: event.type,
      status: event.status,
      description: event.description,
      venueAddress: event.venueAddress,
      venueLat: event.venueLat,
      venueLng: event.venueLng,
      localRadiusKm: event.localRadiusKm,
      currentProcessingFeeCents,
      rafflePools: event.rafflePools.map((p) => ({
        id: p.id,
        tierCents: p.tierCents,
        status: p.status,
        availableTickets,
        totalEntries: p.entries.length,
        drawTime: p.scheduledDrawTime?.toISOString() ?? null,
      })),
    };
  }

  /**
   * When an event sells out, pay surplus donation funds to the artist
   * minus the platform fee (2.5%).
   */
  async processSurplusPayout(eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { artist: true },
    });
    if (!event) return;

    // Total confirmed donation funds
    const supportTickets = await this.prisma.supportTicket.findMany({
      where: { eventId, confirmed: true },
    });
    const totalDonationFunds = supportTickets.reduce((sum, st) => sum + st.totalAmountCents, 0);

    // Tickets bought from the pool (each costs ticketPriceCents)
    const poolTicketCount = await this.prisma.poolTicket.count({
      where: { eventId },
    });
    const fundsUsedForTickets = poolTicketCount * event.ticketPriceCents;
    const surplusCents = totalDonationFunds - fundsUsedForTickets;

    if (surplusCents <= 0) return;
    if (!event.artist.stripeAccountId) return;
    if (!this.pos) return;

    const artistPayoutCents = Math.floor(surplusCents * (1 - PLATFORM_FEE_PERCENT));

    await this.pos.payoutToArtist(artistPayoutCents, event.artist.stripeAccountId, eventId);

    await this.prisma.transaction.create({
      data: {
        userId: event.artist.userId,
        type: 'ARTIST_PAYOUT',
        amountCents: artistPayoutCents,
        posReference: eventId,
        status: 'completed',
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: event.artist.userId,
        title: 'Surplus Payout',
        body: `Your event "${event.title}" sold out! You received a surplus payout of $${(artistPayoutCents / 100).toFixed(2)}.`,
        metadata: { eventId, payoutCents: artistPayoutCents },
      },
    });
  }

  private toSummary(event: any): EventSummary {
    const supportedTickets = (event.supportTickets ?? []).reduce(
      (sum: number, s: any) => sum + s.ticketCount,
      0,
    );
    return {
      id: event.id,
      title: event.title,
      artistName: event.artist?.stageName ?? '',
      venueName: event.venueName,
      venueCity: event.venueCity,
      date: event.date.toISOString(),
      ticketPriceCents: event.ticketPriceCents,
      totalTickets: event.totalTickets,
      supportedTickets,
      type: event.type,
      status: event.status,
    };
  }
}
