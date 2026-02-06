import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

interface RafflePool {
  id: string;
  tierCents: number;
  status: string;
  availableTickets: number;
  totalEntries: number;
  drawTime: string | null;
}

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  artistName: string;
  venueName: string;
  venueAddress: string;
  venueCity: string;
  venueLat: number;
  venueLng: number;
  date: string;
  ticketPriceCents: number;
  totalTickets: number;
  supportedTickets: number;
  localRadiusKm: number;
  status: string;
  rafflePools: RafflePool[];
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [supportCount, setSupportCount] = useState(1);
  const [message, setMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (id) {
      api.get<EventDetail>(`/events/${id}`).then(setEvent).catch(console.error).finally(() => setLoading(false));
    }
  }, [id]);

  const handleSupport = async () => {
    if (!user || !event) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      await api.post('/support/purchase', {
        eventId: event.id,
        ticketCount: supportCount,
        message: message || undefined,
      });
      setFeedback({ type: 'success', text: `Purchased ${supportCount} support ticket(s)! Complete payment to finalize.` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRaffleEntry = async (poolId: string) => {
    if (!user) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject),
      );
      await api.post('/raffle/enter', {
        poolId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setFeedback({ type: 'success', text: 'Entered the raffle! Complete payment to confirm entry.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!event) return <div className="text-center py-12 text-gray-400">Event not found</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {feedback && (
        <div
          className={`px-4 py-2 rounded mb-4 text-sm ${
            feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
      <p className="text-gray-500 mb-6">
        {event.artistName} &middot; {formatDate(event.date)}
      </p>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Venue</h2>
          <p className="font-medium">{event.venueName}</p>
          <p className="text-sm text-gray-500">{event.venueAddress}</p>
          {event.description && (
            <p className="text-sm text-gray-600 mt-4">{event.description}</p>
          )}
        </div>
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Ticket Stats</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Face value</span>
              <span className="font-medium">{formatPrice(event.ticketPriceCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total tickets</span>
              <span className="font-medium">{event.totalTickets}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Supported</span>
              <span className="font-medium text-brand-600">{event.supportedTickets}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Local radius</span>
              <span className="font-medium">{event.localRadiusKm} km</span>
            </div>
          </div>
          <div className="mt-3 bg-gray-100 rounded-full h-2">
            <div
              className="bg-brand-500 h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(100, (event.supportedTickets / event.totalTickets) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Support Section */}
      {user && (
        <div className="bg-white border rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-3">Support This Artist</h2>
          <p className="text-sm text-gray-500 mb-4">
            Buy tickets at face value to support {event.artistName}. These tickets will be
            raffled to local fans.
          </p>
          <div className="flex gap-3 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Tickets</label>
              <input
                type="number"
                min={1}
                max={100}
                value={supportCount}
                onChange={(e) => setSupportCount(Number(e.target.value))}
                className="w-20 px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Message (optional)</label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Show some love..."
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <button
              onClick={handleSupport}
              disabled={actionLoading}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap"
            >
              Support {formatPrice(event.ticketPriceCents * supportCount)}
            </button>
          </div>
        </div>
      )}

      {/* Raffle Section */}
      {event.rafflePools.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Raffle Pools</h2>
          <div className="space-y-3">
            {event.rafflePools.map((pool) => (
              <div key={pool.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium">{formatPrice(pool.tierCents)} Entry</span>
                  <span className="text-sm text-gray-500 ml-2">
                    {pool.totalEntries} entries &middot; {pool.availableTickets} tickets available
                  </span>
                  {pool.drawTime && (
                    <span className="text-xs text-gray-400 block">
                      Draw: {formatDate(pool.drawTime)}
                    </span>
                  )}
                </div>
                <div>
                  {pool.status === 'OPEN' && user ? (
                    <button
                      onClick={() => handleRaffleEntry(pool.id)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Enter Raffle
                    </button>
                  ) : pool.status === 'COMPLETED' ? (
                    <span className="text-sm text-gray-400">Draw complete</span>
                  ) : (
                    <span className="text-sm text-gray-400">{pool.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!user && (
        <p className="text-center text-gray-400 mt-6 text-sm">
          Log in to support this artist or enter the raffle.
        </p>
      )}
    </div>
  );
}
