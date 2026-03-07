/**
 * Event Ingestion Service
 * 
 * Orchestrates fetching, normalizing, and storing external events
 */

import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import { TicketmasterClient, type TicketmasterConfig } from './ticketmaster.client.js';
import { EdmtrainClient, type EdmtrainConfig } from './edmtrain.client.js';
import { EventNormalizer, type NormalizedEvent } from './normalizer.js';

export interface IngestionConfig {
  ticketmaster?: TicketmasterConfig;
  edmtrain?: EdmtrainConfig;
}

export interface IngestionResult {
  source: string;
  success: boolean;
  eventsFound: number;
  eventsNew: number;
  eventsUpdated: number;
  errorMessage?: string;
}

export class EventIngestionService {
  private prisma: PrismaClient;
  private log: FastifyBaseLogger;
  private config: IngestionConfig;

  constructor(prisma: PrismaClient, log: FastifyBaseLogger, config: IngestionConfig) {
    this.prisma = prisma;
    this.log = log;
    this.config = config;
  }

  /**
   * Run full ingestion sync for all configured sources
   */
  async syncAll(): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];

    // Sync Ticketmaster
    if (this.config.ticketmaster) {
      const result = await this.syncTicketmaster();
      results.push(result);
    }

    // Sync EDMTrain
    if (this.config.edmtrain) {
      const result = await this.syncEdmtrain();
      results.push(result);
    }

    return results;
  }

  /**
   * Sync events from Ticketmaster
   */
  async syncTicketmaster(): Promise<IngestionResult> {
    const startedAt = new Date();
    const source = 'ticketmaster';

    this.log.info('Starting Ticketmaster sync');

    try {
      if (!this.config.ticketmaster) {
        throw new Error('Ticketmaster config not provided');
      }

      // Fetch events from Ticketmaster API
      const client = new TicketmasterClient(this.config.ticketmaster, this.log);
      const rawEvents = await client.fetchEvents();

      this.log.info(`Fetched ${rawEvents.length} events from Ticketmaster`);

      // Normalize events
      const normalizedEvents = rawEvents
        .map((event) => EventNormalizer.normalizeTicketmasterEvent(event))
        .filter((event) => EventNormalizer.isValid(event));

      this.log.info(`Normalized ${normalizedEvents.length} valid events`);

      // Store events in database
      const { newCount, updatedCount } = await this.storeEvents(normalizedEvents);

      const completedAt = new Date();

      // Log sync result
      await this.prisma.eventSyncLog.create({
        data: {
          source,
          status: 'success',
          eventsFound: rawEvents.length,
          eventsNew: newCount,
          eventsUpdated: updatedCount,
          startedAt,
          completedAt,
        },
      });

      this.log.info({
        source,
        found: rawEvents.length,
        new: newCount,
        updated: updatedCount,
      }, 'Ticketmaster sync complete');

      return {
        source,
        success: true,
        eventsFound: rawEvents.length,
        eventsNew: newCount,
        eventsUpdated: updatedCount,
      };
    } catch (error) {
      const completedAt = new Date();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.log.error({ error }, 'Ticketmaster sync failed');

      // Log failed sync
      await this.prisma.eventSyncLog.create({
        data: {
          source,
          status: 'failed',
          eventsFound: 0,
          eventsNew: 0,
          eventsUpdated: 0,
          errorMessage,
          startedAt,
          completedAt,
        },
      });

      return {
        source,
        success: false,
        eventsFound: 0,
        eventsNew: 0,
        eventsUpdated: 0,
        errorMessage,
      };
    }
  }

  /**
   * Sync events from EDMTrain
   */
  async syncEdmtrain(): Promise<IngestionResult> {
    const startedAt = new Date();
    const source = 'edmtrain';

    this.log.info('Starting EDMTrain sync');

    try {
      if (!this.config.edmtrain) {
        throw new Error('EDMTrain config not provided');
      }

      const client = new EdmtrainClient(this.config.edmtrain, this.log);
      const rawEvents = await client.fetchEvents();

      this.log.info(`Fetched ${rawEvents.length} events from EDMTrain`);

      const normalizedEvents = rawEvents
        .map((event) => EventNormalizer.normalizeEdmtrainEvent(event))
        .filter((event) => EventNormalizer.isValid(event));

      this.log.info(`Normalized ${normalizedEvents.length} valid events`);

      const { newCount, updatedCount } = await this.storeEvents(normalizedEvents);

      await this.prisma.eventSyncLog.create({
        data: {
          source,
          status: 'success',
          eventsFound: rawEvents.length,
          eventsNew: newCount,
          eventsUpdated: updatedCount,
          startedAt,
          completedAt: new Date(),
        },
      });

      this.log.info({ source, found: rawEvents.length, new: newCount, updated: updatedCount }, 'EDMTrain sync complete');

      return { source, success: true, eventsFound: rawEvents.length, eventsNew: newCount, eventsUpdated: updatedCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log.error({ error }, 'EDMTrain sync failed');

      await this.prisma.eventSyncLog.create({
        data: { source, status: 'failed', eventsFound: 0, eventsNew: 0, eventsUpdated: 0, errorMessage, startedAt, completedAt: new Date() },
      });

      return { source, success: false, eventsFound: 0, eventsNew: 0, eventsUpdated: 0, errorMessage };
    }
  }

  /**
   * Publish DISCOVERED external events into the main Event table.
   * Only publishes events where a REAL verified artist exists (matched by stage name).
   * Does NOT create placeholder users/artists — artists must register and verify via Spotify first.
   * Unmatched events stay as DISCOVERED in ExternalEvent for artists to claim later.
   */
  async publishExternalEvents(): Promise<{ published: number; skipped: number; awaitingArtist: number }> {
    const discovered = await this.prisma.externalEvent.findMany({
      where: { status: 'DISCOVERED', importedEventId: null },
      orderBy: { eventDate: 'asc' },
    });

    let published = 0;
    let skipped = 0;
    let awaitingArtist = 0;

    // Cache artist lookups by name
    const artistCache = new Map<string, string | null>();

    for (const ext of discovered) {
      try {
        // Skip events without coordinates
        if (ext.venueLat == null || ext.venueLng == null) {
          skipped++;
          continue;
        }

        // Look for a REAL (non-placeholder) artist matching this name
        const artistKey = ext.artistName.toLowerCase().trim();
        let artistId = artistCache.has(artistKey) ? artistCache.get(artistKey) : undefined;

        if (artistId === undefined) {
          const existing = await this.prisma.artist.findFirst({
            where: {
              stageName: { equals: ext.artistName, mode: 'insensitive' },
              isPlaceholder: false,
            },
          });
          artistId = existing?.id || null;
          artistCache.set(artistKey, artistId);
        }

        // No real artist registered yet — leave as DISCOVERED for later claiming
        if (!artistId) {
          awaitingArtist++;
          continue;
        }

        // Check for duplicate event (same title + date + venue)
        const existingEvent = await this.prisma.event.findFirst({
          where: {
            title: ext.title,
            date: ext.eventDate,
            venueName: ext.venueName,
          },
        });
        if (existingEvent) {
          await this.prisma.externalEvent.update({
            where: { id: ext.id },
            data: { status: 'PUBLISHED', importedEventId: existingEvent.id },
          });
          skipped++;
          continue;
        }

        // Determine ticket price — use min price from external data or default $25
        const ticketPriceCents = ext.minPriceCents || 2500;
        const isFestival = ext.category === 'Festival' || ext.title.toLowerCase().includes('festival');

        // Create event linked to the real artist
        const event = await this.prisma.event.create({
          data: {
            artistId,
            title: ext.title,
            description: null,
            venueName: ext.venueName,
            venueAddress: ext.venueAddress,
            venueLat: ext.venueLat,
            venueLng: ext.venueLng,
            venueCity: `${ext.venueCity}${ext.venueState ? `, ${ext.venueState}` : ''}`,
            date: ext.eventDate,
            ticketPriceCents,
            totalTickets: isFestival ? 500 : 200,
            localRadiusKm: 50,
            type: isFestival ? 'FESTIVAL' : 'SHOW',
            status: 'AWAITING_ARTIST',
          },
        });

        // Create raffle pool
        const drawTime = new Date(ext.eventDate);
        drawTime.setDate(drawTime.getDate() - 1);
        await this.prisma.rafflePool.create({
          data: { eventId: event.id, tierCents: 500, scheduledDrawTime: drawTime },
        });

        // Mark external event as published
        await this.prisma.externalEvent.update({
          where: { id: ext.id },
          data: { status: 'PUBLISHED', importedEventId: event.id },
        });

        published++;
      } catch (error) {
        this.log.error({ error, externalEventId: ext.id }, 'Failed to publish external event');
        skipped++;
      }
    }

    this.log.info({ published, skipped, awaitingArtist }, 'External event publishing complete');
    return { published, skipped, awaitingArtist };
  }

  /**
   * Store normalized events in database (upsert logic)
   */
  private async storeEvents(events: NormalizedEvent[]): Promise<{ newCount: number; updatedCount: number }> {
    let newCount = 0;
    let updatedCount = 0;

    for (const event of events) {
      try {
        // Check if event already exists
        const existing = await this.prisma.externalEvent.findUnique({
          where: {
            externalId_source: {
              externalId: event.externalId,
              source: event.source,
            },
          },
        });

        if (existing) {
          // Update existing event
          await this.prisma.externalEvent.update({
            where: { id: existing.id },
            data: {
              title: event.title,
              description: event.description,
              artistName: event.artistName,
              venueName: event.venueName,
              venueAddress: event.venueAddress,
              venueCity: event.venueCity,
              venueState: event.venueState,
              venueCountry: event.venueCountry,
              venueLat: event.venueLat,
              venueLng: event.venueLng,
              eventDate: event.eventDate,
              onSaleDate: event.onSaleDate,
              offSaleDate: event.offSaleDate,
              minPriceCents: event.minPriceCents,
              maxPriceCents: event.maxPriceCents,
              currency: event.currency,
              genre: event.genre,
              category: event.category,
              sourceUrl: event.sourceUrl,
              rawData: event.rawData,
              lastSyncedAt: new Date(),
            },
          });
          updatedCount++;
        } else {
          // Create new event
          await this.prisma.externalEvent.create({
            data: {
              externalId: event.externalId,
              source: event.source,
              sourceUrl: event.sourceUrl,
              title: event.title,
              description: event.description,
              artistName: event.artistName,
              venueName: event.venueName,
              venueAddress: event.venueAddress,
              venueCity: event.venueCity,
              venueState: event.venueState,
              venueCountry: event.venueCountry,
              venueLat: event.venueLat,
              venueLng: event.venueLng,
              eventDate: event.eventDate,
              onSaleDate: event.onSaleDate,
              offSaleDate: event.offSaleDate,
              minPriceCents: event.minPriceCents,
              maxPriceCents: event.maxPriceCents,
              currency: event.currency,
              genre: event.genre,
              category: event.category,
              rawData: event.rawData,
              status: 'DISCOVERED',
            },
          });
          newCount++;
        }
      } catch (error) {
        this.log.error({ error, event: event.externalId }, 'Failed to store event');
      }
    }

    return { newCount, updatedCount };
  }
}
