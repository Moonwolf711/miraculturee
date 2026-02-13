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
