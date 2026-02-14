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
    q?: string;
    city?: string;
    artistName?: string;
    genre?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    lat?: number;
    lng?: number;
    sort?: string;
    page: number;
    limit: number;
  }): Promise<PaginatedResponse<EventSummary>> {
    const dateFilter: Prisma.DateTimeFilter = { gte: new Date() };
    if (params.dateFrom) dateFilter.gte = new Date(params.dateFrom);
    if (params.dateTo) dateFilter.lte = new Date(params.dateTo);

    const where: Prisma.EventWhereInput = {
      status: 'PUBLISHED',
      date: dateFilter,
    };

    if (params.type) {
      where.type = params.type as any;
    }
    if (params.q) {
      where.OR = [
        { title: { contains: params.q, mode: 'insensitive' } },
        { artist: { stageName: { contains: params.q, mode: 'insensitive' } } },
        { venueName: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    if (params.city) {
      where.venueCity = { contains: params.city, mode: 'insensitive' };
    }
    if (params.artistName) {
      where.artist = { stageName: { contains: params.artistName, mode: 'insensitive' } };
    }
    if (params.genre) {
      where.artist = { ...where.artist as any, genre: { contains: params.genre, mode: 'insensitive' } };
    }

    // Parse compound sort keys (e.g. "distance,popular,date")
    const sortKeys = (params.sort || 'date').split(',').filter(Boolean);
    const needsAppSort = sortKeys.includes('distance') || sortKeys.includes('popular');

    if (needsAppSort) {
      // Fetch all matching events, sort in-app, then paginate
      const [allEvents, total] = await Promise.all([
        this.prisma.event.findMany({
          where,
          include: { artist: true, supportTickets: { where: { confirmed: true } } },
        }),
        this.prisma.event.count({ where }),
      ]);

      const userLat = params.lat;
      const userLng = params.lng;
      const hasGeo = userLat != null && userLng != null;

      // Precompute values for sorting
      const distMap = new Map<string, number>();
      const supMap = new Map<string, number>();
      for (const e of allEvents) {
        if (hasGeo) {
          distMap.set(e.id, haversineDistanceKm(userLat!, userLng!, e.venueLat, e.venueLng));
        }
        supMap.set(e.id, e.supportTickets.reduce((s, t) => s + t.ticketCount, 0));
      }

      // Compound sort: apply each sort key in order as tiebreakers
      allEvents.sort((a, b) => {
        for (const key of sortKeys) {
          let cmp = 0;
          if (key === 'distance' && hasGeo) {
            cmp = (distMap.get(a.id) ?? 0) - (distMap.get(b.id) ?? 0);
          } else if (key === 'popular') {
            cmp = (supMap.get(b.id) ?? 0) - (supMap.get(a.id) ?? 0);
          } else if (key === 'date') {
            cmp = a.date.getTime() - b.date.getTime();
          }
          if (cmp !== 0) return cmp;
        }
        return 0;
      });

      const paginated = allEvents.slice((params.page - 1) * params.limit, params.page * params.limit);

      return {
        data: paginated.map((e) => this.toSummary(e)),
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
      };
    }

    // Default: sort by date asc with DB pagination
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
    // Bounding box pre-filter: convert radius to approximate lat/lng deltas
    // 1 degree latitude ≈ 111 km; longitude varies by cos(lat)
    const latDelta = params.radiusKm / 111;
    const lngDelta = params.radiusKm / (111 * Math.cos((params.lat * Math.PI) / 180));

    const events = await this.prisma.event.findMany({
      where: {
        status: 'PUBLISHED',
        date: { gte: new Date() },
        venueLat: { gte: params.lat - latDelta, lte: params.lat + latDelta },
        venueLng: { gte: params.lng - lngDelta, lte: params.lng + lngDelta },
      },
      include: { artist: true, supportTickets: { where: { confirmed: true } } },
      orderBy: { date: 'asc' },
    });

    // Precise Haversine filter on the reduced candidate set
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
    const [availableTickets, externalEvent, activeCampaigns] = await Promise.all([
      this.prisma.poolTicket.count({ where: { eventId: id, status: 'AVAILABLE' } }),
      this.prisma.externalEvent.findFirst({
        where: { importedEventId: id },
        select: { sourceUrl: true },
      }),
      this.prisma.campaign.findMany({
        where: { eventId: id, status: 'ACTIVE' },
        select: {
          id: true, headline: true, message: true,
          goalCents: true, fundedCents: true, goalReached: true,
          discountCents: true, maxLocalTickets: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);
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
      genre: event.artist.genre ?? null,
      description: event.description,
      venueAddress: event.venueAddress,
      venueLat: event.venueLat,
      venueLng: event.venueLng,
      localRadiusKm: event.localRadiusKm,
      currentProcessingFeeCents,
      sourceUrl: externalEvent?.sourceUrl ?? null,
      rafflePools: event.rafflePools.map((p) => ({
        id: p.id,
        tierCents: p.tierCents,
        status: p.status,
        availableTickets,
        totalEntries: p.entries.length,
        drawTime: p.scheduledDrawTime?.toISOString() ?? null,
      })),
      campaigns: activeCampaigns,
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
      genre: event.artist?.genre ?? null,
    };
  }
}
