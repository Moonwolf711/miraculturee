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

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!dashboard) return <div className="text-center py-12 text-gray-400">Failed to load dashboard</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Artist Dashboard</h1>
        <Link
          to="/artist/events/new"
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm"
        >
          Create Event
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{dashboard.totalEvents}</div>
          <div className="text-sm text-gray-500">Total Events</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{dashboard.totalSupport}</div>
          <div className="text-sm text-gray-500">Tickets Supported</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold text-brand-600">
            {formatPrice(dashboard.totalSupportAmountCents)}
          </div>
          <div className="text-sm text-gray-500">Total Support</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold">{dashboard.totalRaffleEntries}</div>
          <div className="text-sm text-gray-500">Raffle Entries</div>
        </div>
      </div>

      {/* Upcoming Events */}
      <h2 className="font-semibold text-lg mb-3">Upcoming Events</h2>
      {dashboard.upcomingEvents.length === 0 ? (
        <p className="text-gray-400 text-sm">No upcoming events. Create one to get started!</p>
      ) : (
        <div className="space-y-3">
          {dashboard.upcomingEvents.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="block bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{event.title}</h3>
                  <p className="text-sm text-gray-500">
                    {event.venueName}, {event.venueCity} &middot; {formatDate(event.date)}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">
                    {event.supportedTickets}/{event.totalTickets}
                  </div>
                  <div className="text-gray-400">supported</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
