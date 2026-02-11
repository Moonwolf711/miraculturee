# Automated Event Ingestion System Architecture

## System Overview

An automated service that continuously fetches events from major ticketing platforms and syncs them to the MiraCulture database, ensuring users always see the latest shows with face-value pricing and direct purchase links.

## Architecture Components

### 1. Event Ingestion Service (Node.js/TypeScript)

A standalone service within the MiraCulture API that handles:
- API integrations with ticketing platforms
- Event data normalization
- Deduplication logic
- Database synchronization

**Location**: `apps/api/src/services/event-ingestion/`

### 2. Data Sources

#### Primary Sources (API-based)
1. **Ticketmaster Discovery API**
   - Coverage: 230K+ events globally
   - Rate limit: 5,000 calls/day, 5 req/sec
   - Free with registration

2. **Eventbrite API**
   - Coverage: Global independent events
   - OAuth 2.0 authentication
   - Good for smaller venues/artists

#### Secondary Sources (Future)
3. **Bandsintown API** - Artist tour dates
4. **SeatGeek API** - Additional event discovery
5. **Venue-specific scrapers** - Red Rocks, AXS venues, etc.

### 3. Database Schema

#### New Table: `ExternalEvent`
```prisma
model ExternalEvent {
  id                String   @id @default(cuid())
  externalId        String   // ID from source platform
  source            String   // 'ticketmaster', 'eventbrite', etc.
  sourceUrl         String   // Direct purchase link
  
  // Event details
  title             String
  description       String?
  artistName        String
  artistId          String?  // Reference to Artist if matched
  
  // Venue details
  venueName         String
  venueAddress      String
  venueCity         String
  venueState        String?
  venueCountry      String
  venueLat          Float?
  venueLng          Float?
  venueId           String?  // Reference to Venue if matched
  
  // Timing
  eventDate         DateTime
  onSaleDate        DateTime?
  offSaleDate       DateTime?
  
  // Pricing
  minPriceCents     Int?
  maxPriceCents     Int?
  currency          String   @default("USD")
  
  // Classification
  genre             String?
  category          String?
  
  // Status
  status            String   @default("DISCOVERED") // DISCOVERED, IMPORTED, PUBLISHED, ARCHIVED
  importedEventId   String?  // Reference to Event if imported
  
  // Metadata
  rawData           Json     // Store full API response
  lastSyncedAt      DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([externalId, source])
  @@index([eventDate])
  @@index([venueCity, eventDate])
  @@index([status])
}
```

#### Sync Log Table
```prisma
model EventSyncLog {
  id            String   @id @default(cuid())
  source        String
  status        String   // 'success', 'partial', 'failed'
  eventsFound   Int
  eventsNew     Int
  eventsUpdated Int
  errorMessage  String?
  startedAt     DateTime
  completedAt   DateTime
  
  @@index([source, startedAt])
}
```

### 4. Ingestion Workflow

```
┌─────────────────────────────────────────────────┐
│  Scheduled Job (Cron / Railway)                 │
│  - Runs every 6 hours                           │
│  - Triggers ingestion for each source           │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Source-Specific Fetchers                       │
│  - TicketmasterFetcher                          │
│  - EventbriteFetcher                            │
│  - (Future: BandsintownFetcher, etc.)           │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Event Normalizer                               │
│  - Convert platform-specific format             │
│  - Extract: title, artist, venue, date, price   │
│  - Standardize data structure                   │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Deduplication Engine                           │
│  - Check if event already exists                │
│  - Match by: venue + date + artist              │
│  - Update if changed, skip if identical         │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Database Writer                                │
│  - Upsert to ExternalEvent table                │
│  - Log sync results to EventSyncLog             │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  (Optional) Auto-Import to Event Table          │
│  - For verified/popular artists                 │
│  - Create Event record with external source     │
│  - Link to ExternalEvent                        │
└─────────────────────────────────────────────────┘
```

### 5. API Endpoints for Admin

#### View External Events
```
GET /api/admin/external-events
- List all discovered events
- Filter by: source, status, date range, location
- Pagination support
```

#### Import External Event
```
POST /api/admin/external-events/:id/import
- Convert ExternalEvent → Event
- Create artist/venue if needed
- Set up ticket allocation
```

#### Sync Status
```
GET /api/admin/sync-status
- View recent sync logs
- Monitor API usage/rate limits
- Error reporting
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
1. Create database schema (ExternalEvent, EventSyncLog)
2. Build base ingestion service structure
3. Implement event normalizer
4. Create deduplication logic

### Phase 2: Ticketmaster Integration (Week 1-2)
1. Register for Ticketmaster API key
2. Implement TicketmasterFetcher
3. Focus on US music events initially
4. Test with Denver/Colorado market
5. Add error handling and retry logic

### Phase 3: Eventbrite Integration (Week 2)
1. Register for Eventbrite API
2. Implement EventbriteFetcher
3. Test with local independent events

### Phase 4: Automation & Monitoring (Week 2-3)
1. Set up scheduled jobs (Railway cron or node-cron)
2. Create admin dashboard endpoints
3. Add logging and alerting
4. Implement rate limit tracking

### Phase 5: Admin UI (Week 3)
1. Build admin page in web app
2. Display external events table
3. Add import button for each event
4. Show sync status and logs

## Configuration

### Environment Variables
```bash
# Ticketmaster
TICKETMASTER_API_KEY=your_api_key_here

# Eventbrite
EVENTBRITE_PRIVATE_TOKEN=your_token_here

# Sync Configuration
EVENT_SYNC_ENABLED=true
EVENT_SYNC_INTERVAL_HOURS=6
EVENT_SYNC_MARKETS=denver,los-angeles,new-york  # Comma-separated

# Rate Limiting
TICKETMASTER_MAX_REQUESTS_PER_DAY=5000
TICKETMASTER_MAX_REQUESTS_PER_SECOND=5
```

### Sync Strategy

#### Geographic Focus
Start with specific markets to conserve API calls:
- Denver (DMA ID: 751)
- Los Angeles (DMA ID: 803)
- New York (DMA ID: 501)
- Chicago (DMA ID: 602)

#### Date Range
- Fetch events from today to +90 days
- Update existing events within 30 days
- Archive events after they occur

#### Frequency
- **High priority** (events going on sale soon): Every 1 hour
- **Normal priority** (upcoming events): Every 6 hours
- **Low priority** (far future events): Every 24 hours

## Deduplication Logic

### Matching Algorithm
```typescript
function isDuplicate(newEvent: ExternalEvent, existingEvent: ExternalEvent): boolean {
  // 1. Exact external ID match (same source)
  if (newEvent.source === existingEvent.source && 
      newEvent.externalId === existingEvent.externalId) {
    return true;
  }
  
  // 2. Fuzzy match: venue + date + artist
  const venueMatch = similarity(newEvent.venueName, existingEvent.venueName) > 0.85;
  const dateMatch = isSameDay(newEvent.eventDate, existingEvent.eventDate);
  const artistMatch = similarity(newEvent.artistName, existingEvent.artistName) > 0.85;
  
  return venueMatch && dateMatch && artistMatch;
}
```

### Update Strategy
- If duplicate found: Update price, status, sourceUrl if changed
- If new event: Insert with status='DISCOVERED'
- If event passed: Update status='ARCHIVED'

## Face Value Pricing Strategy

### Ticketmaster API
- Use `priceRanges` field from event details
- Extract `min` and `max` values
- Store as `minPriceCents` and `maxPriceCents`

### Eventbrite API
- Use ticket class pricing
- Filter for face value (exclude VIP/premium if possible)
- Store lowest available price

### Display Strategy
- Show price range: "$50 - $100"
- Link directly to official source
- Add disclaimer: "Prices subject to change. Click to see current pricing."

## Direct Link Strategy

### Link Preservation
- Store official purchase URL in `sourceUrl`
- Never modify or affiliate-link the URL
- Display prominent "Buy Tickets" button linking directly

### Link Validation
- Periodically check if links are still active (404 check)
- Mark events as archived if link is dead
- Update URL if event moved (rare)

## Monitoring & Alerts

### Key Metrics
- Events discovered per sync
- API calls remaining (rate limits)
- Sync success rate
- Average sync duration
- Events imported vs discovered

### Alerts
- Sync failures (email/Slack notification)
- Rate limit approaching (80% of daily quota)
- Duplicate event spike (potential data issue)
- Zero events found (API issue)

## Security & Privacy

### API Key Management
- Store keys in environment variables
- Never commit keys to git
- Rotate keys periodically
- Use Railway secrets for production

### Data Privacy
- Store only public event data
- Don't scrape user data or personal info
- Respect robots.txt and terms of service
- Rate limit to avoid overloading APIs

## Future Enhancements

### Phase 2 Features
1. **Artist Matching**: Auto-link external events to existing Artist records
2. **Venue Matching**: Auto-link to existing Venue records
3. **Smart Import**: Auto-import events for verified artists
4. **Price Tracking**: Track price changes over time
5. **Notification System**: Alert users when favorite artists announce shows

### Phase 3 Features
1. **Web Scraping**: Add scrapers for venues without APIs (Red Rocks, etc.)
2. **RSS Feeds**: Monitor venue RSS feeds
3. **Social Media**: Track artist announcements on Twitter/Instagram
4. **Email Parsing**: Parse venue newsletters

## Success Metrics

### Short Term (Month 1)
- 1,000+ events ingested
- 3+ data sources integrated
- 95%+ sync success rate
- <5 minute sync duration

### Long Term (Month 3)
- 10,000+ events in database
- 5+ major markets covered
- Auto-import for top 100 artists
- User-facing event discovery page
