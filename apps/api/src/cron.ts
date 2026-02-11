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
      
      if (!ticketmasterApiKey) {
        app.log.error('TICKETMASTER_API_KEY not configured, skipping sync');
        return;
      }

      const ingestionService = new EventIngestionService(
        app.prisma,
        app.log,
        {
          ticketmaster: {
            apiKey: ticketmasterApiKey,
            countryCode: 'US',
            classificationName: 'music',
            daysAhead: 90,
            // Denver, Los Angeles, New York, Chicago
            dmaIds: ['751', '803', '501', '602'],
          },
        },
      );

      const results = await ingestionService.syncAll();
      
      app.log.info({ results }, 'Scheduled event sync completed');
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

  // Schedule recurring syncs
  setInterval(runSync, intervalMs);
  
  app.log.info(`Next sync scheduled in ${intervalHours} hours`);
}
