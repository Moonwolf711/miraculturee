import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';
import StripeCheckout from '../components/StripeCheckout.js';

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

interface SupportPurchaseResponse {
  id: string;
  eventId: string;
  ticketCount: number;
  totalAmountCents: number;
  clientSecret: string;
}

interface RaffleEntryResponse {
  id: string;
  poolId: string;
  status: string;
  clientSecret: string;
}

type CheckoutState =
  | { type: 'none' }
  | { type: 'support'; clientSecret: string; ticketCount: number; totalCents: number }
  | { type: 'raffle'; clientSecret: string; poolId: string; tierCents: number };

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [supportCount, setSupportCount] = useState(1);
  const [message, setMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkout, setCheckout] = useState<CheckoutState>({ type: 'none' });

  useEffect(() => {
    if (id) {
      api.get<EventDetail>(`/events/${id}`).then(setEvent).catch(console.error).finally(() => setLoading(false));
    }
  }, [id]);

  // Handle initiating a support purchase — creates PaymentIntent on backend
  const handleSupport = async () => {
    if (!user || !event) return;
    setActionLoading(true);
    setFeedback(null);
    setCheckout({ type: 'none' });
    try {
      const result = await api.post<SupportPurchaseResponse>('/support/purchase', {
        eventId: event.id,
        ticketCount: supportCount,
        message: message || undefined,
      });
      // Show the Stripe checkout form with the clientSecret
      setCheckout({
        type: 'support',
        clientSecret: result.clientSecret,
        ticketCount: supportCount,
        totalCents: result.totalAmountCents,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle initiating a raffle entry — creates PaymentIntent on backend
  const handleRaffleEntry = async (poolId: string, tierCents: number) => {
    if (!user) return;
    setActionLoading(true);
    setFeedback(null);
    setCheckout({ type: 'none' });
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject),
      );
      const result = await api.post<RaffleEntryResponse>('/raffle/enter', {
        poolId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      // Show the Stripe checkout form with the clientSecret
      setCheckout({
        type: 'raffle',
        clientSecret: result.clientSecret,
        poolId,
        tierCents,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Called when Stripe payment succeeds on the frontend
  const handlePaymentSuccess = useCallback(() => {
    if (checkout.type === 'support') {
      setFeedback({
        type: 'success',
        text: `Payment confirmed! ${checkout.ticketCount} support ticket(s) purchased. These tickets will be added to the raffle pool.`,
      });
    } else if (checkout.type === 'raffle') {
      setFeedback({
        type: 'success',
        text: 'Payment confirmed! You have been entered into the raffle. Good luck!',
      });
    }
    setCheckout({ type: 'none' });
    // Refresh event data to update ticket counts
    if (id) {
      api.get<EventDetail>(`/events/${id}`).then(setEvent).catch(console.error);
    }
  }, [checkout, id]);

  // Called when Stripe payment fails on the frontend
  const handlePaymentError = useCallback((errorMessage: string) => {
    setFeedback({ type: 'error', text: errorMessage });
  }, []);

  // Cancel checkout and go back to the form
  const handleCancelCheckout = useCallback(() => {
    setCheckout({ type: 'none' });
  }, []);

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

  if (loading) return <div className="min-h-screen bg-noir-950 flex items-center justify-center text-gray-500">Loading...</div>;
  if (!event) return <div className="min-h-screen bg-noir-950 flex items-center justify-center text-gray-500">Event not found</div>;

  const supportPercent = Math.min(100, (event.supportedTickets / event.totalTickets) * 100);

  return (
    <div className="min-h-screen bg-noir-950">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`px-4 py-3 rounded-lg mb-6 text-sm border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl tracking-wide text-warm-50 mb-2">
            {event.title}
          </h1>
          <p className="text-amber-400 font-body text-lg mb-1">
            {event.artistName}
          </p>
          <p className="text-gray-500 font-body">
            {formatDate(event.date)}
          </p>
        </div>

        {/* Two-Column Grid: Venue + Stats */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Venue Card */}
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-6">
            <span className="font-display text-xs tracking-widest text-amber-500 uppercase">
              Venue
            </span>
            <p className="text-warm-50 font-medium mt-3">{event.venueName}</p>
            <p className="text-sm text-gray-500 mt-1">{event.venueAddress}</p>
            {event.description && (
              <p className="text-sm text-gray-400 mt-4 leading-relaxed">{event.description}</p>
            )}
          </div>

          {/* Stats Card */}
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-6">
            <span className="font-display text-xs tracking-widest text-amber-500 uppercase">
              Ticket Stats
            </span>
            <div className="space-y-3 mt-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Face value</span>
                <span className="text-warm-50 font-medium">{formatPrice(event.ticketPriceCents)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total tickets</span>
                <span className="text-warm-50 font-medium">{event.totalTickets}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Supported</span>
                <span className="text-amber-400 font-medium">{event.supportedTickets}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Local radius</span>
                <span className="text-warm-50 font-medium">{event.localRadiusKm} km</span>
              </div>
            </div>
            <div className="mt-4 bg-noir-700 rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{ width: `${supportPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Support Section */}
        {user && (
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-6 mb-8">
            <h2 className="font-display text-lg tracking-wider text-warm-50 mb-2">
              SUPPORT THIS ARTIST
            </h2>
            <p className="text-sm text-gray-500 mb-5 font-body">
              Buy tickets at face value to support {event.artistName}. These tickets will be
              raffled to local fans.
            </p>

            {/* Show checkout form when a support PaymentIntent is active */}
            {checkout.type === 'support' ? (
              <StripeCheckout
                clientSecret={checkout.clientSecret}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onCancel={handleCancelCheckout}
                submitLabel={`Pay ${formatPrice(checkout.totalCents)}`}
                title="Complete Payment"
                description={`${checkout.ticketCount} support ticket(s) at ${formatPrice(event.ticketPriceCents)} each`}
              />
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div>
                  <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                    Tickets
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={supportCount}
                    onChange={(e) => setSupportCount(Number(e.target.value))}
                    className="w-20 px-3 py-2.5 bg-noir-900 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                    Message (optional)
                  </label>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Show some love..."
                    className="w-full px-3 py-2.5 bg-noir-900 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                  />
                </div>
                <button
                  onClick={handleSupport}
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  Support {formatPrice(event.ticketPriceCents * supportCount)}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Raffle Pools */}
        {event.rafflePools.length > 0 && (
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-6 mb-8">
            <h2 className="font-display text-lg tracking-wider text-warm-50 mb-4">
              RAFFLE POOLS
            </h2>
            <div className="space-y-3">
              {event.rafflePools.map((pool) => (
                <div
                  key={pool.id}
                  className="bg-noir-900 rounded-lg p-4"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-display text-2xl text-amber-400">
                        {formatPrice(pool.tierCents)}
                      </span>
                      <span className="text-gray-400 text-sm ml-2">Entry</span>
                      <div className="text-sm text-gray-500 mt-1">
                        {pool.totalEntries} entries &middot; {pool.availableTickets} tickets available
                      </div>
                      {pool.drawTime && (
                        <div className="text-xs text-gray-600 mt-1">
                          Draw: {formatDate(pool.drawTime)}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {pool.status === 'OPEN' && user ? (
                        checkout.type === 'raffle' && checkout.poolId === pool.id ? null : (
                          <button
                            onClick={() => handleRaffleEntry(pool.id, pool.tierCents)}
                            disabled={actionLoading}
                            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-noir-950 text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
                          >
                            ENTER RAFFLE
                          </button>
                        )
                      ) : pool.status === 'COMPLETED' ? (
                        <span className="text-sm text-gray-600">Draw complete</span>
                      ) : (
                        <span className="text-sm text-gray-600">{pool.status}</span>
                      )}
                    </div>
                  </div>

                  {/* Show checkout form inline for this pool */}
                  {checkout.type === 'raffle' && checkout.poolId === pool.id && (
                    <div className="mt-4">
                      <StripeCheckout
                        clientSecret={checkout.clientSecret}
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        onCancel={handleCancelCheckout}
                        submitLabel={`Pay ${formatPrice(checkout.tierCents)}`}
                        title="Complete Raffle Entry"
                        description={`Entry fee: ${formatPrice(pool.tierCents)}`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Not logged in prompt */}
        {!user && (
          <p className="text-center text-gray-600 mt-8 text-sm font-body">
            <Link to="/login" className="text-amber-400 hover:text-amber-300 transition-colors">
              Sign in
            </Link>{' '}
            to support this artist or enter the raffle.
          </p>
        )}
      </div>
    </div>
  );
}
