import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useWebSocket, usePollingFallback } from '../hooks/useWebSocket.js';
import type { WSMessage } from '../lib/ws.js';
import SEO, { getBreadcrumbSchema } from '../components/SEO.js';
import { CardSkeleton, InlineError } from '../components/LoadingStates.js';

type EventTypeFilter = 'SHOW' | 'FESTIVAL';

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
}

interface PaginatedEvents {
  data: EventSummary[];
  total: number;
  page: number;
  totalPages: number;
}

const CITY_FILTERS = ['All Cities', 'New York', 'Los Angeles', 'Chicago', 'Denver', 'Brooklyn', 'Queens'];

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('type') === 'FESTIVAL' ? 'FESTIVAL' : 'SHOW';
  const initialPage = Number(searchParams.get('page')) || 1;
  const [activeTab, setActiveTab] = useState<EventTypeFilter>(initialTab as EventTypeFilter);
  const [events, setEvents] = useState<PaginatedEvents | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadEvents = useCallback(async (city?: string, type?: EventTypeFilter, page = 1) => {
    setLoading(true);
    setFetchError(null);
    try {
      const qp = new URLSearchParams();
      if (city) qp.set('city', city);
      if (type) qp.set('type', type);
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

  useEffect(() => {
    loadEvents(search || undefined, activeTab, 1);
  }, [loadEvents, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: EventTypeFilter) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchParams(tab === 'SHOW' ? {} : { type: tab });
  };

  const handlePageChange = (page: number) => {
    loadEvents(search || undefined, activeTab, page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCityFilter = (city: string) => {
    const val = city === 'All Cities' ? '' : city;
    setSearch(val);
    setCurrentPage(1);
    loadEvents(val || undefined, activeTab, 1);
  };

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
                ? {
                    ...ev,
                    supportedTickets: msg.supportedTickets,
                    totalTickets: msg.totalTickets,
                  }
                : ev,
            ),
          };
        });
      }
    },
    [],
  );

  useWebSocket('events:list', handleWSMessage);

  // Polling fallback — refresh events every 30s if WS is disconnected
  usePollingFallback(
    () => {
      loadEvents(search || undefined, activeTab, currentPage);
    },
    30_000,
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadEvents(search || undefined, activeTab, 1);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getMonth = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

  const getDay = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { day: 'numeric' });

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
      {/* Page header area */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-8">
        {/* Title */}
        <div className="mb-6">
          <p className="font-display text-xs tracking-[0.4em] text-amber-500/60 mb-2">
            LIVE MUSIC
          </p>
          <h1 className="font-display text-4xl md:text-5xl tracking-wider text-warm-50">
            {activeTab === 'FESTIVAL' ? 'UPCOMING FESTIVALS' : 'UPCOMING SHOWS'}
          </h1>
          <div className="mt-4 h-px w-24 bg-gradient-to-r from-amber-500/50 to-transparent" aria-hidden="true" />
        </div>

        {/* Shows / Festivals tabs */}
        <div className="flex gap-1 mb-8 border-b border-noir-700" role="tablist" aria-label="Event type">
          <button
            role="tab"
            aria-selected={activeTab === 'SHOW'}
            onClick={() => handleTabChange('SHOW')}
            className={`px-5 py-3 font-body text-sm tracking-wide uppercase transition-all duration-300 border-b-2 -mb-px ${
              activeTab === 'SHOW'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            Shows
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'FESTIVAL'}
            onClick={() => handleTabChange('FESTIVAL')}
            className={`px-5 py-3 font-body text-sm tracking-wide uppercase transition-all duration-300 border-b-2 -mb-px ${
              activeTab === 'FESTIVAL'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            Festivals
          </button>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-3 mb-12">
          <div className="relative flex-1">
            {/* Search icon */}
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <svg
                className="w-4 h-4 text-gray-600"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by city..."
              aria-label="Search events by city"
              className="w-full pl-11 pr-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 placeholder-gray-600 rounded-lg font-body text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-300"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold font-body text-sm rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20"
          >
            Search
          </button>
        </form>

        {/* City filter pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CITY_FILTERS.map((city) => {
            const isActive = city === 'All Cities' ? !search : search.toLowerCase() === city.toLowerCase();
            return (
              <button
                key={city}
                onClick={() => handleCityFilter(city)}
                className={`px-4 py-1.5 rounded-full font-body text-xs tracking-wide transition-all duration-300 ${
                  isActive
                    ? 'bg-amber-500 text-noir-950 font-semibold'
                    : 'bg-noir-800 border border-noir-700 text-gray-400 hover:text-gray-300 hover:border-noir-600'
                }`}
              >
                {city}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        {loading ? (
          /* Loading skeleton — matches event card layout to prevent CLS */
          <CardSkeleton count={4} />
        ) : fetchError ? (
          /* Error state with retry */
          <InlineError
            message={fetchError}
            onRetry={() => loadEvents(search || undefined, activeTab, currentPage)}
          />
        ) : !events?.data.length ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 rounded-full border-2 border-noir-700 flex items-center justify-center mb-6">
              <svg
                className="w-7 h-7 text-gray-700"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
            <h2 className="font-display text-2xl tracking-wider text-gray-500 mb-2">
              {activeTab === 'FESTIVAL' ? 'NO UPCOMING FESTIVALS' : 'NO UPCOMING SHOWS'}
            </h2>
            <p className="font-body text-gray-400 text-sm mb-6">
              {search
                ? `No ${activeTab === 'FESTIVAL' ? 'festivals' : 'shows'} found matching "${search}". Try a different city.`
                : `Check back soon for new ${activeTab === 'FESTIVAL' ? 'festivals' : 'events'}.`}
            </p>
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  loadEvents(undefined, activeTab);
                }}
                className="px-5 py-2 border border-noir-700 text-gray-400 hover:text-gray-300 hover:border-noir-600 font-medium rounded-lg transition-colors text-sm"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          /* Event cards */
          <div className="grid gap-4">
            {events.data.map((event, index) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="group block animate-fade-in-up"
                style={{
                  animationDelay: `${index * 80}ms`,
                  animationFillMode: 'both',
                }}
              >
                <div className="bg-noir-800 border border-noir-700 rounded-xl overflow-hidden transition-all duration-300 group-hover:border-amber-500/30 group-hover:shadow-lg group-hover:shadow-amber-500/5">
                  <div className="flex items-stretch">
                    {/* Date badge - left side */}
                    <div className="flex-shrink-0 w-20 bg-noir-900 flex flex-col items-center justify-center py-5 border-r border-noir-700 relative">
                      {/* Torn-ticket notch top */}
                      <div className="absolute -right-2 top-4 w-4 h-4 rounded-full bg-noir-800 border border-noir-700" aria-hidden="true" />
                      {/* Torn-ticket notch bottom */}
                      <div className="absolute -right-2 bottom-4 w-4 h-4 rounded-full bg-noir-800 border border-noir-700" aria-hidden="true" />
                      {/* Dashed perforation line */}
                      <div className="absolute right-0 top-8 bottom-8 border-r border-dashed border-noir-700" aria-hidden="true" />

                      <span className="font-display text-xs tracking-widest text-amber-400">
                        {getMonth(event.date)}
                      </span>
                      <span className="font-display text-3xl text-amber-500 leading-none mt-0.5">
                        {getDay(event.date)}
                      </span>
                    </div>

                    {/* Center content */}
                    <div className="flex-1 px-5 py-4 min-w-0">
                      <h2 className="font-body font-semibold text-warm-50 text-base md:text-lg truncate group-hover:text-amber-50 transition-colors duration-300">
                        {event.title}
                      </h2>
                      <p className="font-body text-gray-400 text-sm mt-1 truncate">
                        {event.artistName} &middot; {event.venueName},{' '}
                        {event.venueCity}
                      </p>
                      <p className="font-body text-gray-400 text-xs mt-1.5">
                        {formatDate(event.date)}
                      </p>
                    </div>

                    {/* Right side - price and progress */}
                    <div className="flex-shrink-0 flex flex-col items-end justify-center px-5 py-4">
                      <span className="font-display text-2xl text-amber-400 leading-none">
                        {formatPrice(event.ticketPriceCents)}
                      </span>
                      <span className="font-body text-gray-400 text-xs mt-1.5">
                        {event.supportedTickets}/{event.totalTickets} supported
                      </span>
                      {/* Progress bar */}
                      <div
                        className="mt-2.5 w-28 h-1.5 bg-noir-700 rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={Math.round(Math.min(100, (event.supportedTickets / event.totalTickets) * 100))}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${event.supportedTickets} of ${event.totalTickets} tickets supported`}
                      >
                        <div
                          className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              (event.supportedTickets / event.totalTickets) * 100
                            )}%`,
                          }}
                        />
                      </div>
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

            {/* Page numbers */}
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

      {/* Bottom spacer */}
      <div className="h-16" />
    </div>
  );
}
