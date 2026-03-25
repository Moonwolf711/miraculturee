/**
 * User Preferences Service — AgentDB-powered preference tracking
 *
 * Learns from user behavior (supports, ticket purchases, raffle entries)
 * to build semantic preference profiles for personalized recommendations.
 *
 * Uses the "balanced" recipe: scalar quantization, 4x memory reduction, <100µs search.
 */

import { AgentDB } from 'agentdb';
import type { PrismaClient } from '@prisma/client';

let db: AgentDB | null = null;
let reasoning: any = null;

async function getDB(): Promise<{ db: AgentDB; reasoning: any }> {
  if (db && reasoning) return { db, reasoning };
  db = new AgentDB({
    dbPath: '.agentdb/user-preferences.db',
    dimension: 384, // MiniLM default
    maxElements: 100000,
  });
  await db.initialize();
  reasoning = db.getController('reasoning');
  return { db, reasoning };
}

// ── Preference Types ──

export interface PreferenceSignal {
  userId: string;
  type: 'support' | 'raffle_entry' | 'ticket_purchase' | 'event_view';
  artistName: string;
  genre: string | null;
  venueCity: string | null;
  amountCents?: number;
}

interface RecommendationResult {
  taskType: string;
  approach: string;
  successRate: number;
  metadata?: string;
  similarity?: number;
}

// ── Core Service ──

export class UserPreferencesService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Record a preference signal when a user takes an action.
   * Called after support purchases, raffle entries, ticket buys.
   */
  async recordPreference(signal: PreferenceSignal): Promise<void> {
    const { reasoning: rb } = await getDB();

    // Build descriptive text for embedding
    const description = [
      `User ${signal.type.replace('_', ' ')}`,
      signal.artistName,
      signal.genre,
      signal.venueCity,
      signal.amountCents ? `$${(signal.amountCents / 100).toFixed(2)}` : null,
    ].filter(Boolean).join(' | ');

    // Weight by action type (supports > tickets > raffle > views)
    const weights: Record<string, number> = {
      support: 1.0,
      ticket_purchase: 0.9,
      raffle_entry: 0.7,
      event_view: 0.3,
    };

    await rb.storePattern({
      taskType: `pref:${signal.userId}`,
      approach: description,
      successRate: weights[signal.type] ?? 0.5,
      tags: [signal.type, signal.genre, signal.venueCity].filter(Boolean) as string[],
      metadata: JSON.stringify({
        userId: signal.userId,
        type: signal.type,
        artistName: signal.artistName,
        genre: signal.genre,
        venueCity: signal.venueCity,
        amountCents: signal.amountCents,
        timestamp: Date.now(),
      }),
    });
  }

  /**
   * Get personalized event recommendations for a user.
   * Searches their preference profile against available events.
   */
  async getRecommendations(userId: string, limit = 10): Promise<RecommendationResult[]> {
    const { reasoning: rb } = await getDB();

    const profile = await this.buildUserProfile(userId);
    if (!profile) return [];

    const results = await rb.searchPatterns({
      task: profile,
      k: limit * 3,
    });

    // Deduplicate by artist
    const seen = new Set<string>();
    const filtered: RecommendationResult[] = [];

    for (const r of results) {
      const meta = r.metadata ? JSON.parse(r.metadata) : {};
      const key = meta.artistName ?? r.approach;
      if (!seen.has(key)) {
        seen.add(key);
        filtered.push(r);
      }
      if (filtered.length >= limit) break;
    }

    return filtered;
  }

  /**
   * Find users with similar taste to a given user (for social features).
   */
  async findSimilarFans(userId: string, limit = 5): Promise<string[]> {
    const { reasoning: rb } = await getDB();
    const profile = await this.buildUserProfile(userId);
    if (!profile) return [];

    const results = await rb.searchPatterns({
      task: profile,
      k: limit * 5,
    });

    const userIds = new Set<string>();
    for (const r of results) {
      const meta = r.metadata ? JSON.parse(r.metadata) : {};
      if (meta.userId && meta.userId !== userId) {
        userIds.add(meta.userId);
      }
      if (userIds.size >= limit) break;
    }

    return Array.from(userIds);
  }

  /**
   * Get top genres for a user based on their preference history.
   */
  async getTopGenres(userId: string): Promise<Array<{ genre: string; count: number; weight: number }>> {
    const { reasoning: rb } = await getDB();

    const results = await rb.searchPatterns({
      task: `User preferences genres ${userId}`,
      k: 50,
    });

    const genreMap = new Map<string, { count: number; weight: number }>();

    for (const r of results) {
      const meta = r.metadata ? JSON.parse(r.metadata) : {};
      if (meta.userId === userId && meta.genre) {
        const existing = genreMap.get(meta.genre);
        if (existing) {
          existing.count++;
          existing.weight += r.successRate;
        } else {
          genreMap.set(meta.genre, { count: 1, weight: r.successRate });
        }
      }
    }

    return Array.from(genreMap.entries())
      .map(([genre, data]) => ({ genre, ...data }))
      .sort((a, b) => b.weight - a.weight);
  }

  /**
   * Sync a user's existing activity from Prisma into AgentDB.
   * Call once per user to bootstrap their preference profile.
   */
  async syncUserHistory(userId: string): Promise<number> {
    let count = 0;

    const supports = await this.prisma.supportTicket.findMany({
      where: { userId, confirmed: true },
      select: {
        totalAmountCents: true,
        event: {
          select: {
            artist: { select: { stageName: true, genre: true } },
            venueCity: true,
          },
        },
      },
    });

    for (const s of supports) {
      await this.recordPreference({
        userId,
        type: 'support',
        artistName: s.event.artist.stageName,
        genre: s.event.artist.genre,
        venueCity: s.event.venueCity,
        amountCents: s.totalAmountCents,
      });
      count++;
    }

    const raffles = await this.prisma.raffleEntry.findMany({
      where: { userId },
      select: {
        pool: {
          select: {
            tierCents: true,
            event: {
              select: {
                artist: { select: { stageName: true, genre: true } },
                venueCity: true,
              },
            },
          },
        },
      },
    });

    for (const r of raffles) {
      await this.recordPreference({
        userId,
        type: 'raffle_entry',
        artistName: r.pool.event.artist.stageName,
        genre: r.pool.event.artist.genre,
        venueCity: r.pool.event.venueCity,
        amountCents: r.pool.tierCents,
      });
      count++;
    }

    const tickets = await this.prisma.directTicket.findMany({
      where: { ownerId: userId, status: { not: 'REFUNDED' } },
      select: {
        priceCents: true,
        event: {
          select: {
            artist: { select: { stageName: true, genre: true } },
            venueCity: true,
          },
        },
      },
    });

    for (const t of tickets) {
      await this.recordPreference({
        userId,
        type: 'ticket_purchase',
        artistName: t.event.artist.stageName,
        genre: t.event.artist.genre,
        venueCity: t.event.venueCity,
        amountCents: t.priceCents,
      });
      count++;
    }

    return count;
  }

  // ── Private ──

  private async buildUserProfile(userId: string): Promise<string | null> {
    const supports = await this.prisma.supportTicket.findMany({
      where: { userId, confirmed: true },
      select: {
        event: {
          select: {
            artist: { select: { stageName: true, genre: true } },
            venueCity: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (supports.length === 0) return null;

    const artists = supports.map(s => s.event.artist.stageName);
    const genres = [...new Set(supports.map(s => s.event.artist.genre).filter(Boolean))];
    const cities = [...new Set(supports.map(s => s.event.venueCity).filter(Boolean))];

    return `Fan interested in ${artists.join(', ')} | genres: ${genres.join(', ')} | cities: ${cities.join(', ')}`;
  }
}
