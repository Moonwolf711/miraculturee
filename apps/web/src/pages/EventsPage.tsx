import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useWebSocket, usePollingFallback } from '../hooks/useWebSocket.js';
import type { WSMessage } from '../lib/ws.js';
import SEO, { getBreadcrumbSchema } from '../components/SEO.js';
import { CardSkeleton, InlineError } from '../components/LoadingStates.js';

type EventTypeFilter = 'SHOW' | 'FESTIVAL';
type SortKey = 'distance' | 'popular' | 'date';

interface EventSummary {
  id: string;
  title: string;
  artistName: string;
  venueName: string;
  venueCity: string;
  date: string;
  ticketPriceCents: number;
  totalTickets: number;
  supportedTickets: number;
  type: EventTypeFilter;
  genre?: string | null;
}

interface PaginatedEvents {
  data: EventSummary[];
  total: number;
  page: number;
  totalPages: number;
}

interface FilterOptions {
  cities: string[];
  genres: string[];
}

interface UserLocation {
  lat: number;
  lng: number;
}

const DATE_RANGES = [
  { label: 'Any Date', value: '' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Next 3 Months', value: '3months' },
  { label: 'Next 6 Months', value: '6months' },
];

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Nearest', value: 'distance' },
  { label: 'Most Popular', value: 'popular' },
  { label: 'Date', value: 'date' },
];

function getDateRange(value: string): { dateFrom?: string; dateTo?: string } {
  if (!value) return {};
  const now = new Date();
  const from = now.toISOString();
  const to = new Date(now);
  switch (value) {
    case 'week': to.setDate(to.getDate() + 7); break;
    case 'month': to.setMonth(to.getMonth() + 1); break;
    case '3months': to.setMonth(to.getMonth() + 3); break;
    case '6months': to.setMonth(to.getMonth() + 6); break;
  }
  return { dateFrom: from, dateTo: to.toISOString() };
}

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('type') === 'FESTIVAL' ? 'FESTIVAL' : 'SHOW';
  const initialPage = Number(searchParams.get('page')) || 1;
  const [activeTab, setActiveTab] = useState<EventTypeFilter>(initialTab as EventTypeFilter);
  const [events, setEvents] = useState<PaginatedEvents | null>(null);
  const [cityFilter, setCityFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [search, setSearch] = useState('');
  const [activeSorts, setActiveSorts] = useState<SortKey[]>(['popular', 'date']);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ cities: [], genres: [] });
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  // Load filter options once
  useEffect(() => {
    api.get<FilterOptions>('/events/filters').then(setFilterOptions).catch(() => {});
  }, []);

  const loadEvents = useCallback(async (opts: {
    q?: string; city?: string; genre?: string; type?: EventTypeFilter;
    dateFrom?: string; dateTo?: string; page?: number;
    sort?: string; lat?: number; lng?: number;
  } = {}) => {
    setLoading(true);
    setFetchError(null);
    try {
      const qp = new URLSearchParams();
      if (opts.q) qp.set('q', opts.q);
      if (opts.city) qp.set('city', opts.city);
      if (opts.genre) qp.set('genre', opts.genre);
      if (opts.type) qp.set('type', opts.type);
      if (opts.dateFrom) qp.set('dateFrom', opts.dateFrom);
      if (opts.dateTo) qp.set('dateTo', opts.dateTo);
      if (opts.sort) qp.set('sort', opts.sort);
      if (opts.lat != null) qp.set('lat', String(opts.lat));
      if (opts.lng != null) qp.set('lng', String(opts.lng));
      const page = opts.page || 1;
      if (page > 1) qp.set('page', String(page));
      const qs = qp.toString();
      const data = await api.get<PaginatedEvents>(`/events${qs ? `?${qs}` : ''}`);
      setEvents(data);
      setCurrentPage(page);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load events.';
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const currentFilters = useCallback(() => {
    const { dateFrom, dateTo } = getDateRange(dateRange);
    // Build compound sort string — filter out distance if no location
    const sortKeys = activeSorts.filter((s) => s !== 'distance' || userLocation);
    return {
      q: search || undefined,
      city: cityFilter || undefined,
      genre: genreFilter || undefined,
      type: activeTab,
      dateFrom,
      dateTo,
      sort: sortKeys.length > 0 ? sortKeys.join(',') : 'date',
      lat: userLocation?.lat,
      lng: userLocation?.lng,
    };
  }, [cityFilter, search, genreFilter, dateRange, activeTab, activeSorts, userLocation]);

  // Load events when filters change
  useEffect(() => {
    loadEvents({ ...currentFilters(), page: 1 });
  }, [loadEvents, activeTab, cityFilter, genreFilter, dateRange, activeSorts, userLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: EventTypeFilter) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchParams(tab === 'SHOW' ? {} : { type: tab });
  };

  const handlePageChange = (page: number) => {
    loadEvents({ ...currentFilters(), page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCityFilter('');
    setCurrentPage(1);
    loadEvents({ ...currentFilters(), q: search || undefined, page: 1 });
  };

  const clearFilters = () => {
    setCityFilter('');
    setGenreFilter('');
    setDateRange('');
    setSearch('');
    setActiveSorts(userLocation ? ['distance', 'popular', 'date'] : ['popular', 'date']);
    setLocationDenied(false);
    setCurrentPage(1);
  };

  const hasActiveFilters = !!(cityFilter || genreFilter || dateRange || search);

  /* ---------- WebSocket real-time ticket count updates ---------- */
  const handleWSMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.type === 'ticket:supported') {
        setEvents((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            data: prev.data.map((ev) =>
              ev.id === msg.eventId
                ? { ...ev, supportedTickets: msg.supportedTickets, totalTickets: msg.totalTickets }
                : ev,
            ),
          };
        });
      }
    },
    [],
  );

  useWebSocket('events:list', handleWSMessage);

  usePollingFallback(
    () => { loadEvents({ ...currentFilters(), page: currentPage }); },
    30_000,
  );

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const getMonth = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const getDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { day: 'numeric' });

  const selectClass = "bg-noir-800 border border-noir-700 text-gray-300 rounded-lg px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-300 appearance-none cursor-pointer";

  return (
    <div className="bg-noir-950 min-h-screen">
      <SEO
        title={activeTab === 'FESTIVAL' ? 'Upcoming Festivals' : 'Upcoming Shows'}
        description={activeTab === 'FESTIVAL'
          ? 'Browse upcoming EDM festivals on MiraCulture. Buy face-value tickets to support artists or enter $5 raffles as a local fan.'
          : 'Browse upcoming live music events on MiraCulture. Buy face-value tickets to support artists or enter $5 raffles as a local fan.'}
        type="website"
        jsonLd={getBreadcrumbSchema([
          { name: 'Home', url: 'https://miraculture.com/' },
          { name: activeTab === 'FESTIVAL' ? 'Festivals' : 'Events', url: 'https://miraculture.com/events' },
        ])}
      />
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-8">
        {/* Title */}
        <div className="mb-6">
          <p className="font-display text-xs tracking-[0.4em] text-amber-500/60 mb-2">LIVE MUSIC</p>
          <h1 className="font-display text-4xl md:text-5xl tracking-wider text-warm-50">
            {activeTab === 'FESTIVAL' ? 'UPCOMING FESTIVALS' : 'UPCOMING SHOWS'}
          </h1>
          <div className="mt-4 h-px w-24 bg-gradient-to-r from-amber-500/50 to-transparent" aria-hidden="true" />
        </div>

        {/* Shows / Festivals tabs */}
        <div className="flex gap-1 mb-6 border-b border-noir-700" role="tablist" aria-label="Event type">
          {(['SHOW', 'FESTIVAL'] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => handleTabChange(tab)}
              className={`px-5 py-3 font-body text-sm tracking-wide uppercase transition-all duration-300 border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab === 'SHOW' ? 'Shows' : 'Festivals'}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="bg-noir-900/50 border border-noir-700 rounded-xl p-4 mb-8">
          {/* Sort row — multi-select with priority badges */}
          <div className="flex items-center gap-2 mb-4">
            <span className="font-body text-xs text-gray-500 uppercase tracking-wider mr-1">Sort by</span>
            {SORT_OPTIONS.map((opt) => {
              const isGeoLoading = opt.value === 'distance' && locationLoading;
              const isGeoDenied = opt.value === 'distance' && locationDenied;
              const idx = activeSorts.indexOf(opt.value);
              const isActive = idx !== -1;
              const priority = idx + 1; // 1-based

              const toggleSort = () => {
                if (isGeoLoading) return;

                // When clicking Nearest, request geolocation if we don't have it yet
                if (opt.value === 'distance' && !userLocation && !isActive) {
                  if (!navigator.geolocation) {
                    setLocationDenied(true);
                    return;
                  }
                  setLocationLoading(true);
                  setLocationDenied(false);
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                      setLocationLoading(false);
                      setActiveSorts((prev) => [...prev, 'distance']);
                      setCurrentPage(1);
                    },
                    () => {
                      setLocationDenied(true);
                      setLocationLoading(false);
                    },
                    { timeout: 10000, maximumAge: 600000 },
                  );
                  return;
                }

                setActiveSorts((prev) => {
                  if (isActive) {
                    if (prev.length <= 1) return prev;
                    return prev.filter((s) => s !== opt.value);
                  }
                  return [...prev, opt.value];
                });
                setCurrentPage(1);
              };

              return (
                <button
                  key={opt.value}
                  onClick={toggleSort}
                  disabled={isGeoLoading}
                  className={`relative px-3 py-1.5 rounded-full font-body text-xs tracking-wide transition-all duration-300 ${
                    isActive
                      ? 'bg-amber-500 text-noir-950 font-semibold'
                      : isGeoLoading
                        ? 'text-gray-500 border border-noir-700 animate-pulse cursor-wait'
                        : isGeoDenied
                          ? 'text-gray-700 border border-noir-800 cursor-not-allowed'
                          : 'text-gray-400 border border-noir-700 hover:border-amber-500/40 hover:text-amber-400'
                  }`}
                  title={
                    isGeoLoading ? 'Getting your location...'
                      : isGeoDenied ? 'Location access denied — enable in browser settings'
                        : isActive ? `Priority ${priority} — click to remove`
                          : opt.value === 'distance' ? 'Click to enable — will ask for location'
                            : 'Click to add'
                  }
                >
                  {isActive && activeSorts.length > 1 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-noir-950/30 text-[10px] font-bold mr-1.5">
                      {priority}
                    </span>
                  )}
                  {isGeoLoading && (
                    <span className="inline-block mr-1 animate-spin" aria-hidden="true">&#9696;</span>
                  )}
                  {isGeoDenied && (
                    <span className="inline-block mr-1" aria-hidden="true">{'\u{1F512}'}</span>
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block font-body text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Search</label>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search events, artists, venues..."
                  aria-label="Search events"
                  className="flex-1 bg-noir-800 border border-noir-700 text-gray-200 placeholder-gray-600 rounded-lg pl-3 pr-3 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-300"
                />
              </form>
            </div>

            {/* Location dropdown */}
            <div className="min-w-[160px]">
              <label className="block font-body text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Location</label>
              <select
                value={cityFilter}
                onChange={(e) => { setCityFilter(e.target.value); setSearch(''); setCurrentPage(1); }}
                className={selectClass}
                style={{ minWidth: '160px' }}
              >
                <option value="">All Cities</option>
                {filterOptions.cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Date range dropdown */}
            <div className="min-w-[150px]">
              <label className="block font-body text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Date</label>
              <select
                value={dateRange}
                onChange={(e) => { setDateRange(e.target.value); setCurrentPage(1); }}
                className={selectClass}
                style={{ minWidth: '150px' }}
              >
                {DATE_RANGES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Genre dropdown */}
            {filterOptions.genres.length > 0 && (
              <div className="min-w-[150px]">
                <label className="block font-body text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Genre</label>
                <select
                  value={genreFilter}
                  onChange={(e) => { setGenreFilter(e.target.value); setCurrentPage(1); }}
                  className={selectClass}
                  style={{ minWidth: '150px' }}
                >
                  <option value="">All Genres</option>
                  {filterOptions.genres.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2.5 rounded-lg font-body text-xs text-gray-400 hover:text-amber-400 border border-noir-700 hover:border-amber-500/40 transition-all duration-300"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        {loading ? (
          <CardSkeleton count={4} />
        ) : fetchError ? (
          <InlineError
            message={fetchError}
            onRetry={() => loadEvents({ ...currentFilters(), page: currentPage })}
          />
        ) : !events?.data.length ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 rounded-full border-2 border-noir-700 flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-gray-700" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h2 className="font-display text-2xl tracking-wider text-gray-500 mb-2">NO EVENTS FOUND</h2>
            <p className="font-body text-gray-400 text-sm mb-6">
              Try adjusting your filters or search criteria.
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-5 py-2 border border-noir-700 text-gray-400 hover:text-gray-300 hover:border-noir-600 font-medium rounded-lg transition-colors text-sm"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.data.map((event, index) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="group block animate-fade-in-up"
                style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
              >
                <div className="h-full bg-noir-800 border border-noir-700 rounded-xl overflow-hidden transition-all duration-300 group-hover:border-amber-500/30 group-hover:shadow-lg group-hover:shadow-amber-500/5 flex flex-col">
                  {/* Top row: date + price */}
                  <div className="flex items-center justify-between px-4 py-3 bg-noir-900 border-b border-noir-700">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xs tracking-widest text-amber-400">{getMonth(event.date)}</span>
                      <span className="font-display text-2xl text-amber-500 leading-none">{getDay(event.date)}</span>
                    </div>
                    <span className="font-display text-2xl text-amber-400 leading-none whitespace-nowrap">{formatPrice(event.ticketPriceCents)}</span>
                  </div>

                  {/* Card body */}
                  <div className="flex-1 px-4 py-3 min-w-0 overflow-hidden">
                    <h2 className="font-body font-semibold text-warm-50 text-base truncate group-hover:text-amber-50 transition-colors duration-300">
                      {event.title}
                    </h2>
                    <p className="font-body text-gray-400 text-sm mt-1 truncate">
                      {event.artistName} &middot; {event.venueName}, {event.venueCity}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="font-body text-gray-500 text-xs">{formatDate(event.date)}</p>
                      {event.genre && (
                        <span className="px-2 py-0.5 rounded-full bg-noir-700 text-gray-400 font-body text-[10px] uppercase tracking-wider">
                          {event.genre}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom: progress bar */}
                  <div className="px-4 pb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-body text-gray-400 text-[10px] whitespace-nowrap">
                        {event.supportedTickets}/{event.totalTickets} supported
                      </span>
                      <span className="font-body text-gray-500 text-[10px]">
                        {Math.round(Math.min(100, (event.supportedTickets / event.totalTickets) * 100))}%
                      </span>
                    </div>
                    <div
                      className="w-full h-1.5 bg-noir-700 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={Math.round(Math.min(100, (event.supportedTickets / event.totalTickets) * 100))}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${event.supportedTickets} of ${event.totalTickets} tickets supported`}
                    >
                      <div
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (event.supportedTickets / event.totalTickets) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination controls */}
        {events && events.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-4 py-2 rounded-lg font-body text-sm border border-noir-700 text-gray-400 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed hover:border-amber-500/40 hover:text-amber-400"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: events.totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === events.totalPages || Math.abs(p - currentPage) <= 2)
                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, i) =>
                  item === '...' ? (
                    <span key={`dots-${i}`} className="px-2 text-gray-600 font-body text-sm">...</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => handlePageChange(item as number)}
                      className={`w-9 h-9 rounded-lg font-body text-sm transition-all duration-300 ${
                        currentPage === item
                          ? 'bg-amber-500 text-noir-950 font-semibold'
                          : 'text-gray-400 hover:text-amber-400 hover:bg-noir-800'
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= events.totalPages}
              className="px-4 py-2 rounded-lg font-body text-sm border border-noir-700 text-gray-400 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed hover:border-amber-500/40 hover:text-amber-400"
            >
              Next
            </button>
          </div>
        )}

        {/* Result count */}
        {events && events.total > 0 && (
          <p className="mt-4 text-center font-body text-gray-500 text-xs">
            {events.total} {activeTab === 'FESTIVAL' ? 'festivals' : 'shows'} found
          </p>
        )}
      </div>
      <div className="h-16" />
    </div>
  );
}
