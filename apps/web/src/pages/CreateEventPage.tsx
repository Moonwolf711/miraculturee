import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    venueName: '',
    venueAddress: '',
    venueLat: '',
    venueLng: '',
    date: '',
    ticketPrice: '',
    totalTickets: '',
    localRadiusKm: '50',
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const event = await api.post<{ id: string }>('/events', {
        title: form.title,
        description: form.description || undefined,
        venueName: form.venueName,
        venueAddress: form.venueAddress,
        venueLat: parseFloat(form.venueLat),
        venueLng: parseFloat(form.venueLng),
        date: new Date(form.date).toISOString(),
        ticketPriceCents: Math.round(parseFloat(form.ticketPrice) * 100),
        totalTickets: parseInt(form.totalTickets, 10),
        localRadiusKm: parseFloat(form.localRadiusKm),
      });
      navigate(`/events/${event.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create event.');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses =
    'w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors placeholder-gray-600';

  return (
    <div className="min-h-screen bg-noir-950">
      <SEO
        title="Create Event"
        description="List your live event on MiraCulture. Set face-value ticket prices and let fans worldwide support your music."
        noindex
      />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl tracking-wider text-warm-50 mb-8">
          CREATE EVENT
        </h1>

        <div className="bg-noir-900 border border-noir-800 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="create-title" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Event Title
              </label>
              <input
                id="create-title"
                type="text"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                required
                className={inputClasses}
                placeholder="Enter event title"
              />
            </div>

            <div>
              <label htmlFor="create-description" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Description
              </label>
              <textarea
                id="create-description"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={3}
                className={inputClasses}
                placeholder="Tell fans about this event..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="create-venue-name" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                  Venue Name
                </label>
                <input
                  id="create-venue-name"
                  type="text"
                  value={form.venueName}
                  onChange={(e) => update('venueName', e.target.value)}
                  required
                  className={inputClasses}
                  placeholder="Venue name"
                />
              </div>
              <div>
                <label htmlFor="create-date" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                  Event Date & Time
                </label>
                <input
                  id="create-date"
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => update('date', e.target.value)}
                  required
                  className={inputClasses}
                />
              </div>
            </div>

            <div>
              <label htmlFor="create-venue-address" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Venue Address
              </label>
              <input
                id="create-venue-address"
                type="text"
                value={form.venueAddress}
                onChange={(e) => update('venueAddress', e.target.value)}
                required
                className={inputClasses}
                placeholder="Full street address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="create-lat" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                  Latitude
                </label>
                <input
                  id="create-lat"
                  type="number"
                  step="any"
                  value={form.venueLat}
                  onChange={(e) => update('venueLat', e.target.value)}
                  required
                  placeholder="40.7128"
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="create-lng" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                  Longitude
                </label>
                <input
                  id="create-lng"
                  type="number"
                  step="any"
                  value={form.venueLng}
                  onChange={(e) => update('venueLng', e.target.value)}
                  required
                  placeholder="-74.0060"
                  className={inputClasses}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="create-price" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                  Ticket Price ($)
                </label>
                <input
                  id="create-price"
                  type="number"
                  step="0.01"
                  min="1"
                  value={form.ticketPrice}
                  onChange={(e) => update('ticketPrice', e.target.value)}
                  required
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="create-total-tickets" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                  Total Tickets
                </label>
                <input
                  id="create-total-tickets"
                  type="number"
                  min="1"
                  value={form.totalTickets}
                  onChange={(e) => update('totalTickets', e.target.value)}
                  required
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="create-radius" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                  Local Radius (km)
                </label>
                <input
                  id="create-radius"
                  type="number"
                  min="1"
                  max="500"
                  value={form.localRadiusKm}
                  onChange={(e) => update('localRadiusKm', e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
