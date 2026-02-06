import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

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
}

interface PaginatedEvents {
  data: EventSummary[];
  total: number;
  page: number;
  totalPages: number;
}

export default function EventsPage() {
  const [events, setEvents] = useState<PaginatedEvents | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async (city?: string) => {
    setLoading(true);
    try {
      const params = city ? `?city=${encodeURIComponent(city)}` : '';
      const data = await api.get<PaginatedEvents>(`/events${params}`);
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadEvents(search || undefined);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Upcoming Events</h1>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by city..."
          className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
        >
          Search
        </button>
      </form>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading events...</div>
      ) : !events?.data.length ? (
        <div className="text-center py-12 text-gray-400">
          No events found. Check back soon!
        </div>
      ) : (
        <div className="grid gap-4">
          {events.data.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="block bg-white border rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-semibold text-lg">{event.title}</h2>
                  <p className="text-gray-500 text-sm mt-1">
                    {event.artistName} &middot; {event.venueName}, {event.venueCity}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">{formatDate(event.date)}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-brand-600">
                    {formatPrice(event.ticketPriceCents)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {event.supportedTickets}/{event.totalTickets} supported
                  </div>
                  <div className="mt-2 w-24 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-brand-500 h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(100, (event.supportedTickets / event.totalTickets) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
