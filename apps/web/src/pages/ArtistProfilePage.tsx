import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';

interface SocialAccount {
  provider: string;
  providerUsername: string | null;
  profileUrl: string | null;
  followerCount: number | null;
}

interface ArtistEvent {
  id: string;
  name: string;
  date: string;
  venueName: string | null;
  city: string | null;
  state: string | null;
  flyerImageUrl: string | null;
  status: string;
}

interface ArtistCampaign {
  id: string;
  status: string;
  goalAmount: number;
  currentAmount: number;
  ticketPrice: number;
}

interface ArtistProfile {
  id: string;
  stageName: string;
  bio: string | null;
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
  genres: string[];
  instruments: string[];
  professionalType: string | null;
  yearsActive: number | null;
  hometown: string | null;
  city: string | null;
  state: string | null;
  socialLinks: Record<string, string> | null;
  followerCount: Record<string, number> | null;
  isVerified: boolean;
  profileStrength: number;
  successfulCampaigns: number;
  socialAccounts: SocialAccount[];
  events: ArtistEvent[];
  campaigns: ArtistCampaign[];
  createdAt: string;
}

const SOCIAL_ICONS: Record<string, { label: string; color: string; urlPrefix: string }> = {
  instagram: { label: 'Instagram', color: '#E1306C', urlPrefix: 'https://instagram.com/' },
  twitter: { label: 'X / Twitter', color: '#1DA1F2', urlPrefix: 'https://x.com/' },
  tiktok: { label: 'TikTok', color: '#00f2ea', urlPrefix: 'https://tiktok.com/@' },
  spotify: { label: 'Spotify', color: '#1DB954', urlPrefix: '' },
  soundcloud: { label: 'SoundCloud', color: '#FF5500', urlPrefix: 'https://soundcloud.com/' },
  youtube: { label: 'YouTube', color: '#FF0000', urlPrefix: '' },
  website: { label: 'Website', color: '#f59e0b', urlPrefix: '' },
};

const PROVIDER_URLS: Record<string, (username: string) => string> = {
  SPOTIFY: (u) => `https://open.spotify.com/artist/${u}`,
  SOUNDCLOUD: (u) => `https://soundcloud.com/${u}`,
  TIDAL: (u) => `https://tidal.com/artist/${u}`,
  INSTAGRAM: (u) => `https://instagram.com/${u}`,
  FACEBOOK: (u) => `https://facebook.com/${u}`,
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function PageLoading() {
  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '200ms' }} />
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  );
}

export default function ArtistProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get<ArtistProfile>(`/artist/public/${id}`)
      .then(setArtist)
      .catch(() => setError('Artist not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoading />;

  if (error || !artist) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-4xl font-display tracking-wider text-warm-50 mb-4">Artist Not Found</h1>
          <p className="text-gray-400 mb-6">This artist profile doesn't exist or isn't public yet.</p>
          <Link to="/events" className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors">
            Browse Events
          </Link>
        </div>
      </div>
    );
  }

  const location = [artist.city, artist.state].filter(Boolean).join(', ') || artist.hometown;
  const socialLinks = artist.socialLinks || {};
  const followerCount = artist.followerCount || {};
  const totalFollowers = Object.values(followerCount).reduce((sum, n) => sum + (n || 0), 0);

  // Merge connected social accounts with manual social links
  const allSocials: { provider: string; username: string; url: string; followers: number | null }[] = [];

  // From connected accounts (verified)
  for (const acct of artist.socialAccounts) {
    const prov = acct.provider.toLowerCase();
    const url = acct.profileUrl || (PROVIDER_URLS[acct.provider]?.(acct.providerUsername || '') ?? '');
    allSocials.push({
      provider: prov,
      username: acct.providerUsername || prov,
      url,
      followers: acct.followerCount,
    });
  }

  // From manual social links (if not already covered by connected accounts)
  const connectedProviders = new Set(artist.socialAccounts.map(a => a.provider.toLowerCase()));
  for (const [key, value] of Object.entries(socialLinks)) {
    if (!value || connectedProviders.has(key)) continue;
    const info = SOCIAL_ICONS[key];
    if (!info) continue;
    const url = value.startsWith('http') ? value : info.urlPrefix + value;
    allSocials.push({
      provider: key,
      username: value,
      url,
      followers: followerCount[key] || null,
    });
  }

  const upcomingEvents = artist.events.filter(e => new Date(e.date) >= new Date());
  const pastEvents = artist.events.filter(e => new Date(e.date) < new Date());

  return (
    <div className="min-h-screen bg-noir-950">
      <SEO
        title={`${artist.stageName} — MiraCulture`}
        description={artist.bio || `Check out ${artist.stageName} on MiraCulture. Support live music, enter ticket raffles.`}
      />

      {/* Banner */}
      <div className="relative h-48 sm:h-64 md:h-80 overflow-hidden">
        {artist.bannerImageUrl ? (
          <img
            src={artist.bannerImageUrl}
            alt={`${artist.stageName} banner`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-500/20 via-noir-900 to-noir-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-noir-950 via-noir-950/40 to-transparent" />
      </div>

      {/* Profile Header */}
      <div className="max-w-4xl mx-auto px-4 -mt-20 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6">
          {/* Avatar */}
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl border-4 border-noir-950 overflow-hidden bg-noir-800 shrink-0 shadow-2xl">
            {artist.profileImageUrl ? (
              <img src={artist.profileImageUrl} alt={artist.stageName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-amber-500/20">
                <span className="text-4xl sm:text-5xl font-display text-amber-500">
                  {artist.stageName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Name & Info */}
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-display tracking-wider text-warm-50 leading-none">
                {artist.stageName}
              </h1>
              {artist.isVerified && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/15 text-amber-400 text-xs font-medium rounded-full border border-amber-500/20">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                  Verified
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-2 flex-wrap text-sm text-gray-400">
              {artist.professionalType && <span>{artist.professionalType}</span>}
              {artist.professionalType && location && <span className="text-noir-700">|</span>}
              {location && (
                <span className="flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {location}
                </span>
              )}
              {artist.yearsActive && (
                <>
                  <span className="text-noir-700">|</span>
                  <span>{artist.yearsActive}+ years active</span>
                </>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {totalFollowers > 0 && (
                <div className="text-sm">
                  <span className="text-warm-50 font-semibold">{formatNumber(totalFollowers)}</span>
                  <span className="text-gray-500 ml-1">followers</span>
                </div>
              )}
              {artist.successfulCampaigns > 0 && (
                <div className="text-sm">
                  <span className="text-warm-50 font-semibold">{artist.successfulCampaigns}</span>
                  <span className="text-gray-500 ml-1">campaign{artist.successfulCampaigns !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 mt-8 pb-16 space-y-8">
        {/* Bio */}
        {artist.bio && (
          <div className="bg-noir-900 border border-noir-700 rounded-xl p-6">
            <h2 className="font-display text-sm tracking-wider text-amber-500 uppercase mb-3">About</h2>
            <p className="text-gray-300 leading-relaxed whitespace-pre-line">{artist.bio}</p>
          </div>
        )}

        {/* Genres & Instruments */}
        {(artist.genres.length > 0 || artist.instruments.length > 0) && (
          <div className="flex flex-wrap gap-6">
            {artist.genres.length > 0 && (
              <div>
                <h3 className="font-display text-xs tracking-wider text-gray-500 uppercase mb-2">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {artist.genres.map((g) => (
                    <span key={g} className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-full border border-amber-500/20">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {artist.instruments.length > 0 && (
              <div>
                <h3 className="font-display text-xs tracking-wider text-gray-500 uppercase mb-2">Instruments</h3>
                <div className="flex flex-wrap gap-2">
                  {artist.instruments.map((i) => (
                    <span key={i} className="px-3 py-1 bg-noir-800 text-gray-300 text-xs font-medium rounded-full border border-noir-700">
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Social Links & Streaming */}
        {allSocials.length > 0 && (
          <div className="bg-noir-900 border border-noir-700 rounded-xl p-6">
            <h2 className="font-display text-sm tracking-wider text-amber-500 uppercase mb-4">Listen & Follow</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allSocials.map((s) => {
                const info = SOCIAL_ICONS[s.provider] || { label: s.provider, color: '#888' };
                return (
                  <a
                    key={s.provider}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 bg-noir-800 hover:bg-noir-700 rounded-lg border border-noir-700 transition-colors group"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: info.color + '30', color: info.color }}
                    >
                      {info.label.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 group-hover:text-amber-400 transition-colors">
                        {info.label}
                      </p>
                      {s.followers && (
                        <p className="text-xs text-gray-500">{formatNumber(s.followers)} followers</p>
                      )}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 group-hover:text-amber-400 transition-colors shrink-0">
                      <path d="M7 17L17 7M17 7H7M17 7v10" />
                    </svg>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Shows */}
        {upcomingEvents.length > 0 && (
          <div className="bg-noir-900 border border-noir-700 rounded-xl p-6">
            <h2 className="font-display text-sm tracking-wider text-amber-500 uppercase mb-4">Upcoming Shows</h2>
            <div className="space-y-3">
              {upcomingEvents.map((evt) => (
                <Link
                  key={evt.id}
                  to={`/events/${evt.id}`}
                  className="flex items-center gap-4 p-4 bg-noir-800 hover:bg-noir-700 rounded-lg border border-noir-700 transition-colors group"
                >
                  {evt.flyerImageUrl ? (
                    <img src={evt.flyerImageUrl} alt={evt.name} className="w-16 h-16 object-cover rounded-lg shrink-0" />
                  ) : (
                    <div className="w-16 h-16 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-amber-500 text-lg font-display">
                        {new Date(evt.date).getDate()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 group-hover:text-amber-400 transition-colors truncate">
                      {evt.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(evt.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    {(evt.venueName || evt.city) && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {[evt.venueName, evt.city, evt.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-full border border-amber-500/20 shrink-0">
                    Support
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Past Shows */}
        {pastEvents.length > 0 && (
          <div>
            <h2 className="font-display text-sm tracking-wider text-gray-500 uppercase mb-3">Past Shows</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pastEvents.map((evt) => (
                <Link
                  key={evt.id}
                  to={`/events/${evt.id}`}
                  className="flex items-center gap-3 p-3 bg-noir-900/50 hover:bg-noir-800/50 rounded-lg border border-noir-800 transition-colors group"
                >
                  <div className="text-center shrink-0 w-12">
                    <p className="text-xs text-gray-600 uppercase">
                      {new Date(evt.date).toLocaleDateString('en-US', { month: 'short' })}
                    </p>
                    <p className="text-lg font-display text-gray-400">
                      {new Date(evt.date).getDate()}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors truncate">{evt.name}</p>
                    {evt.venueName && <p className="text-xs text-gray-600 truncate">{evt.venueName}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Support CTA */}
        {upcomingEvents.length > 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm mb-4">Want to see {artist.stageName} live?</p>
            <Link
              to={`/events/${upcomingEvents[0].id}`}
              className="inline-block px-8 py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors"
            >
              Support Their Next Show
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
