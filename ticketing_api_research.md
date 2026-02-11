# Ticketing Platform API Research

## Ticketmaster Discovery API

### Key Features
- **Access**: Free API with registration at developer.ticketmaster.com
- **Coverage**: 230K+ events across US, Canada, Mexico, Australia, New Zealand, UK, Ireland, and Europe
- **Sources**: Ticketmaster, Universe, FrontGate Tickets, Ticketmaster Resale (TMR)

### Rate Limits
- **Daily quota**: 5,000 API calls per day
- **Rate limit**: 5 requests per second
- **Deep paging**: Maximum 1000 items (size × page < 1000)

### Authentication
- API Key passed in `apikey` query parameter
- Example: `https://app.ticketmaster.com/discovery/v2/events.json?apikey={apikey}`

### Key Endpoints

#### 1. Event Search
**Endpoint**: `GET /discovery/v2/events`

**Useful Parameters**:
- `countryCode`: Filter by country (e.g., "US", "CA")
- `stateCode`: Filter by state
- `city`: Filter by city
- `postalCode`: Filter by zip code
- `latlong` or `geoPoint`: Geographic filtering
- `radius` & `unit`: Search radius (miles/km)
- `startDateTime` & `endDateTime`: Date range filtering
- `classificationName`: Filter by segment/genre (e.g., "music")
- `dmaId`: Filter by DMA (Designated Market Area)
- `marketId`: Filter by market
- `keyword`: Search by keyword
- `attractionId`: Filter by specific artist/attraction
- `venueId`: Filter by specific venue
- `onsaleStartDateTime` & `onsaleEndDateTime`: When tickets go on sale
- `size`: Page size (default 20)
- `page`: Page number (default 0)
- `sort`: Sort order (relevance, date, name, distance, etc.)

**Example Queries**:
```
# All events in the US
https://app.ticketmaster.com/discovery/v2/events.json?countryCode=US&apikey={apikey}

# Music events in Los Angeles area
https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&dmaId=324&apikey={apikey}

# Events for specific artist in Canada
https://app.ticketmaster.com/discovery/v2/events.json?attractionId=K8vZ917Gku7&countryCode=CA&apikey={apikey}
```

#### 2. Event Details
**Endpoint**: `GET /discovery/v2/events/{id}`
- Get full details for a specific event
- Includes venue, location, attractions, pricing, and purchase URL

#### 3. Venue Search
**Endpoint**: `GET /discovery/v2/venues`
- Search for venues
- Get venue details with `/discovery/v2/venues/{id}`

#### 4. Attraction Search
**Endpoint**: `GET /discovery/v2/attractions`
- Search for artists, sports teams, etc.
- Get attraction details with `/discovery/v2/attractions/{id}`

### Event Data Structure (Expected Fields)
Based on the API documentation, events should include:
- Event ID
- Event name/title
- Date and time
- Venue information (name, address, city, state, country, coordinates)
- Attraction/artist information
- Classification (segment, genre, sub-genre)
- Pricing information
- Ticket purchase URL (direct link to Ticketmaster)
- On-sale dates
- Images

## Eventbrite API

### Key Features
- **Access**: Free API with registration at eventbrite.com/platform
- **Purpose**: Create, manage, and retrieve event data
- **Coverage**: Global events on Eventbrite platform

### Key Endpoints

#### 1. Event Search
**Endpoint**: `GET /v3/events/search/`
- Search for public events
- Filter by location, date, category, etc.

#### 2. Event Details
**Endpoint**: `GET /v3/events/{event_id}/`
- Get detailed information about a specific event
- Includes pricing, venue, organizer, etc.

### Authentication
- OAuth 2.0 token-based authentication
- Private token for server-side applications

## AEG Presents / AXS

### Findings
- **AEG Maestro API**: Exists at `m-api.apps.aegpresents.com`
- **Access**: Likely requires partnership/business relationship
- **Alternative**: May need to scrape AXS.com or individual venue sites

## Red Rocks Amphitheatre

### Findings
- No public API found
- Events likely sourced through:
  - Ticketmaster API (Red Rocks uses AXS/Ticketmaster)
  - Direct scraping of redrocksonline.com
  - Venue-specific data feeds

## Other Platforms to Consider

### 1. Bandsintown
- Artist tour date aggregator
- Has API: https://www.bandsintown.com/api/overview
- Good for comprehensive tour data

### 2. Songkick
- Concert discovery platform
- API available for partners
- Comprehensive event database

### 3. SeatGeek
- Ticket aggregator
- API available: https://platform.seatgeek.com/
- Includes pricing from multiple sources

### 4. StubHub
- Resale marketplace (may not align with anti-scalping mission)

## Recommended Approach

### Phase 1: Start with Ticketmaster API
1. Register for Ticketmaster Discovery API
2. Implement event ingestion for US markets
3. Focus on music events initially
4. Extract: event details, venue, date, face value pricing, direct purchase URL

### Phase 2: Add Eventbrite
1. Register for Eventbrite API
2. Implement event search and details retrieval
3. Focus on independent/smaller events

### Phase 3: Expand Coverage
1. Integrate Bandsintown for comprehensive artist tour data
2. Add SeatGeek for additional event discovery
3. Consider scraping for venue-specific sites (Red Rocks, etc.)

### Phase 4: Automation
1. Set up scheduled jobs (cron/Railway scheduled tasks)
2. Run daily/hourly syncs
3. Deduplicate events across sources
4. Update MiraCulture database automatically

## Key Challenges

### 1. Face Value Pricing
- **Issue**: APIs may not always provide face value pricing
- **Solution**: 
  - Use "priceRanges" from Ticketmaster API
  - Mark as "TBD" if not available
  - Link directly to official source for users to see current pricing

### 2. Direct Purchase Links
- **Solution**: Ticketmaster API provides official purchase URLs
- Ensure links go directly to official ticketing platforms (not resellers)

### 3. Rate Limits
- Ticketmaster: 5,000 calls/day, 5 req/sec
- **Solution**: 
  - Cache data locally
  - Implement intelligent sync (only new/updated events)
  - Use geographic/market filtering to reduce API calls

### 4. Data Freshness
- **Solution**:
  - Run sync every 6-24 hours for upcoming events
  - More frequent updates for events going on sale soon
  - WebSocket/webhook integration if available

## Next Steps

1. Register for Ticketmaster Developer Account
2. Register for Eventbrite Platform Account
3. Build event ingestion service in MiraCulture API
4. Create database schema for external event sources
5. Implement sync logic with deduplication
6. Set up automated scheduling
7. Add admin dashboard for monitoring syncs
