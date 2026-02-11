## Event Ingestion System - Setup Instructions

### Overview

This automated system fetches events from Ticketmaster (and future sources) and stores them in your MiraCulture database with face-value pricing and direct purchase links.

---

## Step 1: Get Ticketmaster API Key

1. **Register at Ticketmaster Developer Portal**
   - Go to: https://developer.ticketmaster.com/
   - Click "Get Your API Key" or "Sign Up"
   - Fill out the registration form

2. **Get Your API Key**
   - After registration, go to your dashboard
   - Copy your **Consumer Key** (this is your API key)
   - Format: `xxxxxxxxxxxxxxxxxxxxxxxx` (24 characters)

3. **Note the Rate Limits**
   - 5,000 API calls per day
   - 5 requests per second
   - The system is configured to respect these limits

---

## Step 2: Add Environment Variables

Add these variables to your Railway environment (or `.env` file for local development):

```bash
# Ticketmaster API
TICKETMASTER_API_KEY=your_ticketmaster_api_key_here

# Optional: Configure sync behavior
EVENT_SYNC_ENABLED=true
EVENT_SYNC_INTERVAL_HOURS=6
```

### In Railway:
1. Go to your API service in Railway
2. Click "Variables" tab
3. Add `TICKETMASTER_API_KEY` with your key
4. Click "Deploy" to apply changes

---

## Step 3: Run Database Migration

The new database schema includes `ExternalEvent` and `EventSyncLog` tables.

```bash
# Navigate to API directory
cd apps/api

# Generate Prisma client with new schema
npx prisma generate

# Create and run migration
npx prisma migrate dev --name add_external_events

# For production (Railway)
npx prisma migrate deploy
```

---

## Step 4: Register Admin Routes

Add the new admin routes to your API server.

**Edit `apps/api/src/server.ts`:**

```typescript
// Add this import near the top
import externalEventsRoutes from './routes/admin/external-events.js';

// Add this route registration (after other admin routes)
app.register(externalEventsRoutes, { prefix: '/admin/external-events' });
```

---

## Step 5: Test the System

### Manual Sync (First Test)

Trigger a manual sync to test the integration:

```bash
curl -X POST https://miracultureeapi-production-cca9.up.railway.app/admin/external-events/sync
```

**Expected Response:**
```json
{
  "success": true,
  "results": [
    {
      "source": "ticketmaster",
      "success": true,
      "eventsFound": 850,
      "eventsNew": 850,
      "eventsUpdated": 0
    }
  ]
}
```

### View External Events

```bash
curl https://miracultureeapi-production-cca9.up.railway.app/admin/external-events?limit=10
```

### View Sync Logs

```bash
curl https://miracultureeapi-production-cca9.up.railway.app/admin/external-events/sync-logs
```

---

## Step 6: Set Up Automated Syncs

### Option A: Railway Cron Jobs (Recommended)

Railway supports cron jobs for scheduled tasks.

**Create `railway.toml` in your project root:**

```toml
[build]
builder = "nixpacks"

[[services]]
name = "api"

  [[services.cron]]
  schedule = "0 */6 * * *"  # Every 6 hours
  command = "node -e \"fetch('http://localhost:3000/admin/external-events/sync', {method: 'POST'})\""
```

### Option B: Node-Cron (Alternative)

Install node-cron:

```bash
cd apps/api
npm install node-cron
npm install --save-dev @types/node-cron
```

**Create `apps/api/src/cron.ts`:**

```typescript
import cron from 'node-cron';
import type { FastifyInstance } from 'fastify';

export function setupCronJobs(app: FastifyInstance) {
  if (process.env.EVENT_SYNC_ENABLED !== 'true') {
    app.log.info('Event sync cron jobs disabled');
    return;
  }

  const intervalHours = parseInt(process.env.EVENT_SYNC_INTERVAL_HOURS || '6');
  
  // Run every X hours
  const cronExpression = `0 */${intervalHours} * * *`;
  
  cron.schedule(cronExpression, async () => {
    app.log.info('Running scheduled event sync');
    
    try {
      // Trigger sync via internal API call
      await fetch('http://localhost:3000/admin/external-events/sync', {
        method: 'POST',
      });
      
      app.log.info('Scheduled event sync completed');
    } catch (error) {
      app.log.error({ error }, 'Scheduled event sync failed');
    }
  });

  app.log.info(`Event sync cron job scheduled: ${cronExpression}`);
}
```

**Update `apps/api/src/server.ts`:**

```typescript
import { setupCronJobs } from './cron.js';

// After server is ready
await app.ready();
setupCronJobs(app);
```

---

## Step 7: Monitor the System

### Check Sync Logs

View recent syncs in the database:

```sql
SELECT * FROM "EventSyncLog" ORDER BY "startedAt" DESC LIMIT 10;
```

### Check External Events

```sql
SELECT 
  source, 
  status, 
  COUNT(*) as count 
FROM "ExternalEvent" 
GROUP BY source, status;
```

### Monitor API Usage

The system logs API calls and respects rate limits. Check your Ticketmaster dashboard for usage stats.

---

## Configuration Options

### Geographic Targeting

Edit `apps/api/src/routes/admin/external-events.ts` to change target markets:

```typescript
{
  ticketmaster: {
    apiKey: ticketmasterApiKey,
    countryCode: 'US',
    classificationName: 'music',
    daysAhead: 90,
    dmaIds: ['751', '803', '501', '602'], // Denver, LA, NY, Chicago
  },
}
```

**Common DMA IDs:**
- Denver: 751
- Los Angeles: 803
- New York: 501
- Chicago: 602
- San Francisco: 807
- Seattle: 819
- Austin: 635
- Nashville: 659

### Sync Frequency

Adjust how often syncs run:

- **Every 6 hours** (default): `0 */6 * * *`
- **Every 12 hours**: `0 */12 * * *`
- **Daily at 3 AM**: `0 3 * * *`
- **Every hour**: `0 * * * *`

---

## Troubleshooting

### "TICKETMASTER_API_KEY not configured"

- Ensure the environment variable is set in Railway
- Restart the API service after adding the variable

### "Invalid ApiKey" from Ticketmaster

- Double-check your API key is correct
- Ensure there are no extra spaces or quotes
- Verify your Ticketmaster account is active

### No events found

- Check that your target markets have events
- Try removing `dmaIds` filter to search nationwide
- Verify the date range (default: next 90 days)

### Rate limit exceeded

- The system is designed to stay under limits
- If you hit limits, reduce sync frequency
- Consider targeting fewer markets per sync

### Database errors

- Ensure migrations ran successfully
- Check Prisma client is regenerated: `npx prisma generate`
- Verify PostgreSQL connection

---

## Next Steps

### Phase 1: Verify Data (Week 1)
1. Run manual sync
2. Check external events in database
3. Verify pricing and links are correct
4. Monitor sync logs for errors

### Phase 2: Build Admin UI (Week 2)
1. Create admin page to view external events
2. Add filters (city, date, genre)
3. Add "Import" button to convert to Event
4. Show sync status and logs

### Phase 3: Auto-Import (Week 3)
1. Define rules for auto-importing events
2. Match external events to existing artists
3. Create Event records automatically
4. Set up notifications for new shows

### Phase 4: Expand Sources (Week 4)
1. Add Eventbrite API integration
2. Add Bandsintown for artist tour dates
3. Consider venue-specific scrapers
4. Implement deduplication across sources

---

## API Endpoints Reference

### Trigger Sync
```
POST /admin/external-events/sync
```

### List External Events
```
GET /admin/external-events?source=ticketmaster&status=DISCOVERED&city=Denver&limit=50&offset=0
```

### Get Event Details
```
GET /admin/external-events/:id
```

### View Sync Logs
```
GET /admin/external-events/sync-logs?source=ticketmaster&limit=20
```

---

## Support

For issues or questions:
1. Check Railway logs for errors
2. Review Ticketmaster API documentation
3. Check database for sync logs
4. Verify environment variables are set

---

## Security Notes

- **Never commit API keys** to git
- Store keys in Railway secrets/environment variables
- Add authentication to admin routes before production
- Rate limit admin endpoints to prevent abuse
- Monitor API usage to avoid unexpected charges (though Ticketmaster API is free)
