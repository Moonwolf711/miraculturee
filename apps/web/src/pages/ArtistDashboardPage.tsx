import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';
import { PageLoading, PageError, StatsSkeleton } from '../components/LoadingStates.js';

interface Dashboard {
  totalEvents: number;
  totalSupport: number;
  totalSupportAmountCents: number;
  totalRaffleEntries: number;
  upcomingEvents: {
    id: string;
    title: string;
    venueName: string;
    venueCity: string;
    date: string;
    supportedTickets: number;
    totalTickets: number;
  }[];
}

export default function ArtistDashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    api
      .get<Dashboard>('/artist/dashboard')
      .then(setDashboard)
      .catch((err: Error) => {
        setFetchError(err.message || 'Failed to load dashboard. Please try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  /* ---------- Loading state with skeleton ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-noir-950">
        <SEO title="Artist Dashboard" description="Loading your artist dashboard..." noindex />
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-8">
            <div className="h-8 w-56 bg-noir-800 rounded animate-pulse" />
            <div className="h-10 w-28 bg-noir-800 rounded-lg animate-pulse" />
          </div>
          <StatsSkeleton count={4} />
          <div className="h-6 w-40 bg-noir-800 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-noir-800 border border-noir-700 rounded-xl p-5 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="h-5 w-48 bg-noir-700 rounded" />
                    <div className="h-4 w-36 bg-noir-700 rounded" />
                  </div>
                  <div className="text-right space-y-2">
                    <div className="h-5 w-16 bg-noir-700 rounded" />
                    <div className="h-3 w-14 bg-noir-700 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Error state with retry ---------- */
  if (fetchError) return <PageError message={fetchError} onRetry={fetchDashboard} />;

  /* ---------- Unexpected null state ---------- */
  if (!dashboard) return <PageError message="Failed to load dashboard data." onRetry={fetchDashboard} />;

  return (
    <div className="min-h-screen bg-noir-950">
      <SEO
        title="Artist Dashboard"
        description="Manage your MiraCulture events, track support ticket sales, and view raffle statistics from your artist dashboard."
        noindex
      />
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl tracking-wider text-warm-50">
            ARTIST DASHBOARD
          </h1>
          <Link
            to="/artist/events/new"
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg text-sm transition-colors"
          >
            Create Event
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10" role="list" aria-label="Dashboard statistics">
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5" role="listitem" aria-label={`Total Events: ${dashboard.totalEvents}`}>
            <div className="font-display text-3xl text-warm-50">{dashboard.totalEvents}</div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Total Events</div>
          </div>
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5" role="listitem" aria-label={`Tickets Supported: ${dashboard.totalSupport}`}>
            <div className="font-display text-3xl text-warm-50">{dashboard.totalSupport}</div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Tickets Supported</div>
          </div>
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5" role="listitem" aria-label={`Total Support: ${formatPrice(dashboard.totalSupportAmountCents)}`}>
            <div className="font-display text-3xl text-amber-400">
              {formatPrice(dashboard.totalSupportAmountCents)}
            </div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Total Support</div>
          </div>
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5" role="listitem" aria-label={`Raffle Entries: ${dashboard.totalRaffleEntries}`}>
            <div className="font-display text-3xl text-warm-50">{dashboard.totalRaffleEntries}</div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Raffle Entries</div>
          </div>
        </div>

        {/* Upcoming Events */}
        <h2 className="font-display text-xl tracking-wider text-warm-50 mb-4">
          UPCOMING SHOWS
        </h2>
        {dashboard.upcomingEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-noir-800 border border-noir-700 rounded-xl">
            <div className="w-14 h-14 rounded-full border-2 border-noir-700 flex items-center justify-center mb-5">
              <svg
                className="w-6 h-6 text-gray-700"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                />
              </svg>
            </div>
            <h3 className="font-display text-lg tracking-wider text-gray-500 mb-2">
              NO UPCOMING SHOWS
            </h3>
            <p className="text-gray-400 text-sm font-body mb-5">
              You don't have any upcoming events yet. Create one to start reaching fans!
            </p>
            <Link
              to="/artist/events/new"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg text-sm transition-colors"
            >
              Create Event
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {dashboard.upcomingEvents.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="block bg-noir-800 border border-noir-700 rounded-xl p-5 hover:border-amber-500/30 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-warm-50 font-medium">{event.title}</h3>
                    <p className="text-sm text-gray-400 mt-1 font-body">
                      {event.venueName}, {event.venueCity} &middot; {formatDate(event.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-warm-50 font-display text-lg">
                      {event.supportedTickets}/{event.totalTickets}
                    </div>
                    <div className="text-xs uppercase tracking-wider text-gray-400">supported</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
