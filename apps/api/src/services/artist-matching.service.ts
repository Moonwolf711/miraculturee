import type { PrismaClient } from '@prisma/client';

export interface MatchedEvent {
  eventId: string;
  title: string;
  venueName: string;
  venueCity: string;
  date: string;
  ticketPriceCents: number;
  totalTickets: number;
  placeholderArtistId: string;
  confidence: number; // 0-1
}

/**
 * Matches a verified artist's name against placeholder artists
 * and their AWAITING_ARTIST events.
 */
export class ArtistMatchingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find events whose placeholder artist stageName matches the given name.
   * Also checks ExternalEvent.artistName for comma-separated multi-artist events.
   */
  async findMatchingEvents(
    artistName: string,
    realArtistId: string,
  ): Promise<MatchedEvent[]> {
    const normalizedName = artistName.trim().toLowerCase();
    if (!normalizedName) return [];

    // 1. Find placeholder artists with matching stageNames
    const placeholderArtists = await this.prisma.artist.findMany({
      where: {
        isPlaceholder: true,
        stageName: { equals: artistName, mode: 'insensitive' },
      },
      select: { id: true, stageName: true },
    });

    const placeholderIds = placeholderArtists.map((a) => a.id);

    // 2. Find AWAITING_ARTIST events belonging to those placeholder artists
    const directMatches = placeholderIds.length > 0
      ? await this.prisma.event.findMany({
          where: {
            artistId: { in: placeholderIds },
            status: 'AWAITING_ARTIST',
            date: { gte: new Date() },
          },
          include: { artist: true },
        })
      : [];

    // 3. Also check ExternalEvent.artistName for multi-artist comma-separated names
    const externalMatches = await this.prisma.externalEvent.findMany({
      where: {
        status: { in: ['PUBLISHED', 'IMPORTED'] },
        importedEventId: { not: null },
        artistName: { contains: artistName, mode: 'insensitive' },
      },
      select: { importedEventId: true },
    });

    const externalEventIds = externalMatches
      .map((e) => e.importedEventId)
      .filter((id): id is string => id != null);

    const externalEvents = externalEventIds.length > 0
      ? await this.prisma.event.findMany({
          where: {
            id: { in: externalEventIds },
            status: 'AWAITING_ARTIST',
            date: { gte: new Date() },
            // Don't include events already owned by the real artist
            artistId: { not: realArtistId },
          },
          include: { artist: true },
        })
      : [];

    // Merge, dedupe by event ID
    const seenIds = new Set<string>();
    const results: MatchedEvent[] = [];

    for (const event of directMatches) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      results.push({
        eventId: event.id,
        title: event.title,
        venueName: event.venueName,
        venueCity: event.venueCity,
        date: event.date.toISOString(),
        ticketPriceCents: event.ticketPriceCents,
        totalTickets: event.totalTickets,
        placeholderArtistId: event.artistId,
        confidence: this.computeConfidence(normalizedName, event.artist.stageName),
      });
    }

    for (const event of externalEvents) {
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      results.push({
        eventId: event.id,
        title: event.title,
        venueName: event.venueName,
        venueCity: event.venueCity,
        date: event.date.toISOString(),
        ticketPriceCents: event.ticketPriceCents,
        totalTickets: event.totalTickets,
        placeholderArtistId: event.artistId,
        confidence: 0.7, // Lower confidence for multi-artist external matches
      });
    }

    // Sort by confidence desc, then date asc
    results.sort((a, b) => b.confidence - a.confidence || new Date(a.date).getTime() - new Date(b.date).getTime());

    return results;
  }

  private computeConfidence(queryName: string, stageName: string): number {
    const a = queryName.toLowerCase().trim();
    const b = stageName.toLowerCase().trim();
    if (a === b) return 1.0;
    if (a.includes(b) || b.includes(a)) return 0.85;
    return 0.5;
  }
}
