import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';
import SocialConnectButton from '../components/artist/SocialConnectButton.js';
import SocialAccountCard from '../components/artist/SocialAccountCard.js';
import VerificationBadge from '../components/artist/VerificationBadge.js';

interface SocialAccount {
  id: string;
  provider: string;
  providerUsername: string | null;
  profileUrl: string | null;
  followerCount: number | null;
  connectedAt: string;
  lastVerifiedAt: string | null;
}

interface SocialAccountsResponse {
  accounts: SocialAccount[];
  isVerified: boolean;
  verificationStatus: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  venueName: string;
  venueCity: string;
  date: string;
  supportedTickets: number;
  totalTickets: number;
}

interface MatchedEvent {
  eventId: string;
  title: string;
  venueName: string;
  venueCity: string;
  date: string;
  ticketPriceCents: number;
  totalTickets: number;
  confidence: number;
}

export default function ArtistVerifyPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<SocialAccountsResponse | null>(null);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [matchedEvents, setMatchedEvents] = useState<MatchedEvent[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [campaignsRemaining, setCampaignsRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const verified = searchParams.get('verified');
  const errorParam = searchParams.get('error');

  const fetchAccounts = useCallback(async () => {
    try {
      const [res, dash, matched] = await Promise.all([
        api.get<SocialAccountsResponse>('/artist/me/social-accounts'),
        api.get<{ upcomingEvents: UpcomingEvent[] }>('/artist/dashboard').catch(() => ({ upcomingEvents: [] })),
        api.get<{ matches: MatchedEvent[] }>('/artist/matched-events').catch(() => ({ matches: [] })),
      ]);
      setData(res);
      setEvents(dash.upcomingEvents);
      setMatchedEvents(matched.matches);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (verified) {
      const matchCount = searchParams.get('matches');
      const matchStr = matchCount && parseInt(matchCount, 10) > 0
        ? ` We found ${matchCount} show${parseInt(matchCount, 10) === 1 ? '' : 's'} matching your name!`
        : '';
      setSuccessMsg(`Successfully connected ${verified.charAt(0).toUpperCase() + verified.slice(1)}!${matchStr}`);
    }
    if (errorParam) {
      const artistName = searchParams.get('artistName') || '';
      const userName = searchParams.get('userName') || '';
      const messages: Record<string, string> = {
        spotify_denied: 'Spotify authorization was denied.',
        tidal_denied: 'Tidal authorization was denied.',
        soundcloud_denied: 'SoundCloud authorization was denied.',
        invalid_state: 'Invalid OAuth state. Please try again.',
        spotify_failed: 'Failed to connect Spotify. Please try again.',
        tidal_failed: 'Failed to connect Tidal. Please try again.',
        soundcloud_failed: 'Failed to connect SoundCloud. Please try again.',
        missing_artist_url: 'Please provide your artist URL before connecting.',
        artist_not_found: 'The artist page was not found. Please check the URL and try again.',
        artist_mismatch: artistName
          ? `Verification failed: your Spotify account "${userName}" does not match the artist "${artistName}". You must log in with the Spotify account that owns this artist page.`
          : 'Verification failed: your Spotify account does not match the claimed artist. Log in with the Spotify account that owns this artist page.',
      };
      setError(messages[errorParam] ?? 'Something went wrong. Please try again.');
    }
  }, [verified, errorParam]);

  const handleDisconnect = async (provider: string) => {
    try {
      await api.delete(`/artist/me/social-accounts/${provider.toLowerCase()}`);
      await fetchAccounts();
      setSuccessMsg(`Disconnected ${provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase()}`);
    } catch {
      setError('Failed to disconnect account');
    }
  };

  const handleClaimEvent = async (eventId: string) => {
    setClaimingId(eventId);
    setError('');
    try {
      const res = await api.post<{
        success: boolean;
        campaignId: string;
        campaignsRemaining: number;
      }>(`/artist/claim/${eventId}`);
      setSuccessMsg('Campaign activated! Tickets are now available for fans.');
      setCampaignsRemaining(res.campaignsRemaining);
      // Remove from matched list and refresh
      setMatchedEvents((prev) => prev.filter((e) => e.eventId !== eventId));
      await fetchAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to activate campaign');
    } finally {
      setClaimingId(null);
    }
  };

  const connectedProviders = new Set(data?.accounts.map((a) => a.provider) ?? []);

  return (
    <div className="min-h-screen bg-noir-950 py-16 px-4">
      <SEO title="Verify Your Artist Account" noindex />
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="font-display text-sm tracking-[0.3em] text-amber-500/60 mb-2">
            ARTIST VERIFICATION
          </p>
          <h1 className="font-display text-3xl sm:text-4xl tracking-wider text-warm-50 mb-3">
            VERIFY YOUR IDENTITY
          </h1>
          <p className="font-body text-gray-400 text-sm max-w-md mx-auto">
            Connect your Spotify or Tidal account to verify your artist identity.
            This helps fans and venues trust your profile.
          </p>
        </div>

        {/* Status messages */}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg mb-6 text-sm">
            {successMsg}
          </div>
        )}
        {error && (
          <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Verification status */}
        {data && (
          <div className="flex items-center justify-center gap-3 mb-8">
            <VerificationBadge verified={data.isVerified} />
            {!data.isVerified && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                Unverified — connect a platform below
              </span>
            )}
          </div>
        )}

        {/* Connected accounts */}
        {data && data.accounts.length > 0 && (
          <div className="mb-8">
            <h2 className="font-body text-xs tracking-widest uppercase text-gray-500 font-semibold mb-3">
              Connected Accounts
            </h2>
            <div className="space-y-3">
              {data.accounts.map((account) => (
                <SocialAccountCard
                  key={account.id}
                  account={account}
                  onDisconnect={() => handleDisconnect(account.provider)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Primary: Verify via Tidal */}
        <div className="bg-noir-900 border border-noir-800 rounded-2xl p-6">
          <h2 className="font-body text-xs tracking-widest uppercase text-gray-500 font-semibold mb-4">
            {connectedProviders.has('TIDAL') ? 'Tidal Verified' : 'Connect Tidal'}
          </h2>
          <div className="space-y-3">
            {!connectedProviders.has('TIDAL') && (
              <SocialConnectButton provider="tidal" />
            )}
            {connectedProviders.has('TIDAL') && (
              <p className="font-body text-green-400 text-sm text-center py-2">
                Your Tidal account is verified. You can claim shows below.
              </p>
            )}
            {!connectedProviders.has('TIDAL') && (
              <p className="font-body text-gray-500 text-xs text-center mt-2">
                Paste your Tidal artist page URL, then log in with your Tidal account.
                This verifies you are the artist.
              </p>
            )}
          </div>
        </div>

        {/* Secondary: Spotify & SoundCloud side by side */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-noir-900 border border-noir-800 rounded-2xl p-5">
            <h2 className="font-body text-xs tracking-widest uppercase text-gray-500 font-semibold mb-3">
              {connectedProviders.has('SPOTIFY') ? 'Spotify Verified' : 'Spotify'}
            </h2>
            {!connectedProviders.has('SPOTIFY') && (
              <SocialConnectButton provider="spotify" />
            )}
            {connectedProviders.has('SPOTIFY') && (
              <p className="font-body text-green-400 text-xs text-center py-2">
                Verified
              </p>
            )}
          </div>
          <div className="bg-noir-900 border border-noir-800 rounded-2xl p-5">
            <h2 className="font-body text-xs tracking-widest uppercase text-gray-500 font-semibold mb-3">
              {connectedProviders.has('SOUNDCLOUD') ? 'SoundCloud Connected' : 'SoundCloud'}
            </h2>
            {!connectedProviders.has('SOUNDCLOUD') && (
              <SocialConnectButton provider="soundcloud" />
            )}
            {connectedProviders.has('SOUNDCLOUD') && (
              <p className="font-body text-green-400 text-xs text-center py-2">
                Connected
              </p>
            )}
          </div>
        </div>

        {/* Matched Events — Activate Campaign (shown when Spotify or Tidal verified) */}
        {(connectedProviders.has('SPOTIFY') || connectedProviders.has('TIDAL')) && matchedEvents.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-body text-xs tracking-widest uppercase text-amber-400 font-semibold">
                Your Shows on MiraCulture
              </h2>
              {campaignsRemaining != null && (
                <span className="text-xs text-gray-500 font-body">
                  {campaignsRemaining} campaign{campaignsRemaining === 1 ? '' : 's'} remaining this month
                </span>
              )}
            </div>
            {/* Campaign explainer */}
            <div className="bg-noir-950 border border-amber-500/10 rounded-xl p-5 mb-4">
              <h3 className="font-body font-semibold text-warm-50 text-sm mb-3">
                What happens when you activate a campaign?
              </h3>
              <ol className="space-y-2 text-gray-400 text-sm font-body">
                <li className="flex gap-2">
                  <span className="text-amber-500 font-semibold shrink-0">1.</span>
                  <span>A donation goal is set (10 tickets &times; face value). Fans worldwide donate to reach it.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-500 font-semibold shrink-0">2.</span>
                  <span>When the goal is hit, 10 tickets unlock at $5&ndash;$10 for verified local fans only.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-500 font-semibold shrink-0">3.</span>
                  <span>100% of donations go directly to you. Surplus becomes your bonus if the show sells out.</span>
                </li>
              </ol>
            </div>
            <p className="text-gray-400 text-sm font-body mb-4">
              Ready to go? Activate a campaign for any of your shows below. You can activate up to 2 per month.
            </p>
            <div className="space-y-3">
              {matchedEvents.map((match) => (
                <div
                  key={match.eventId}
                  className="bg-noir-900 border border-amber-500/20 rounded-xl p-4"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-warm-50 font-medium text-sm truncate">{match.title}</h3>
                      <p className="text-xs text-gray-400 mt-1 font-body">
                        {match.venueName}, {match.venueCity}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 font-body">
                        {new Date(match.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        {' '}&middot;{' '}
                        Ticket price: ${(match.ticketPriceCents / 100).toFixed(0)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleClaimEvent(match.eventId)}
                      disabled={claimingId === match.eventId || (campaignsRemaining != null && campaignsRemaining <= 0)}
                      className="flex-shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg text-xs uppercase tracking-wide transition-colors disabled:opacity-50"
                    >
                      {claimingId === match.eventId ? 'Activating...' : 'Activate Campaign'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Shows */}
        {events.length > 0 && (
          <div className="mt-8">
            <h2 className="font-body text-xs tracking-widest uppercase text-gray-500 font-semibold mb-3">
              Your Upcoming Shows
            </h2>
            <div className="space-y-3">
              {events.map((event) => (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="block bg-noir-900 border border-noir-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-warm-50 font-medium text-sm">{event.title}</h3>
                      <p className="text-xs text-gray-400 mt-1 font-body">
                        {event.venueName}, {event.venueCity} &middot;{' '}
                        {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-warm-50 font-display text-lg">
                        {event.supportedTickets}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-500">supported</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Next steps */}
        <div className="mt-8 text-center">
          <Link
            to="/artist/dashboard"
            className="btn-amber inline-flex items-center justify-center px-8 py-3 text-sm rounded-sm group"
          >
            <span>Go to Artist Dashboard</span>
            <svg className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '200ms' }} />
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
