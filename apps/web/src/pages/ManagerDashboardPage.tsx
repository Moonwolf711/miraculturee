import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';
import SEO from '../components/SEO.js';
import { PageError, StatsSkeleton } from '../components/LoadingStates.js';

/* ---------- Type definitions ---------- */

interface DashboardStats {
  managedArtists: number;
  totalCampaigns: number;
  totalFundedCents: number;
  totalEvents: number;
  upcomingEvents: UpcomingEvent[];
}

interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  venueName: string;
  venueCity: string;
  artistStageName: string;
}

interface ManagedArtist {
  artistId: string;
  stageName: string;
  genre: string | null;
  isVerified: boolean;
  permission: 'READ' | 'READ_WRITE';
  activeCampaigns: number;
  totalFundedCents: number;
  upcomingEvents: number;
}

interface ArtistCampaign {
  id: string;
  headline: string;
  status: string;
  fundedCents: number;
  goalCents: number;
  eventTitle: string;
  eventDate: string;
  venueName: string;
}

/* ---------- Helpers ---------- */

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-500/10 border-green-500/30 text-green-400',
    FUNDED: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    COMPLETED: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    CANCELLED: 'bg-red-500/10 border-red-500/30 text-red-400',
    DRAFT: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
  };
  const cls = colors[status] || colors.DRAFT;
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${cls}`}>
      {status}
    </span>
  );
}

function PermissionBadge({ permission }: { permission: string }) {
  const isReadWrite = permission === 'READ_WRITE';
  return (
    <span
      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
        isReadWrite
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          : 'bg-noir-700/50 border-noir-600 text-gray-400'
      }`}
    >
      {isReadWrite ? 'Read & Write' : 'Read Only'}
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-full text-xs font-medium">
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      Verified
    </span>
  );
}

/* ---------- Main Component ---------- */

export default function ManagerDashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [artists, setArtists] = useState<ManagedArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Track which artist cards are expanded and their loaded campaigns
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);
  const [artistCampaigns, setArtistCampaigns] = useState<Record<string, ArtistCampaign[]>>({});
  const [campaignsLoading, setCampaignsLoading] = useState<string | null>(null);

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    Promise.all([
      api.get<DashboardStats>('/manager/dashboard'),
      api.get<{ artists: ManagedArtist[] }>('/manager/artists'),
    ])
      .then(([dash, arts]) => {
        setDashboard(dash);
        setArtists(arts.artists);
      })
      .catch((err: Error) => {
        setFetchError(err.message || 'Failed to load dashboard. Please try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const toggleArtist = useCallback(
    (artistId: string) => {
      if (expandedArtist === artistId) {
        setExpandedArtist(null);
        return;
      }
      setExpandedArtist(artistId);

      // Load campaigns if not already cached
      if (!artistCampaigns[artistId]) {
        setCampaignsLoading(artistId);
        api
          .get<{ campaigns: ArtistCampaign[] }>(`/manager/artists/${artistId}/campaigns`)
          .then((data) => {
            setArtistCampaigns((prev) => ({ ...prev, [artistId]: data.campaigns }));
          })
          .catch(() => {
            setArtistCampaigns((prev) => ({ ...prev, [artistId]: [] }));
          })
          .finally(() => setCampaignsLoading(null));
      }
    },
    [expandedArtist, artistCampaigns],
  );

  /* ---------- Loading skeleton ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-noir-950">
        <SEO title="Manager Dashboard" description="Loading your manager dashboard..." noindex />
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-8">
            <div className="h-8 w-56 bg-noir-800 rounded animate-pulse" />
          </div>
          <StatsSkeleton count={4} />
          <div className="h-6 w-40 bg-noir-800 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-noir-800 border border-noir-700 rounded-xl p-5 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="h-5 w-48 bg-noir-700 rounded" />
                    <div className="h-4 w-36 bg-noir-700 rounded" />
                  </div>
                  <div className="text-right space-y-2">
                    <div className="h-5 w-16 bg-noir-700 rounded" />
                    <div className="h-3 w-14 bg-noir-700 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Error state ---------- */
  if (fetchError) return <PageError message={fetchError} onRetry={fetchDashboard} />;

  /* ---------- Null guard ---------- */
  if (!dashboard) return <PageError message="Failed to load dashboard data." onRetry={fetchDashboard} />;

  return (
    <div className="min-h-screen bg-noir-950">
      <SEO
        title="Manager Dashboard"
        description="Manage your artists, track campaigns, and monitor events from your manager dashboard."
        noindex
      />
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl tracking-wider text-warm-50">
              MANAGER DASHBOARD
            </h1>
            {user?.name && (
              <p className="text-gray-400 text-sm mt-1">
                Welcome back, {user.name}
              </p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10" role="list" aria-label="Dashboard statistics">
          <div
            className="bg-noir-800 border border-noir-700 rounded-xl p-5"
            role="listitem"
            aria-label={`Managed Artists: ${dashboard.managedArtists}`}
          >
            <div className="font-display text-3xl text-warm-50">{dashboard.managedArtists}</div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Managed Artists</div>
          </div>
          <div
            className="bg-noir-800 border border-noir-700 rounded-xl p-5"
            role="listitem"
            aria-label={`Total Campaigns: ${dashboard.totalCampaigns}`}
          >
            <div className="font-display text-3xl text-warm-50">{dashboard.totalCampaigns}</div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Total Campaigns</div>
          </div>
          <div
            className="bg-noir-800 border border-noir-700 rounded-xl p-5"
            role="listitem"
            aria-label={`Total Funded: ${formatPrice(dashboard.totalFundedCents)}`}
          >
            <div className="font-display text-3xl text-amber-400">
              {formatPrice(dashboard.totalFundedCents)}
            </div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Total Funded</div>
          </div>
          <div
            className="bg-noir-800 border border-noir-700 rounded-xl p-5"
            role="listitem"
            aria-label={`Total Events: ${dashboard.totalEvents}`}
          >
            <div className="font-display text-3xl text-warm-50">{dashboard.totalEvents}</div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Total Events</div>
          </div>
        </div>

        {/* Managed Artists Section */}
        <section className="mb-10">
          <h2 className="font-display text-xl tracking-wider text-warm-50 mb-4">
            MANAGED ARTISTS
          </h2>
          {artists.length === 0 ? (
            <div className="bg-noir-900 border border-noir-700 rounded-xl p-8 text-center">
              <p className="text-gray-400 text-sm">
                You are not managing any artists yet. Accept a manager invitation from an artist to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {artists.map((artist) => {
                const isExpanded = expandedArtist === artist.artistId;
                const campaigns = artistCampaigns[artist.artistId];
                const isLoadingCampaigns = campaignsLoading === artist.artistId;

                return (
                  <div
                    key={artist.artistId}
                    className={`bg-noir-900 border rounded-xl transition-colors ${
                      isExpanded ? 'border-amber-500/30' : 'border-noir-700 hover:border-amber-500/30'
                    }`}
                  >
                    {/* Artist card header - clickable */}
                    <button
                      onClick={() => toggleArtist(artist.artistId)}
                      className="w-full text-left p-5 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-display text-lg tracking-wider text-warm-50">
                            {artist.stageName}
                          </span>
                          {artist.isVerified && <VerifiedBadge />}
                          <PermissionBadge permission={artist.permission} />
                        </div>
                        {artist.genre && (
                          <p className="text-gray-400 text-sm">{artist.genre}</p>
                        )}
                        <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                          <span>{artist.activeCampaigns} active campaign{artist.activeCampaigns !== 1 ? 's' : ''}</span>
                          <span>{formatPrice(artist.totalFundedCents)} funded</span>
                          <span>{artist.upcomingEvents} upcoming event{artist.upcomingEvents !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform shrink-0 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded campaigns list */}
                    {isExpanded && (
                      <div className="border-t border-noir-700 px-5 pb-5 pt-4">
                        <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3">
                          Campaigns
                        </h3>
                        {isLoadingCampaigns ? (
                          <div className="space-y-2 animate-pulse">
                            {[1, 2].map((i) => (
                              <div key={i} className="bg-noir-800 rounded-lg p-4">
                                <div className="h-4 w-48 bg-noir-700 rounded mb-2" />
                                <div className="h-3 w-32 bg-noir-700 rounded" />
                              </div>
                            ))}
                          </div>
                        ) : campaigns && campaigns.length > 0 ? (
                          <div className="space-y-2">
                            {campaigns.map((campaign) => (
                              <div
                                key={campaign.id}
                                className="bg-noir-800 border border-noir-700 rounded-lg p-4 flex items-center justify-between gap-4"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-warm-50 text-sm font-medium truncate">
                                      {campaign.headline}
                                    </span>
                                    <StatusBadge status={campaign.status} />
                                  </div>
                                  <p className="text-gray-500 text-xs">
                                    {campaign.eventTitle} &middot; {campaign.venueName} &middot; {formatDate(campaign.eventDate)}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-amber-400 font-display text-sm">
                                    {formatPrice(campaign.fundedCents)}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    of {formatPrice(campaign.goalCents)}
                                  </div>
                                  {campaign.goalCents > 0 && (
                                    <div className="w-20 h-1.5 bg-noir-700 rounded-full mt-1.5 overflow-hidden">
                                      <div
                                        className="h-full bg-amber-500 rounded-full"
                                        style={{
                                          width: `${Math.min(100, (campaign.fundedCents / campaign.goalCents) * 100)}%`,
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">No campaigns found for this artist.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Upcoming Events Section */}
        <section>
          <h2 className="font-display text-xl tracking-wider text-warm-50 mb-4">
            UPCOMING EVENTS
          </h2>
          {dashboard.upcomingEvents.length === 0 ? (
            <div className="bg-noir-900 border border-noir-700 rounded-xl p-8 text-center">
              <p className="text-gray-400 text-sm">
                No upcoming events across your managed artists.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dashboard.upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-noir-900 border border-noir-700 rounded-xl p-5 hover:border-amber-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-warm-50 font-medium truncate">{event.title}</h3>
                      <p className="text-gray-400 text-sm mt-0.5">
                        {event.venueName} &middot; {event.venueCity}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {event.artistStageName}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-amber-400 text-sm font-medium">
                        {formatDate(event.date)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
