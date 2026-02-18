import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';
import { useWebSocket, usePollingFallback } from '../hooks/useWebSocket.js';
import type { WSMessage } from '../lib/ws.js';
import SEO, { getEventSchema, getBreadcrumbSchema } from '../components/SEO.js';
import ErrorBoundary from '../components/ErrorBoundary.js';
import { PageLoading, PageError, InlineError } from '../components/LoadingStates.js';
import { isDirectSalesOpen, SUPPORT_FEE_PER_TICKET_CENTS } from '@miraculturee/shared';
import ShareButton from '../components/ShareButton.js';

/* Lazy-load Stripe checkout — the Stripe SDK is heavy (~40 kB) and
   only needed when a user actually initiates a payment */
const StripeCheckout = lazy(() => import('../components/StripeCheckout.js'));

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
  currentProcessingFeeCents: number;
  sourceUrl: string | null;
  status: string;
  rafflePools: RafflePool[];
  campaigns?: {
    id: string;
    headline: string;
    message: string;
    goalCents: number;
    fundedCents: number;
    goalReached: boolean;
    discountCents: number;
    maxLocalTickets: number;
  }[];
  shareCount?: number;
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

interface TicketPurchaseResponse {
  id: string;
  eventId: string;
  priceCents: number;
  feeCents: number;
  platformFeeCents: number;
  totalCents: number;
  clientSecret: string;
}

type CheckoutState =
  | { type: 'none' }
  | { type: 'support'; clientSecret: string; ticketCount: number; totalCents: number }
  | { type: 'raffle'; clientSecret: string; poolId: string; tierCents: number }
  | { type: 'ticket'; clientSecret: string; priceCents: number; feeCents: number; platformFeeCents: number; totalCents: number };

type PaymentTab = 'ticket' | 'support' | 'raffle';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [supportCount, setSupportCount] = useState(1);
  const [message, setMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkout, setCheckout] = useState<CheckoutState>({ type: 'none' });
  const [activeTab, setActiveTab] = useState<PaymentTab>('ticket');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [optInConnection, setOptInConnection] = useState(false);
  const [donorInstagram, setDonorInstagram] = useState('');
  const [donorTwitter, setDonorTwitter] = useState('');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionChoice, setConnectionChoice] = useState<'connect' | 'anonymous' | null>(null);
  const [receiverInstagram, setReceiverInstagram] = useState('');
  const [receiverTwitter, setReceiverTwitter] = useState('');
  const [thankYouMessage, setThankYouMessage] = useState('');

  const fetchEvent = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);
    api
      .get<EventDetail>(`/events/${id}`)
      .then(setEvent)
      .catch((err: Error) => {
        setFetchError(err.message || 'Failed to load event details. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  /* ---------- WebSocket real-time updates ---------- */
  const wsChannel = id ? `event:${id}` : null;

  const handleWSMessage = useCallback(
    (msg: WSMessage) => {
      if (!id) return;

      switch (msg.type) {
        case 'raffle:new_entry':
          if (msg.eventId === id) {
            // Update the raffle pool entry count for the matching pool
            setEvent((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                rafflePools: prev.rafflePools.map((pool) =>
                  pool.id === msg.pool.id
                    ? { ...pool, totalEntries: pool.totalEntries + 1 }
                    : pool,
                ),
              };
            });
          }
          break;

        case 'ticket:supported':
          if (msg.eventId === id) {
            setEvent((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                supportedTickets: msg.supportedTickets,
                totalTickets: msg.totalTickets,
              };
            });
          }
          break;

        case 'event:updated':
          if (msg.eventId === id) {
            setEvent((prev) => {
              if (!prev) return prev;
              return { ...prev, ...(msg.changes as Partial<EventDetail>) };
            });
          }
          break;

        default:
          break;
      }
    },
    [id],
  );

  useWebSocket(wsChannel, handleWSMessage);

  // Polling fallback — refresh event data every 30s if WS is disconnected
  usePollingFallback(
    () => {
      if (id) {
        api.get<EventDetail>(`/events/${id}`).then(setEvent).catch(() => {
          // Silent poll failure — stale data is acceptable
        });
      }
    },
    30_000,
    !!id,
  );

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
        captchaToken: captchaToken || undefined,
        optInConnection: optInConnection || undefined,
        socials: optInConnection && (donorInstagram || donorTwitter)
          ? { instagram: donorInstagram || undefined, twitter: donorTwitter || undefined }
          : undefined,
      });
      // Show the Stripe checkout form with the clientSecret
      setCheckout({
        type: 'support',
        clientSecret: result.clientSecret,
        ticketCount: supportCount,
        totalCents: result.totalAmountCents,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Support purchase failed.';
      setFeedback({ type: 'error', text: msg });
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
        captchaToken: captchaToken || undefined,
      });
      // Show the Stripe checkout form with the clientSecret
      setCheckout({
        type: 'raffle',
        clientSecret: result.clientSecret,
        poolId,
        tierCents,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Raffle entry failed.';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle initiating a direct ticket purchase
  const handleTicketPurchase = async () => {
    if (!user || !event) return;
    setActionLoading(true);
    setFeedback(null);
    setCheckout({ type: 'none' });
    try {
      const result = await api.post<TicketPurchaseResponse>('/tickets/purchase', {
        eventId: event.id,
        captchaToken: captchaToken || undefined,
      });
      setCheckout({
        type: 'ticket',
        clientSecret: result.clientSecret,
        priceCents: result.priceCents,
        feeCents: result.feeCents,
        platformFeeCents: result.platformFeeCents,
        totalCents: result.totalCents,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ticket purchase failed.';
      setFeedback({ type: 'error', text: msg });
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
    } else if (checkout.type === 'ticket') {
      setFeedback({
        type: 'success',
        text: 'Ticket confirmed! Check your email for details.',
      });
    }
    setCheckout({ type: 'none' });
    // Refresh event data to update ticket counts
    if (id) {
      api.get<EventDetail>(`/events/${id}`).then(setEvent).catch(() => {
        // Silent refresh failure — stale data is acceptable here
      });
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

  /* ---------- Loading state ---------- */
  if (loading) return <PageLoading message="Loading event..." />;

  /* ---------- Error state with retry ---------- */
  if (fetchError) return <PageError message={fetchError} onRetry={fetchEvent} />;

  /* ---------- Not found state ---------- */
  if (!event) {
    return (
      <div className="min-h-screen bg-noir-950 flex flex-col items-center justify-center px-4 text-center">
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
              d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z"
            />
          </svg>
        </div>
        <h2 className="font-display text-2xl tracking-wider text-gray-500 mb-2">
          EVENT NOT FOUND
        </h2>
        <p className="font-body text-gray-400 text-sm mb-6">
          This event may have been removed or the link is incorrect.
        </p>
        <Link
          to="/events"
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors text-sm tracking-wide uppercase"
        >
          Browse Events
        </Link>
      </div>
    );
  }

  const supportPercent = Math.min(100, (event.supportedTickets / event.totalTickets) * 100);

  const eventDescription = event.description
    || `${event.artistName} live at ${event.venueName}, ${event.venueCity}. Get face-value tickets on MiraCulture.`;

  const directSalesOpen = isDirectSalesOpen(event.date);
  const hasRafflePools = event.rafflePools.length > 0;

  return (
    <div className="min-h-screen bg-noir-950">
      <SEO
        title={`${event.title} - ${event.artistName}`}
        description={eventDescription.slice(0, 160)}
        type="website"
        jsonLd={[
          getEventSchema(event),
          getBreadcrumbSchema([
            { name: 'Home', url: 'https://mira-culture.com/' },
            { name: 'Events', url: 'https://mira-culture.com/events' },
            { name: event.title, url: `https://mira-culture.com/events/${event.id}` },
          ]),
        ]}
      />
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Feedback Banner */}
        {feedback && (
          <div
            role="alert"
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
          <p className="text-gray-400 font-body">
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
            <p className="text-sm text-gray-400 mt-1">{event.venueAddress}</p>
            {event.description && (
              <p className="text-sm text-gray-400 mt-4 leading-relaxed">{event.description}</p>
            )}
            {event.sourceUrl && (
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                View on EDMTrain &rarr;
              </a>
            )}
            {/* Artist campaign messages */}
            {event.campaigns && event.campaigns.length > 0 && (
              <div className="mt-5 space-y-3">
                {event.campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">From the Artist</span>
                    </div>
                    <p className="text-warm-50 font-medium text-sm">{c.headline}</p>
                    <p className="text-gray-400 text-sm mt-1 leading-relaxed">{c.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats Card */}
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-6">
            <span className="font-display text-xs tracking-widest text-amber-500 uppercase">
              Ticket Stats
            </span>
            <div className="space-y-3 mt-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Face value</span>
                <span className="text-warm-50 font-medium">{formatPrice(event.ticketPriceCents)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total tickets</span>
                <span className="text-warm-50 font-medium">{event.totalTickets}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Supported</span>
                <span className="text-amber-400 font-medium">{event.supportedTickets}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Local radius</span>
                <span className="text-warm-50 font-medium">{event.localRadiusKm} km</span>
              </div>
            </div>
            <div
              className="mt-4 bg-noir-700 rounded-full h-2"
              role="progressbar"
              aria-valuenow={Math.round(supportPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${event.supportedTickets} of ${event.totalTickets} tickets supported`}
            >
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{ width: `${supportPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* AWAITING_ARTIST: Share CTA instead of payment tabs */}
        {event.status === 'AWAITING_ARTIST' && (
          <div className="bg-noir-800 border border-amber-500/30 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="font-display text-sm tracking-wider text-amber-400 uppercase">
                Artist Hasn't Joined Yet
              </h2>
            </div>
            <p className="text-gray-300 text-sm font-body mb-2">
              <strong className="text-warm-50">{event.artistName}</strong> hasn't activated a campaign on MiraCulture yet.
              Tickets are locked until they do.
            </p>
            <p className="text-gray-400 text-sm font-body mb-5">
              Share this event with <strong className="text-warm-50">{event.artistName}</strong> to let them know fans want
              fair-price tickets through MiraCulture. When they join and activate a campaign, tickets unlock!
            </p>
            {(event.shareCount ?? 0) > 0 && (
              <p className="text-xs text-amber-400/70 font-body mb-4">
                {event.shareCount} fan{event.shareCount === 1 ? ' has' : 's have'} shared this event
              </p>
            )}
            <ShareButton
              eventId={event.id}
              artistName={event.artistName}
              eventTitle={event.title}
            />
          </div>
        )}

        {/* Unified Payment Section with Tabs */}
        {user && event.status === 'PUBLISHED' && (
          <ErrorBoundary label="Payment Options">
            {/* Local Discounted Tickets — shown when campaign goal reached */}
            {event.campaigns?.some((c) => c.goalReached) && (() => {
              const campaign = event.campaigns!.find((c) => c.goalReached)!;
              return (
                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <h3 className="font-display text-sm tracking-wider text-green-400 uppercase">
                      Local Fan Tickets Available
                    </h3>
                  </div>
                  <p className="text-gray-300 text-sm font-body mb-4">
                    Thanks to fan donations, <strong className="text-warm-50">{campaign.maxLocalTickets} discounted tickets</strong> are
                    available for local fans at just <strong className="text-amber-400">${(campaign.discountCents / 100).toFixed(0)}</strong> each.
                    Location verification required.
                  </p>
                  {user ? (
                    <button
                      onClick={() => {
                        if (!navigator.geolocation) {
                          setFeedback({ type: 'error', text: 'Geolocation is not supported by your browser.' });
                          return;
                        }
                        setFeedback(null);
                        navigator.geolocation.getCurrentPosition(
                          async (pos) => {
                            try {
                              const res = await api.post<{ ticketId: string; clientSecret: string; connectionId?: string }>(
                                `/campaign-tickets/${campaign.id}/local`,
                                { lat: pos.coords.latitude, lng: pos.coords.longitude },
                              );
                              if (res.connectionId) setConnectionId(res.connectionId);
                              setCheckout({ type: 'ticket', clientSecret: res.clientSecret, priceCents: campaign.discountCents, feeCents: 0, platformFeeCents: 0, totalCents: campaign.discountCents });
                            } catch (err: unknown) {
                              setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to purchase local ticket.' });
                            }
                          },
                          () => {
                            setFeedback({ type: 'error', text: 'Location access is required for local tickets.' });
                          },
                        );
                      }}
                      className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors text-sm"
                    >
                      Get Local Ticket &mdash; ${(campaign.discountCents / 100).toFixed(0)}
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      className="block w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg text-center text-sm transition-colors"
                    >
                      Log in to get a Local Ticket
                    </Link>
                  )}
                </div>
              );
            })()}

            {/* Donor Connection Choice — shown after local ticket purchase when matched */}
            {connectionId && !connectionChoice && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6 mb-6">
                <h3 className="font-display text-sm tracking-wider text-purple-400 uppercase mb-2">
                  A Fan Donated Your Ticket
                </h3>
                <p className="text-gray-300 text-sm font-body mb-4">
                  The supporter who paid for your ticket would like to connect. Would you like to exchange socials, or stay anonymous?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConnectionChoice('connect')}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-sm transition-colors"
                  >
                    Exchange Socials
                  </button>
                  <button
                    onClick={() => setConnectionChoice('anonymous')}
                    className="flex-1 py-2.5 bg-noir-700 hover:bg-noir-600 text-gray-300 font-semibold rounded-lg text-sm transition-colors"
                  >
                    Stay Anonymous
                  </button>
                </div>
              </div>
            )}

            {/* Connection: Exchange Socials form */}
            {connectionId && connectionChoice === 'connect' && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6 mb-6">
                <h3 className="font-display text-sm tracking-wider text-purple-400 uppercase mb-3">
                  Share Your Socials
                </h3>
                <div className="space-y-2 mb-4">
                  <input
                    type="text"
                    value={receiverInstagram}
                    onChange={(e) => setReceiverInstagram(e.target.value)}
                    placeholder="Instagram handle (optional)"
                    className="w-full px-3 py-2 bg-noir-900 border border-noir-700 text-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors placeholder-gray-600"
                  />
                  <input
                    type="text"
                    value={receiverTwitter}
                    onChange={(e) => setReceiverTwitter(e.target.value)}
                    placeholder="Twitter/X handle (optional)"
                    className="w-full px-3 py-2 bg-noir-900 border border-noir-700 text-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors placeholder-gray-600"
                  />
                </div>
                <button
                  onClick={async () => {
                    try {
                      await api.post(`/donor-connections/${connectionId}/respond`, {
                        choice: 'connect',
                        socials: { instagram: receiverInstagram || undefined, twitter: receiverTwitter || undefined },
                      });
                      setFeedback({ type: 'success', text: 'Socials shared! Your supporter will see your info.' });
                      setConnectionId(null);
                    } catch (err: unknown) {
                      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to submit.' });
                    }
                  }}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-sm transition-colors"
                >
                  Share &amp; Connect
                </button>
              </div>
            )}

            {/* Connection: Stay Anonymous form */}
            {connectionId && connectionChoice === 'anonymous' && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6 mb-6">
                <h3 className="font-display text-sm tracking-wider text-purple-400 uppercase mb-3">
                  Send a Thank You
                </h3>
                <textarea
                  value={thankYouMessage}
                  onChange={(e) => setThankYouMessage(e.target.value)}
                  placeholder="Thanks for the ticket! (optional)"
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2 bg-noir-900 border border-noir-700 text-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors placeholder-gray-600 mb-4 resize-none"
                />
                <button
                  onClick={async () => {
                    try {
                      await api.post(`/donor-connections/${connectionId}/respond`, {
                        choice: 'anonymous',
                        thankYouMessage: thankYouMessage || undefined,
                      });
                      setFeedback({ type: 'success', text: 'Your thanks have been sent to the supporter!' });
                      setConnectionId(null);
                    } catch (err: unknown) {
                      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to submit.' });
                    }
                  }}
                  className="w-full py-2.5 bg-noir-700 hover:bg-noir-600 text-gray-300 font-semibold rounded-lg text-sm transition-colors"
                >
                  Send Thanks &amp; Stay Anonymous
                </button>
              </div>
            )}

            <div className="bg-noir-800 border border-noir-700 rounded-xl p-6 mb-8">
              <h2 className="font-display text-lg tracking-wider text-warm-50 mb-5">
                GET YOUR TICKETS
              </h2>

              {/* Tab Navigation */}
              <div className="flex border-b border-noir-700 mb-6">
                <button
                  onClick={() => setActiveTab('ticket')}
                  className={`flex-1 py-3 text-sm font-medium tracking-wide uppercase transition-colors border-b-2 ${
                    activeTab === 'ticket'
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                  disabled={!directSalesOpen}
                >
                  Buy Ticket
                  {!directSalesOpen && <span className="block text-xs normal-case mt-1">(Closed)</span>}
                </button>
                <button
                  onClick={() => setActiveTab('support')}
                  className={`flex-1 py-3 text-sm font-medium tracking-wide uppercase transition-colors border-b-2 ${
                    activeTab === 'support'
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Support Artist
                </button>
                <button
                  onClick={() => setActiveTab('raffle')}
                  className={`flex-1 py-3 text-sm font-medium tracking-wide uppercase transition-colors border-b-2 ${
                    activeTab === 'raffle'
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                  disabled={!hasRafflePools}
                >
                  Enter Raffle
                  {!hasRafflePools && <span className="block text-xs normal-case mt-1">(Coming Soon)</span>}
                </button>
              </div>

              {/* Tab Content */}
              <div className="min-h-[300px]">
                {/* Buy Ticket Tab */}
                {activeTab === 'ticket' && (
                  <div>
                    {!directSalesOpen ? (
                      <p className="text-sm text-amber-400 font-body">
                        Direct sales closed &mdash; enter the raffle for a chance to win!
                      </p>
                    ) : checkout.type === 'ticket' ? (
                      <Suspense fallback={<div className="py-6 text-center text-gray-400 text-sm" role="status">Loading payment form...</div>}>
                        <StripeCheckout
                          clientSecret={checkout.clientSecret}
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                          onCancel={handleCancelCheckout}
                          submitLabel={`Pay ${formatPrice(checkout.totalCents)}`}
                          title="Complete Ticket Purchase"
                          description={`${formatPrice(checkout.priceCents)} + ${formatPrice(checkout.feeCents)} processing + ${formatPrice(checkout.platformFeeCents)} MiraCulture fee`}
                          onCaptchaVerify={setCaptchaToken}
                        />
                      </Suspense>
                    ) : (
                      <>
                        <p className="text-sm text-gray-400 mb-5 font-body">
                          Purchase your ticket directly at face price. One ticket per person.
                        </p>
                        <div className="space-y-2 mb-5">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Ticket (face price)</span>
                            <span className="text-warm-50 font-medium">{formatPrice(event.ticketPriceCents)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Processing fee</span>
                            <span className="text-warm-50 font-medium">{formatPrice(event.currentProcessingFeeCents)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">MiraCulture fee</span>
                            <span className="text-warm-50 font-medium">{formatPrice(SUPPORT_FEE_PER_TICKET_CENTS)}</span>
                          </div>
                          <div className="border-t border-noir-700 pt-2 flex justify-between text-sm font-semibold">
                            <span className="text-warm-50">Total</span>
                            <span className="text-amber-400">{formatPrice(event.ticketPriceCents + event.currentProcessingFeeCents + SUPPORT_FEE_PER_TICKET_CENTS)}</span>
                          </div>
                        </div>
                        <button
                          onClick={handleTicketPurchase}
                          disabled={actionLoading}
                          className="w-full px-6 py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors text-sm tracking-wide uppercase"
                        >
                          Buy Ticket
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Support Artist Tab */}
                {activeTab === 'support' && (
                  <div>
                    <p className="text-sm text-gray-400 mb-5 font-body">
                      Buy tickets at face value to support {event.artistName}. These tickets will be
                      raffled to local fans. A {formatPrice(SUPPORT_FEE_PER_TICKET_CENTS)}/ticket processing fee applies.
                    </p>

                    {checkout.type === 'support' ? (
                      <Suspense fallback={<div className="py-6 text-center text-gray-400 text-sm" role="status">Loading payment form...</div>}>
                        <StripeCheckout
                          clientSecret={checkout.clientSecret}
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                          onCancel={handleCancelCheckout}
                          submitLabel={`Pay ${formatPrice(checkout.totalCents)}`}
                          title="Complete Payment"
                          description={`${checkout.ticketCount} support ticket(s) at ${formatPrice(event.ticketPriceCents)} + ${formatPrice(SUPPORT_FEE_PER_TICKET_CENTS)} fee each`}
                          onCaptchaVerify={setCaptchaToken}
                        />
                      </Suspense>
                    ) : (
                      <div>
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Ticket price x {supportCount}</span>
                            <span className="text-warm-50 font-medium">{formatPrice(event.ticketPriceCents * supportCount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Processing fee ({formatPrice(SUPPORT_FEE_PER_TICKET_CENTS)}/ticket)</span>
                            <span className="text-warm-50 font-medium">{formatPrice(SUPPORT_FEE_PER_TICKET_CENTS * supportCount)}</span>
                          </div>
                          <div className="border-t border-noir-700 pt-2 flex justify-between text-sm font-semibold">
                            <span className="text-warm-50">Total</span>
                            <span className="text-amber-400">{formatPrice((event.ticketPriceCents + SUPPORT_FEE_PER_TICKET_CENTS) * supportCount)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 items-end">
                          <div>
                            <label htmlFor="support-tickets" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                              Tickets
                            </label>
                            <input
                              id="support-tickets"
                              type="number"
                              min={1}
                              max={100}
                              value={supportCount}
                              onChange={(e) => setSupportCount(Number(e.target.value))}
                              className="w-20 px-3 py-2.5 bg-noir-900 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors"
                            />
                          </div>
                          <div className="flex-1 w-full">
                            <label htmlFor="support-message" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                              Message (optional)
                            </label>
                            <input
                              id="support-message"
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
                            Support {formatPrice((event.ticketPriceCents + SUPPORT_FEE_PER_TICKET_CENTS) * supportCount)}
                          </button>
                        </div>
                        {/* Donor Connection Opt-in */}
                        <div className="mt-4 pt-4 border-t border-noir-700">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={optInConnection}
                              onChange={(e) => setOptInConnection(e.target.checked)}
                              className="mt-0.5 w-4 h-4 rounded border-noir-600 bg-noir-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-noir-800"
                            />
                            <span className="text-sm text-gray-300">
                              Connect with the fan who gets your ticket
                              <span className="block text-xs text-gray-500 mt-0.5">
                                If they opt in, you can exchange socials and meet at the show
                              </span>
                            </span>
                          </label>
                          {optInConnection && (
                            <div className="mt-3 ml-7 space-y-2">
                              <input
                                type="text"
                                value={donorInstagram}
                                onChange={(e) => setDonorInstagram(e.target.value)}
                                placeholder="Instagram handle (optional)"
                                className="w-full px-3 py-2 bg-noir-900 border border-noir-700 text-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                              />
                              <input
                                type="text"
                                value={donorTwitter}
                                onChange={(e) => setDonorTwitter(e.target.value)}
                                placeholder="Twitter/X handle (optional)"
                                className="w-full px-3 py-2 bg-noir-900 border border-noir-700 text-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Enter Raffle Tab */}
                {activeTab === 'raffle' && (
                  <div>
                    {!hasRafflePools ? (
                      <p className="text-sm text-gray-400 font-body">
                        Raffle pools will open once enough tickets are supported. Check back soon!
                      </p>
                    ) : (
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
                                <div className="text-sm text-gray-400 mt-1">
                                  {pool.totalEntries} entries &middot; {pool.availableTickets} tickets available
                                </div>
                                {pool.drawTime && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    Draw: {formatDate(pool.drawTime)}
                                  </div>
                                )}
                              </div>
                              <div className="flex-shrink-0">
                                {pool.status === 'OPEN' ? (
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
                                  <span className="text-sm text-gray-400">Draw complete</span>
                                ) : (
                                  <span className="text-sm text-gray-400">{pool.status}</span>
                                )}
                              </div>
                            </div>

                            {/* Show checkout form inline for this pool */}
                            {checkout.type === 'raffle' && checkout.poolId === pool.id && (
                              <div className="mt-4">
                                <Suspense fallback={<div className="py-6 text-center text-gray-400 text-sm" role="status">Loading payment form...</div>}>
                                  <StripeCheckout
                                    clientSecret={checkout.clientSecret}
                                    onSuccess={handlePaymentSuccess}
                                    onError={handlePaymentError}
                                    onCancel={handleCancelCheckout}
                                    submitLabel={`Pay ${formatPrice(checkout.tierCents)}`}
                                    title="Complete Raffle Entry"
                                    description={`Entry fee: ${formatPrice(pool.tierCents)}`}
                                    onCaptchaVerify={setCaptchaToken}
                                  />
                                </Suspense>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ErrorBoundary>
        )}

        {/* Not logged in prompt */}
        {!user && (
          <p className="text-center text-gray-400 mt-8 text-sm font-body">
            <Link to="/login" className="text-amber-400 hover:text-amber-300 transition-colors">
              Sign in
            </Link>{' '}
            to buy tickets, support this artist, or enter the raffle.
          </p>
        )}
      </div>
    </div>
  );
}
