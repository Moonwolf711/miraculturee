/**
 * Cron Job Setup for Event Ingestion
 * 
 * Automatically runs event syncs at configured intervals
 */

import type { FastifyInstance } from 'fastify';
import { EventIngestionService } from './services/event-ingestion/ingestion.service.js';

export function setupCronJobs(app: FastifyInstance) {
  const enabled = process.env.EVENT_SYNC_ENABLED === 'true';
  
  if (!enabled) {
    app.log.info('Event sync cron jobs disabled (EVENT_SYNC_ENABLED != true)');
    return;
  }

  const intervalHours = parseInt(process.env.EVENT_SYNC_INTERVAL_HOURS || '6');
  const intervalMs = intervalHours * 60 * 60 * 1000;

  app.log.info(`Event sync cron job enabled: every ${intervalHours} hours`);

  // Run sync function
  const runSync = async () => {
    app.log.info('Starting scheduled event sync');

    try {
      const ticketmasterApiKey = process.env.TICKETMASTER_API_KEY;
      const edmtrainApiKey = process.env.EDMTRAIN_API_KEY;

      if (!ticketmasterApiKey && !edmtrainApiKey) {
        app.log.error('No event API keys configured, skipping sync');
        return;
      }

      const ingestionService = new EventIngestionService(
        app.prisma,
        app.log,
        {
          ...(ticketmasterApiKey && {
            ticketmaster: {
              apiKey: ticketmasterApiKey,
              countryCode: 'US',
              classificationName: 'music',
              daysAhead: 90,
              dmaIds: ['751', '803', '501', '602'],
            },
          }),
          ...(edmtrainApiKey && {
            edmtrain: {
              clientKey: edmtrainApiKey,
              locationIds: [76, 70, 73, 71, 72, 87, 84, 102],
            },
          }),
        },
      );

      const results = await ingestionService.syncAll();

      // Auto-publish discovered events to main Event table
      const publishResult = await ingestionService.publishExternalEvents();

      app.log.info({ results, published: publishResult }, 'Scheduled event sync completed');
    } catch (error) {
      app.log.error({ error }, 'Scheduled event sync failed');
    }
  };

  // Run immediately on startup (optional)
  const runOnStartup = process.env.EVENT_SYNC_ON_STARTUP === 'true';
  if (runOnStartup) {
    app.log.info('Running initial event sync on startup');
    setTimeout(runSync, 5000); // Wait 5 seconds for server to be ready
  }

  // One-time reprice of events with bad/unknown pricing via Ticketmaster
  if (process.env.REPRICE_ON_STARTUP === 'true' && process.env.TICKETMASTER_API_KEY) {
    setTimeout(async () => {
      app.log.info('Starting one-time event reprice via Ticketmaster');
      try {
        const apiKey = process.env.TICKETMASTER_API_KEY!;
        const events = await app.prisma.event.findMany({
          where: {
            date: { gte: new Date() },
            priceSource: { not: 'ticketmaster' }, // Reprice anything not already from TM
          },
          include: { artist: { select: { stageName: true, isPlaceholder: true } } },
        });
        app.log.info(`Repricing ${events.length} events with bad pricing`);
        let updated = 0;
        for (const event of events) {
          await new Promise((r) => setTimeout(r, 260));
          const artistName = event.artist.isPlaceholder
            ? event.title.split(' at ')[0].split(' @ ')[0].split(' - ')[0].trim()
            : event.artist.stageName;
          const eventDate = new Date(event.date);
          const dayBefore = new Date(eventDate);
          dayBefore.setDate(dayBefore.getDate() - 1);
          const dayAfter = new Date(eventDate);
          dayAfter.setDate(dayAfter.getDate() + 1);
          const params = new URLSearchParams({
            apikey: apiKey,
            keyword: artistName.split(',')[0].trim(),
            size: '5',
            classificationName: 'music',
            startDateTime: dayBefore.toISOString().replace(/\.\d{3}Z$/, 'Z'),
            endDateTime: dayAfter.toISOString().replace(/\.\d{3}Z$/, 'Z'),
          });
          const city = event.venueCity.split(',')[0].trim();
          if (city) params.set('city', city);
          try {
            const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
            if (!res.ok) continue;
            const data = (await res.json()) as any;
            const tmEvents = data._embedded?.events ?? [];
            let matched: any = null;
            const kw = artistName.split(',')[0].trim().toLowerCase();
            for (const tm of tmEvents) {
              const tmA = (tm._embedded?.attractions?.[0]?.name ?? tm.name).toLowerCase();
              if (tmA.includes(kw) || kw.includes(tmA)) { matched = tm; break; }
            }
            if (!matched && tmEvents.length === 1 && tmEvents[0].priceRanges?.length) matched = tmEvents[0];
            if (matched?.priceRanges?.length) {
              const r = matched.priceRanges[0];
              const minC = Math.round(r.min * 100);
              const maxC = Math.round(r.max * 100);
              await app.prisma.event.update({
                where: { id: event.id },
                data: {
                  ticketPriceCents: minC,
                  maxPriceCents: maxC !== minC ? maxC : null,
                  priceSource: 'ticketmaster',
                  feesIncluded: false,
                },
              });
              updated++;
            }
          } catch { /* skip individual errors */ }
        }
        app.log.info(`Reprice complete: ${updated}/${events.length} events updated`);
      } catch (err) {
        app.log.error({ err }, 'Reprice on startup failed');
      }
    }, 10000);
  }

  // Schedule recurring syncs
  setInterval(runSync, intervalMs);

  app.log.info(`Next sync scheduled in ${intervalHours} hours`);
}
