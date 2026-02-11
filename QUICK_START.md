# Event Ingestion System - Quick Start Guide

## 🚀 Get Started in 5 Steps

### Step 1: Get Ticketmaster API Key (5 minutes)

1. Go to https://developer.ticketmaster.com/
2. Click "Get Your API Key"
3. Register with your email
4. Copy your **Consumer Key** (24-character string)

---

### Step 2: Configure Railway (2 minutes)

1. Open your Railway dashboard
2. Go to **miracultureeapi** service
3. Click **Variables** tab
4. Add these variables:

```
TICKETMASTER_API_KEY=paste_your_key_here
EVENT_SYNC_ENABLED=true
EVENT_SYNC_INTERVAL_HOURS=6
EVENT_SYNC_ON_STARTUP=false
```

5. Click **Deploy** to apply changes

---

### Step 3: Run Database Migration (3 minutes)

**Option A: Via Railway CLI**
```bash
railway run npx prisma migrate deploy
```

**Option B: Via Local Terminal**
```bash
cd apps/api
npx prisma generate
npx prisma migrate dev --name add_external_events
```

---

### Step 4: Update Server Code (2 minutes)

**Edit `apps/api/src/server.ts`:**

Add these imports at the top:
```typescript
import externalEventsRoutes from './routes/admin/external-events.js';
import { setupCronJobs } from './cron.js';
```

Add route registration (after other routes):
```typescript
app.register(externalEventsRoutes, { prefix: '/admin/external-events' });
```

Add cron setup (after `app.listen()`):
```typescript
setupCronJobs(app);
```

Commit and push:
```bash
git add apps/api/src/server.ts
git commit -m "Register event ingestion routes and cron jobs"
git push origin master
```

---

### Step 5: Test It! (1 minute)

**Trigger manual sync:**
```bash
curl -X POST https://miracultureeapi-production-cca9.up.railway.app/admin/external-events/sync
```

**Expected response:**
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

**View events:**
```bash
curl "https://miracultureeapi-production-cca9.up.railway.app/admin/external-events?limit=5"
```

---

## ✅ You're Done!

The system will now automatically sync events every 6 hours.

---

## 📊 What Happens Next?

### Automatic Syncs
- Runs every 6 hours (configurable)
- Fetches new events from Ticketmaster
- Updates existing events if changed
- Logs all sync activity

### Data Available
- 500-1000 events per sync
- Face-value pricing
- Direct purchase links
- Venue coordinates
- Genre/category info

---

## 🔧 Common Commands

### View Recent Events
```bash
curl "https://miracultureeapi-production-cca9.up.railway.app/admin/external-events?city=Denver&limit=10"
```

### Check Sync Logs
```bash
curl "https://miracultureeapi-production-cca9.up.railway.app/admin/external-events/sync-logs?limit=5"
```

### View Specific Event
```bash
curl "https://miracultureeapi-production-cca9.up.railway.app/admin/external-events/{event-id}"
```

---

## 🎯 Next Steps

### Week 1: Verify Data
- [ ] Check external events in database
- [ ] Verify pricing looks correct
- [ ] Test direct purchase links
- [ ] Monitor sync logs for errors

### Week 2: Build Admin UI
- [ ] Create admin page to view events
- [ ] Add filters (city, date, genre)
- [ ] Add "Import to Event" button
- [ ] Show sync status dashboard

### Week 3: Auto-Import
- [ ] Match external events to artists
- [ ] Auto-create Event records
- [ ] Set up user notifications

### Week 4: Expand Sources
- [ ] Add Eventbrite integration
- [ ] Add Bandsintown for tour dates
- [ ] Consider venue-specific scrapers

---

## 🐛 Troubleshooting

### "TICKETMASTER_API_KEY not configured"
- Check Railway environment variables
- Restart API service after adding variable

### "Invalid ApiKey" error
- Verify API key is correct (24 characters)
- Check for extra spaces or quotes
- Confirm Ticketmaster account is active

### No events found
- Check target markets have events
- Try removing `dmaIds` filter (search nationwide)
- Verify date range (default: next 90 days)

### Database errors
- Run `npx prisma generate`
- Run `npx prisma migrate deploy`
- Check PostgreSQL connection

---

## 📚 Full Documentation

For detailed information, see:
- **Setup Instructions**: `SETUP_INSTRUCTIONS.md`
- **Architecture**: `event_ingestion_architecture.md`
- **API Research**: `ticketing_api_research.md`
- **Summary**: `event_ingestion_summary.md`

---

## 🎉 Success!

Your MiraCulture app now automatically discovers events from Ticketmaster with face-value pricing and direct links to prevent scalping!
