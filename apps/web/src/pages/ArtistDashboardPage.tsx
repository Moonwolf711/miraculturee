import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';
import SEO from '../components/SEO.js';
import { PageLoading, PageError, StatsSkeleton } from '../components/LoadingStates.js';

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
  currentLevel: number;
  tierWithinLevel: number;
  maxTicketsForLevel: number;
  nextLevelTickets: number;
  canLevelUp: boolean;
  isMaxed: boolean;
  totalTiersCompleted: number;
  totalTiersRequired: number;
  discountCents: number;
}

interface AgentInfo {
  id: string;
  displayName: string;
  city: string;
  state: string;
  rating: number | null;
  profileImageUrl: string | null;
}

interface AgentCampaignInfo {
  id: string;
  status: string;
  revenueSharePct: number;
  artistRating: number | null;
  agent: AgentInfo;
}

interface CampaignItem {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  headline: string;
  status: string;
  createdAt: string;
  agentCampaign: AgentCampaignInfo | null;
}

interface MarketplaceAgent {
  id: string;
  displayName: string;
  bio: string | null;
  state: string;
  city: string;
  profileImageUrl: string | null;
  totalCampaigns: number;
  rating: number | null;
}

const PROMO_TEMPLATES = [
  {
    platform: 'Instagram / TikTok',
    btnClass: 'bg-gradient-to-r from-[#833AB4]/15 via-[#E1306C]/15 to-[#F77737]/15 hover:from-[#833AB4]/25 hover:via-[#E1306C]/25 hover:to-[#F77737]/25 text-[#E1306C] border-[#E1306C]/20',
    template: (venue: string, _url: string) =>
      `I just launched a campaign on @miraculturee for my show at ${venue}. Fans worldwide can donate to unlock $5\u2013$10 tickets for locals who might not be able to afford face value. 100% of donations come to me. Link in bio.\n\n#MiraCulture #LiveMusic #FanPowered`,
  },
  {
    platform: 'X / Twitter',
    btnClass: 'bg-noir-700 hover:bg-noir-600 text-warm-50 border-noir-600',
    template: (venue: string, url: string) =>
      `Just launched my @miraculturee campaign. Fans can donate to unlock affordable tickets for my ${venue} show \u2014 100% comes to me, 0% to scalpers.\n\nSupport the music: ${url}\n\n#MiraCulture`,
  },
  {
    platform: 'Facebook',
    btnClass: 'bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] border-[#1877F2]/20',
    template: (venue: string, url: string) =>
      `Excited to launch my MiraCulture campaign for my upcoming show at ${venue}!\n\nHere\u2019s how it works: fans donate to hit a goal, then 10 tickets unlock at just $5\u2013$10 for verified local fans. Every dollar donated goes directly to me. No middlemen.\n\nSupport here: ${url}`,
  },
  {
    platform: 'General',
    btnClass: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20',
    template: (venue: string, url: string) =>
      `I\u2019m running a fan-powered campaign on MiraCulture for my show at ${venue}. Donate to help unlock affordable tickets for local fans \u2014 100% goes to me. ${url}`,
  },
];

export default function ArtistDashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [promotingCampaign, setPromotingCampaign] = useState<CampaignItem | null>(null);
  const [copiedIdx, setCopiedIdx] = useState(-1);
  const [agentPickerCampaign, setAgentPickerCampaign] = useState<CampaignItem | null>(null);
  const [availableAgents, setAvailableAgents] = useState<MarketplaceAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [assigningAgentId, setAssigningAgentId] = useState<string | null>(null);
  const [agentError, setAgentError] = useState('');
  const [managers, setManagers] = useState<{ id: string; displayName: string; permission: string; bio: string | null; user: { email: string; name: string } }[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitePermission, setInvitePermission] = useState<'READ' | 'READ_WRITE'>('READ_WRITE');
  const [inviteLink, setInviteLink] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    Promise.all([
      api.get<Dashboard>('/artist/dashboard'),
      api.get<{ campaigns: CampaignItem[] }>('/artist/campaigns?limit=5').catch(() => ({ campaigns: [] })),
    ])
      .then(([dash, camp]) => {
        setDashboard(dash);
        setCampaigns(camp.campaigns);
      })
      .catch((err: Error) => {
        setFetchError(err.message || 'Failed to load dashboard. Please try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const fetchManagers = useCallback(() => {
    setManagersLoading(true);
    api.get<{ managers: typeof managers }>('/artist/managers')
      .then((data) => setManagers(data.managers))
      .catch(() => setManagers([]))
      .finally(() => setManagersLoading(false));
  }, []);

  useEffect(() => { fetchManagers(); }, [fetchManagers]);

  const createInvite = useCallback(async () => {
    setCreatingInvite(true);
    try {
      const { inviteUrl } = await api.post<{ inviteUrl: string }>('/artist/managers/invite', { permission: invitePermission });
      setInviteLink(inviteUrl);
    } catch {
      setInviteLink('');
    } finally {
      setCreatingInvite(false);
    }
  }, [invitePermission]);

  const removeManager = useCallback(async (id: string) => {
    try {
      await api.delete(`/artist/managers/${id}`);
      fetchManagers();
    } catch {}
  }, [fetchManagers]);

  const openAgentPicker = useCallback((campaign: CampaignItem) => {
    setAgentPickerCampaign(campaign);
    setAgentError('');
    setAgentsLoading(true);
    api.get<{ agents: MarketplaceAgent[] }>('/agents?limit=50')
      .then((data) => setAvailableAgents(data.agents))
      .catch(() => setAvailableAgents([]))
      .finally(() => setAgentsLoading(false));
  }, []);

  const assignAgent = useCallback(async (agentId: string, campaignId: string) => {
    setAssigningAgentId(agentId);
    setAgentError('');
    try {
      await api.post('/agents/assign', { agentId, campaignId });
      setAgentPickerCampaign(null);
      fetchDashboard();
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : 'Failed to assign agent');
    } finally {
      setAssigningAgentId(null);
    }
  }, [fetchDashboard]);

  const removeAgent = useCallback(async (agentCampaignId: string) => {
    try {
      await api.delete(`/agents/assign/${agentCampaignId}`);
      fetchDashboard();
    } catch (err) {
      // silently ignore; dashboard will refresh
    }
  }, [fetchDashboard]);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  /* ---------- Loading state with skeleton ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-noir-950">
        <SEO title="Artist Dashboard" description="Loading your artist dashboard..." noindex />
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-8">
            <div className="h-8 w-56 bg-noir-800 rounded animate-pulse" />
            <div className="h-10 w-28 bg-noir-800 rounded-lg animate-pulse" />
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

  /* ---------- Error state with retry ---------- */
  if (fetchError) return <PageError message={fetchError} onRetry={fetchDashboard} />;

  /* ---------- Unexpected null state ---------- */
  if (!dashboard) return <PageError message="Failed to load dashboard data." onRetry={fetchDashboard} />;

  return (
    <div className="min-h-screen bg-noir-950">
      <SEO
        title="Artist Dashboard"
        description="Manage your MiraCulture events, track support ticket sales, and view raffle statistics from your artist dashboard."
        noindex
      />
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl tracking-wider text-warm-50">
            ARTIST DASHBOARD
          </h1>
          <div className="flex gap-3">
            <Link
              to="/artist/earnings"
              className="px-5 py-2.5 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-semibold rounded-lg text-sm transition-colors"
            >
              Earnings
            </Link>
            {user?.role === 'ADMIN' && (
              <Link
                to="/artist/campaigns/new"
                className="px-5 py-2.5 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-semibold rounded-lg text-sm transition-colors"
              >
                New Campaign
              </Link>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10" role="list" aria-label="Dashboard statistics">
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5" role="listitem" aria-label={`Total Events: ${dashboard.totalEvents}`}>
            <div className="font-display text-3xl text-warm-50">{dashboard.totalEvents}</div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Total Events</div>
          </div>
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5" role="listitem" aria-label={`Tickets Supported: ${dashboard.totalSupport}`}>
            <div className="font-display text-3xl text-warm-50">{dashboard.totalSupport}</div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Tickets Supported</div>
          </div>
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5" role="listitem" aria-label={`Total Support: ${formatPrice(dashboard.totalSupportAmountCents)}`}>
            <div className="font-display text-3xl text-amber-400">
              {formatPrice(dashboard.totalSupportAmountCents)}
            </div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Total Support</div>
          </div>
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5" role="listitem" aria-label={`Raffle Entries: ${dashboard.totalRaffleEntries}`}>
            <div className="font-display text-3xl text-warm-50">{dashboard.totalRaffleEntries}</div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Raffle Entries</div>
          </div>
        </div>

        {/* Achievement Progression — only render when API returns level data */}
        {dashboard.currentLevel != null && (
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-6 mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl tracking-wider text-warm-50">
                ARTIST LEVEL
              </h2>
              <span className="font-display text-2xl text-amber-400">
                {dashboard.currentLevel} / 10
              </span>
            </div>

            {dashboard.isMaxed && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 mb-4 text-center">
                <span className="text-amber-400 font-semibold text-sm uppercase tracking-wider">
                  Maximum Level Achieved
                </span>
              </div>
            )}

            {/* Overall progress bar (X/60) */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{dashboard.totalTiersCompleted} / {dashboard.totalTiersRequired} campaigns</span>
                <span>{dashboard.totalTiersRequired > 0 ? Math.round((dashboard.totalTiersCompleted / dashboard.totalTiersRequired) * 100) : 0}%</span>
              </div>
              <div className="w-full h-2 bg-noir-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${dashboard.totalTiersRequired > 0 ? (dashboard.totalTiersCompleted / dashboard.totalTiersRequired) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Tier progress within current level (6 segments) */}
            {!dashboard.isMaxed && (
              <div className="mb-5">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Level {dashboard.currentLevel} Progress
                </p>
                <div className="flex gap-1">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full h-3 rounded-sm transition-colors ${
                          i < dashboard.tierWithinLevel
                            ? 'bg-amber-500'
                            : i === dashboard.tierWithinLevel
                              ? 'bg-amber-500/40'
                              : 'bg-noir-950'
                        }`}
                      />
                      <span className="text-[10px] text-gray-500">${5 + i}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stat boxes */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-noir-950 rounded-lg p-3 text-center">
                <div className="font-display text-xl text-warm-50">${(dashboard.discountCents / 100).toFixed(0)}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Local Fan Price</div>
              </div>
              <div className="bg-noir-950 rounded-lg p-3 text-center">
                <div className="font-display text-xl text-warm-50">{dashboard.maxTicketsForLevel}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Max Tickets</div>
              </div>
              <div className="bg-noir-950 rounded-lg p-3 text-center">
                <div className="font-display text-xl text-warm-50">
                  {dashboard.isMaxed ? '---' : dashboard.nextLevelTickets}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">
                  {dashboard.isMaxed ? 'Maxed Out' : 'Next Level'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Events */}
        <h2 className="font-display text-xl tracking-wider text-warm-50 mb-4">
          UPCOMING SHOWS
        </h2>
        {dashboard.upcomingEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-noir-800 border border-noir-700 rounded-xl">
            <div className="w-14 h-14 rounded-full border-2 border-noir-700 flex items-center justify-center mb-5">
              <svg
                className="w-6 h-6 text-gray-700"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                />
              </svg>
            </div>
            <h3 className="font-display text-lg tracking-wider text-gray-500 mb-2">
              NO UPCOMING SHOWS
            </h3>
            <p className="text-gray-400 text-sm font-body mb-5">
              You don't have any upcoming events yet. Create one to start reaching fans!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {dashboard.upcomingEvents.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="block bg-noir-800 border border-noir-700 rounded-xl p-5 hover:border-amber-500/30 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-warm-50 font-medium">{event.title}</h3>
                    <p className="text-sm text-gray-400 mt-1 font-body">
                      {event.venueName}, {event.venueCity} &middot; {formatDate(event.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-warm-50 font-display text-lg">
                      {event.supportedTickets}
                    </div>
                    <div className="text-xs uppercase tracking-wider text-gray-400">supported</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Campaigns — admin only */}
        {user?.role === 'ADMIN' && (
          <>
            <div className="flex items-center justify-between mt-10 mb-4">
              <h2 className="font-display text-xl tracking-wider text-warm-50">
                CAMPAIGNS
              </h2>
              <Link
                to="/artist/campaigns/new"
                className="text-amber-400 hover:text-amber-300 text-sm font-body transition-colors"
              >
                View all
              </Link>
            </div>
            {campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-noir-800 border border-noir-700 rounded-xl">
                <div className="w-14 h-14 rounded-full border-2 border-noir-700 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-gray-700" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
                  </svg>
                </div>
                <h3 className="font-display text-lg tracking-wider text-gray-500 mb-2">NO CAMPAIGNS YET</h3>
                <p className="text-gray-400 text-sm font-body mb-5">
                  Promote your shows to reach more fans. Create a campaign to get started.
                </p>
                <Link
                  to="/artist/campaigns/new"
                  className="px-5 py-2.5 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-semibold rounded-lg text-sm transition-colors"
                >
                  Create Campaign
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="bg-noir-800 border border-noir-700 rounded-xl p-5"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-warm-50 font-medium">{c.headline}</h3>
                        <p className="text-sm text-gray-400 mt-1 font-body">
                          {c.eventTitle} &middot; {formatDate(c.eventDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.status === 'ACTIVE' && (
                          <button
                            onClick={() => setPromotingCampaign(c)}
                            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs uppercase tracking-wide font-semibold transition-colors"
                          >
                            Promote
                          </button>
                        )}
                        <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold ${
                          c.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : c.status === 'DRAFT' ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                              : 'bg-noir-700 text-gray-500 border border-noir-600'
                        }`}>
                          {c.status}
                        </span>
                      </div>
                    </div>

                    {/* Agent assignment row */}
                    <div className="mt-3 pt-3 border-t border-noir-700/50">
                      {c.agentCampaign ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-noir-700 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">
                              {c.agentCampaign.agent.profileImageUrl ? (
                                <img src={c.agentCampaign.agent.profileImageUrl} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                c.agentCampaign.agent.displayName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <span className="text-warm-50 text-sm font-medium">{c.agentCampaign.agent.displayName}</span>
                              <span className="text-gray-500 text-xs ml-2">
                                {c.agentCampaign.agent.city}, {c.agentCampaign.agent.state}
                              </span>
                              <span className="text-gray-600 text-xs ml-2">{c.agentCampaign.revenueSharePct}% split</span>
                            </div>
                          </div>
                          {c.agentCampaign.status !== 'COMPLETED' && (
                            <button
                              onClick={() => removeAgent(c.agentCampaign!.id)}
                              className="px-2.5 py-1 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-xs transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => openAgentPicker(c)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-noir-700/50 hover:bg-noir-700 border border-noir-600/50 hover:border-amber-500/30 rounded-lg text-xs text-gray-400 hover:text-amber-400 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Add Promoter Agent
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Manager Section */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl tracking-wider text-warm-50">MANAGERS</h2>
            <button
              onClick={() => { setShowInviteModal(true); setInviteLink(''); }}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs uppercase tracking-wide font-semibold transition-colors"
            >
              + Invite Manager
            </button>
          </div>

          {managersLoading ? (
            <div className="text-gray-500 text-sm py-4">Loading managers...</div>
          ) : managers.length === 0 ? (
            <div className="bg-noir-800 border border-noir-700 rounded-xl p-6 text-center">
              <p className="text-gray-500 text-sm mb-2">No managers added yet.</p>
              <p className="text-gray-600 text-xs">Share an invite link to add someone who can help manage your campaigns and profile.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {managers.map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-noir-800 border border-noir-700/50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-noir-700 flex items-center justify-center text-amber-400 text-sm font-bold shrink-0">
                      {m.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-warm-50 text-sm font-medium">{m.displayName}</div>
                      <div className="text-gray-500 text-xs">{m.user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold ${
                      m.permission === 'READ_WRITE'
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                    }`}>
                      {m.permission === 'READ_WRITE' ? 'Read & Write' : 'Read Only'}
                    </span>
                    <button
                      onClick={() => removeManager(m.id)}
                      className="px-2.5 py-1 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-xs transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manager invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
          <div className="bg-noir-900 border border-noir-800 rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl tracking-wider text-warm-50">INVITE MANAGER</h2>
              <button onClick={() => setShowInviteModal(false)} className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors" aria-label="Close">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-4">Share a link to invite someone to manage your artist profile and campaigns.</p>

            <div className="mb-4">
              <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">Permission Level</label>
              <div className="flex gap-3">
                {([
                  { value: 'READ_WRITE' as const, label: 'Read & Write', desc: 'Full management access' },
                  { value: 'READ' as const, label: 'Read Only', desc: 'View-only access' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setInvitePermission(opt.value)}
                    className={`flex-1 p-3 border rounded-lg text-center transition-colors ${
                      invitePermission === opt.value
                        ? 'border-amber-500 bg-amber-500/5 text-warm-50'
                        : 'border-noir-700 bg-noir-800 text-gray-400 hover:border-noir-600'
                    }`}
                  >
                    <div className="font-semibold text-sm">{opt.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {!inviteLink ? (
              <button
                onClick={createInvite}
                disabled={creatingInvite}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                {creatingInvite ? 'Generating...' : 'Generate Invite Link'}
              </button>
            ) : (
              <div className="bg-noir-950 border border-noir-800 rounded-lg p-4">
                <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-2">Invite Link (expires in 7 days)</p>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 text-sm font-body truncate flex-1">{inviteLink}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(inviteLink).catch(() => {}); }}
                    className="flex-shrink-0 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Promotion modal */}
      {promotingCampaign && (() => {
        const shareUrl = `${window.location.origin}/events/${promotingCampaign.eventId}`;
        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setPromotingCampaign(null); setCopiedIdx(-1); }}
          >
            <div
              className="bg-noir-900 border border-noir-800 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-xl tracking-wider text-warm-50">
                  PROMOTE CAMPAIGN
                </h2>
                <button
                  onClick={() => { setPromotingCampaign(null); setCopiedIdx(-1); }}
                  className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Share link */}
              <div className="bg-noir-950 border border-noir-800 rounded-lg p-4 mb-5">
                <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-2">Share link</p>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 text-sm font-body truncate flex-1">{shareUrl}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(shareUrl).catch(() => {}); setCopiedIdx(-2); setTimeout(() => setCopiedIdx(-1), 2000); }}
                    className="flex-shrink-0 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-semibold transition-colors"
                  >
                    {copiedIdx === -2 ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Templates */}
              <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-3">
                Ready-to-post templates
              </p>
              <div className="space-y-3">
                {PROMO_TEMPLATES.map((tmpl, i) => {
                  const text = tmpl.template(promotingCampaign.venueName, shareUrl);
                  return (
                    <div key={tmpl.platform} className="bg-noir-800 border border-noir-700 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-body text-xs uppercase tracking-wider text-gray-400 font-semibold">
                          {tmpl.platform}
                        </span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopiedIdx(i); setTimeout(() => setCopiedIdx(-1), 2000); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${tmpl.btnClass}`}
                        >
                          {copiedIdx === i ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <p className="font-body text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                        {text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Agent picker modal */}
      {agentPickerCampaign && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setAgentPickerCampaign(null)}
        >
          <div
            className="bg-noir-900 border border-noir-800 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl tracking-wider text-warm-50">
                SELECT AGENT
              </h2>
              <button
                onClick={() => setAgentPickerCampaign(null)}
                className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-gray-500 text-sm font-body mb-5">
              Choose a verified promoter agent for "{agentPickerCampaign.headline}"
            </p>

            {agentError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm mb-4">
                {agentError}
              </div>
            )}

            {agentsLoading ? (
              <div className="text-center text-gray-500 py-8">Loading agents...</div>
            ) : availableAgents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">No verified agents available yet.</p>
                <Link
                  to="/agents"
                  className="text-amber-400 text-sm hover:underline"
                  onClick={() => setAgentPickerCampaign(null)}
                >
                  Browse Agent Marketplace
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {availableAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between bg-noir-800 border border-noir-700/50 rounded-xl p-4 hover:border-amber-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-noir-700 flex items-center justify-center text-amber-400 text-sm font-bold shrink-0">
                        {agent.profileImageUrl ? (
                          <img src={agent.profileImageUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          agent.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-warm-50 text-sm font-medium truncate">{agent.displayName}</div>
                        <div className="text-gray-500 text-xs">
                          {agent.city}, {agent.state}
                          {agent.rating !== null && (
                            <span className="ml-2 text-amber-400">{agent.rating.toFixed(1)} stars</span>
                          )}
                          <span className="ml-2">{agent.totalCampaigns} campaigns</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => assignAgent(agent.id, agentPickerCampaign.id)}
                      disabled={assigningAgentId === agent.id}
                      className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs uppercase tracking-wide font-semibold transition-colors disabled:opacity-50 shrink-0 ml-3"
                    >
                      {assigningAgentId === agent.id ? 'Assigning...' : 'Select'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
