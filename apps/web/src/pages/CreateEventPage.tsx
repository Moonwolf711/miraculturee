import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Create Event</h1>
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Event Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Venue Name</label>
            <input
              type="text"
              value={form.venueName}
              onChange={(e) => update('venueName', e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Event Date & Time</label>
            <input
              type="datetime-local"
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Venue Address</label>
          <input
            type="text"
            value={form.venueAddress}
            onChange={(e) => update('venueAddress', e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Latitude</label>
            <input
              type="number"
              step="any"
              value={form.venueLat}
              onChange={(e) => update('venueLat', e.target.value)}
              required
              placeholder="40.7128"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Longitude</label>
            <input
              type="number"
              step="any"
              value={form.venueLng}
              onChange={(e) => update('venueLng', e.target.value)}
              required
              placeholder="-74.0060"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Ticket Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="1"
              value={form.ticketPrice}
              onChange={(e) => update('ticketPrice', e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Total Tickets</label>
            <input
              type="number"
              min="1"
              value={form.totalTickets}
              onChange={(e) => update('totalTickets', e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Local Radius (km)</label>
            <input
              type="number"
              min="1"
              max="500"
              value={form.localRadiusKm}
              onChange={(e) => update('localRadiusKm', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Event'}
        </button>
      </form>
    </div>
  );
}
