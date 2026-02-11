import type { PrismaClient } from '@prisma/client';
import { randomInt } from 'node:crypto';

interface EdmtrainVenue {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  location?: string;
}

interface EdmtrainArtist {
  name?: string;
}

interface EdmtrainEvent {
  id?: number;
  name?: string;
  date?: string;
  festivalInd?: boolean;
  venue?: EdmtrainVenue;
  artistList?: EdmtrainArtist[];
}

interface EdmtrainResponse {
  data?: EdmtrainEvent[];
  success?: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export class EdmtrainService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Fetch upcoming events from EDMTrain API and upsert into database.
   * Deduplicates by (title + venueName + date) composite.
   * Gracefully no-ops if EDMTRAIN_CLIENT_ID is not set.
   */
  async syncEvents(): Promise<{ created: number; skipped: number }> {
    const clientId = process.env.EDMTRAIN_CLIENT_ID;
    if (!clientId) {
      return { created: 0, skipped: 0 };
    }

    let events: EdmtrainEvent[];
    try {
      const res = await fetch(
        `https://edmtrain.com/api/events?client=${encodeURIComponent(clientId)}&festivalInd=false`,
      );
      if (!res.ok) {
        throw new Error(`EDMTrain API returned ${res.status}`);
      }
      const json = (await res.json()) as EdmtrainResponse;
      events = json.data ?? [];
    } catch (err) {
      console.error('[EdmtrainSync] Failed to fetch events:', (err as Error).message);
      return { created: 0, skipped: 0 };
    }

    let created = 0;
    let skipped = 0;

    for (const raw of events) {
      try {
        const artistName = raw.artistList?.[0]?.name ?? 'TBA';
        const venueName = raw.venue?.name ?? 'TBA';
        const eventDate = raw.date ? new Date(raw.date + 'T20:00:00Z') : null;

        if (!eventDate || isNaN(eventDate.getTime())) {
          skipped++;
          continue;
        }

        // Skip past events
        if (eventDate < new Date()) {
          skipped++;
          continue;
        }

        const title = raw.name || `${artistName} Live`;

        // Dedup check: same title + venue + date
        const exists = await this.prisma.event.findFirst({
          where: {
            title,
            venueName,
            date: eventDate,
          },
        });

        if (exists) {
          skipped++;
          continue;
        }

        // Find or create artist
        let artist = await this.prisma.artist.findFirst({
          where: { stageName: artistName },
        });

        if (!artist) {
          const slug = slugify(artistName) || 'unknown-artist';
          const user = await this.prisma.user.create({
            data: {
              email: `${slug}-${Date.now()}@edmtrain.miraculture.com`,
              passwordHash: 'edmtrain-managed',
              name: artistName,
              role: 'ARTIST',
            },
          });
          artist = await this.prisma.artist.create({
            data: {
              userId: user.id,
              stageName: artistName,
              genre: 'EDM',
            },
          });
        }

        // Random realistic pricing: $25 - $150 in $5 increments
        const ticketPrice = randomInt(5, 31) * 500;
        const totalTickets = randomInt(100, 501);

        const event = await this.prisma.event.create({
          data: {
            artistId: artist.id,
            title,
            venueName,
            venueAddress: raw.venue?.address ?? '',
            venueLat: raw.venue?.latitude ?? 0,
            venueLng: raw.venue?.longitude ?? 0,
            venueCity: raw.venue?.location ?? '',
            date: eventDate,
            ticketPriceCents: ticketPrice,
            totalTickets,
            type: raw.festivalInd ? 'FESTIVAL' : 'SHOW',
            status: 'PUBLISHED',
          },
        });

        // Create raffle pool — draw scheduled 24h before event
        await this.prisma.rafflePool.create({
          data: {
            eventId: event.id,
            tierCents: 500,
            status: 'OPEN',
            scheduledDrawTime: new Date(eventDate.getTime() - 86400000),
          },
        });

        created++;
      } catch (err) {
        // Log but continue with next event
        console.error('[EdmtrainSync] Error processing event:', (err as Error).message);
        skipped++;
      }
    }

    return { created, skipped };
  }
}
