import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

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

  useEffect(() => {
    api
      .get<Dashboard>('/artist/dashboard')
      .then(setDashboard)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) return <div className="min-h-screen bg-noir-950 flex items-center justify-center text-gray-500">Loading...</div>;
  if (!dashboard) return <div className="min-h-screen bg-noir-950 flex items-center justify-center text-gray-500">Failed to load dashboard</div>;

  return (
    <div className="min-h-screen bg-noir-950">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5">
            <div className="font-display text-3xl text-warm-50">{dashboard.totalEvents}</div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mt-1">Total Events</div>
          </div>
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5">
            <div className="font-display text-3xl text-warm-50">{dashboard.totalSupport}</div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mt-1">Tickets Supported</div>
          </div>
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5">
            <div className="font-display text-3xl text-amber-400">
              {formatPrice(dashboard.totalSupportAmountCents)}
            </div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mt-1">Total Support</div>
          </div>
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5">
            <div className="font-display text-3xl text-warm-50">{dashboard.totalRaffleEntries}</div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mt-1">Raffle Entries</div>
          </div>
        </div>

        {/* Upcoming Events */}
        <h2 className="font-display text-xl tracking-wider text-warm-50 mb-4">
          UPCOMING SHOWS
        </h2>
        {dashboard.upcomingEvents.length === 0 ? (
          <p className="text-gray-500 text-sm font-body">No upcoming events. Create one to get started!</p>
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
                    <p className="text-sm text-gray-500 mt-1 font-body">
                      {event.venueName}, {event.venueCity} &middot; {formatDate(event.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-warm-50 font-display text-lg">
                      {event.supportedTickets}/{event.totalTickets}
                    </div>
                    <div className="text-xs uppercase tracking-wider text-gray-500">supported</div>
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
