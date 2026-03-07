import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';
import { useAuth } from '../hooks/useAuth.js';

// --- Types ---

interface DashboardStats {
  totalRaffleEntries: number;
  raffleWins: number;
  ticketsOwned: number;
  totalSupportedCents: number;
  supportPurchases: number;
}

interface UpcomingTicket {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  venueCity: string;
  type: 'direct' | 'raffle';
  status: string;
}

interface DashboardData {
  stats: DashboardStats;
  upcomingTickets: UpcomingTicket[];
}

interface ImpactData {
  score: number;
  tier: string;
  tierLabel: string;
  nextTier: { name: string; label: string; min: number } | null;
  breakdown: {
    showsSupported: number;
    uniqueArtists: number;
    raffleEntries: number;
    raffleWins: number;
    ticketsPurchased: number;
    totalSupportedCents: number;
    accountAgeDays: number;
  };
}

interface SupportedCampaign {
  supportId: string;
  amountCents: number;
  supportedAt: string;
  event: {
    id: string;
    title: string;
    date: string;
    venueName: string;
    venueCity: string;
  };
  campaign: {
    id: string;
    headline: string;
    status: string;
    goalCents: number;
    fundedCents: number;
    goalReached: boolean;
    bonusCents: number;
  } | null;
}

interface ActivityFeedItem {
  id: string;
  type: 'support' | 'raffle_entry' | 'raffle_win' | 'ticket_purchase';
  message: string;
  eventId: string;
  eventTitle: string;
  artistName: string;
  amountCents: number | null;
  createdAt: string;
}

interface ArtistRelationship {
  artistId: string;
  stageName: string;
  genre: string | null;
  supportCount: number;
  ticketCount: number;
  totalSupportedCents: number;
  totalTicketCents: number;
  totalInteractions: number;
  uniqueEvents: number;
  fanLevel: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  fanLevelLabel: string;
  firstSupport: string;
  lastSupport: string;
}

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface PaginatedNotifications {
  data: Notification[];
  total: number;
  page: number;
  totalPages: number;
}

interface Transaction {
  id: string;
  type: string;
  amountCents: number;
  currency: string;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface CampaignItem {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  headline: string;
  message: string;
  status: string;
  goalCents: number;
  fundedCents: number;
  goalReached: boolean;
  bonusCents: number;
  createdAt: string;
}

interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  totalPages: number;
}

// --- Helpers ---

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getCountdown(iso: string): { days: number; hours: number; mins: number; past: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, past: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return { days, hours, mins, past: false };
}

const TIER_CONFIG: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  LEGEND: { color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-400/40', glow: 'shadow-amber-500/30' },
  HEADLINER: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
  VIP: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', glow: 'shadow-purple-500/20' },
  FRONT_ROW: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
  OPENING_ACT: { color: 'text-gray-400', bg: 'bg-noir-800', border: 'border-noir-700', glow: '' },
};

const TABS = ['overview', 'campaigns', 'raffles', 'tickets', 'notifications', 'transactions', 'security'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  campaigns: 'Campaigns',
  raffles: 'Raffles',
  tickets: 'Tickets',
  notifications: 'Notifications',
  transactions: 'Transactions',
  security: 'Security',
};

const TX_TYPE_LABELS: Record<string, string> = {
  SUPPORT_PURCHASE: 'Support Purchase',
  RAFFLE_ENTRY: 'Raffle Entry',
  TICKET_PURCHASE: 'Ticket Purchase',
  ARTIST_PAYOUT: 'Artist Payout',
  REFUND: 'Refund',
};

// --- Component ---

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'overview';

  const setTab = (tab: Tab) => {
    setSearchParams(tab === 'overview' ? {} : { tab });
  };

  // --- Dashboard Data ---
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);

  // --- Impact Score ---
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [impactLoading, setImpactLoading] = useState(true);

  // --- Supported Campaigns ---
  const [supportedCampaigns, setSupportedCampaigns] = useState<SupportedCampaign[]>([]);
  const [scLoading, setScLoading] = useState(true);

  // --- Activity Feed ---
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  // --- Artist Relationships ---
  const [artistRelationships, setArtistRelationships] = useState<ArtistRelationship[]>([]);
  const [arLoading, setArLoading] = useState(true);

  useEffect(() => {
    setDashLoading(true);
    setImpactLoading(true);
    setScLoading(true);
    setFeedLoading(true);
    setArLoading(true);
    Promise.all([
      api.get<DashboardData>('/user/dashboard').then(setDashboard).catch(() => {}),
      api.get<ImpactData>('/user/impact').then(setImpact).catch(() => {}),
      api.get<SupportedCampaign[]>('/user/supported-campaigns').then(setSupportedCampaigns).catch(() => {}),
      api.get<ActivityFeedItem[]>('/user/activity-feed').then(setActivityFeed).catch(() => {}),
      api.get<ArtistRelationship[]>('/user/artist-relationships').then(setArtistRelationships).catch(() => {}),
    ]).finally(() => {
      setDashLoading(false);
      setImpactLoading(false);
      setScLoading(false);
      setFeedLoading(false);
      setArLoading(false);
    });
  }, []);

  // --- Notifications ---
  const [notifications, setNotifications] = useState<PaginatedNotifications | null>(null);
  const [notifPage, setNotifPage] = useState(1);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');
  const [notifLoading, setNotifLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const readParam = notifFilter === 'unread' ? '&read=false' : '';
      const res = await api.get<PaginatedNotifications>(
        `/user/notifications?page=${notifPage}&limit=20${readParam}`,
      );
      setNotifications(res);
    } catch { /* ignore */ }
    setNotifLoading(false);
  }, [notifPage, notifFilter]);

  useEffect(() => {
    if (activeTab === 'notifications') fetchNotifications();
  }, [activeTab, fetchNotifications]);

  const markRead = async (id: string) => {
    await api.put(`/user/notifications/${id}/read`);
    fetchNotifications();
  };

  // --- Transactions ---
  const [transactions, setTransactions] = useState<PaginatedTransactions | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [txLoading, setTxLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const res = await api.get<PaginatedTransactions>(`/user/transactions?page=${txPage}&limit=20`);
      setTransactions(res);
    } catch { /* ignore */ }
    setTxLoading(false);
  }, [txPage]);

  useEffect(() => {
    if (activeTab === 'transactions') fetchTransactions();
  }, [activeTab, fetchTransactions]);

  // --- Raffles data ---
  const [raffles, setRaffles] = useState<Transaction[] | null>(null);
  const [rafflesLoading, setRafflesLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'raffles') return;
    setRafflesLoading(true);
    api.get<{ data: Transaction[]; total: number }>('/user/transactions?limit=50')
      .then((res) => {
        setRaffles(res.data.filter((t) => t.type === 'RAFFLE_ENTRY'));
      })
      .catch(() => {})
      .finally(() => setRafflesLoading(false));
  }, [activeTab]);

  // --- Campaigns ---
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await api.get<{ campaigns: CampaignItem[] }>('/artist/campaigns?limit=50');
      setCampaigns(res.campaigns);
    } catch { /* artist profile may not exist yet */ }
    setCampaignsLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'campaigns') fetchCampaigns();
  }, [activeTab, fetchCampaigns]);

  const getEventUrl = (eventId: string) => `https://www.mira-culture.com/events/${eventId}`;

  const shareToTwitter = (c: CampaignItem) => {
    const text = `${c.headline}\n\n${c.message.slice(0, 200)}${c.message.length > 200 ? '...' : ''}\n\nGet tickets:`;
    const url = getEventUrl(c.eventId);
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  };

  const shareToFacebook = (c: CampaignItem) => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getEventUrl(c.eventId))}`, '_blank');
  };

  const copyShareText = (c: CampaignItem) => {
    const text = `${c.headline}\n\n${c.message}\n\nGet tickets: ${getEventUrl(c.eventId)}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-noir-950 px-4 py-8 sm:py-12">
      <SEO title="Dashboard" description="Your MiraCulture activity." noindex />
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-3xl tracking-wider text-warm-50 mb-8">MY DASHBOARD</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto border-b border-noir-800 -mx-4 px-4 sm:mx-0 sm:px-0">
          {TABS.filter((tab) => tab !== 'campaigns' || user?.role === 'ADMIN').map((tab) => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Tab Content */}

        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Onboarding Checklist (shown when user has no activity) */}
            {!dashLoading && !impactLoading && !feedLoading && (
              (() => {
                const stats = dashboard?.stats;
                const hasNoActivity = stats && stats.totalRaffleEntries === 0 && stats.ticketsOwned === 0 && stats.supportPurchases === 0;
                if (!hasNoActivity) return null;
                return <OnboardingChecklist setTab={setTab} />;
              })()
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <QuickAction to="/events" icon={<SearchIcon />} label="Find Events" sublabel="Near Me" />
              <QuickAction to="/events" icon={<HeartIcon />} label="Support" sublabel="Artists" />
              <QuickAction to="/events" icon={<DiceIcon />} label="Enter" sublabel="Raffles" />
              <QuickAction to="/dashboard?tab=tickets" icon={<TicketIcon />} label="My" sublabel="Tickets" onClick={() => setTab('tickets')} />
            </div>

            {/* Fan Impact Score + Stats Row */}
            {impactLoading || dashLoading ? (
              <LoadingGrid />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Impact Score Ring */}
                {impact && <ImpactScoreCard impact={impact} />}

                {/* Stats */}
                <div className="md:col-span-2 grid grid-cols-2 gap-3">
                  <AnimatedStatCard label="Raffle Entries" value={dashboard?.stats.totalRaffleEntries ?? 0} />
                  <AnimatedStatCard label="Raffle Wins" value={dashboard?.stats.raffleWins ?? 0} highlight />
                  <AnimatedStatCard label="Tickets Owned" value={dashboard?.stats.ticketsOwned ?? 0} />
                  <AnimatedStatCard label="Total Supported" value={formatCents(dashboard?.stats.totalSupportedCents ?? 0)} prefix="$" />
                </div>
              </div>
            )}

            {/* Artist Relationships */}
            {arLoading ? (
              <LoadingList />
            ) : artistRelationships.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-warm-50 mb-4">Your Artists</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {artistRelationships.slice(0, 6).map((ar) => (
                    <ArtistRelationshipCard key={ar.artistId} data={ar} />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Events with Contextual States */}
            <div>
              <h2 className="text-lg font-semibold text-warm-50 mb-4">Upcoming Events</h2>
              {dashLoading ? (
                <LoadingList />
              ) : dashboard && dashboard.upcomingTickets.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.upcomingTickets.map((t) => (
                    <ContextualEventCard key={t.id} ticket={t} />
                  ))}
                </div>
              ) : (
                <EmptyState message="No upcoming tickets." ctaText="Browse Events" ctaLink="/events" />
              )}
            </div>

            {/* Activity Feed */}
            {feedLoading ? (
              <LoadingList />
            ) : activityFeed.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-warm-50 mb-4">Recent Activity</h2>
                <ActivityFeed items={activityFeed} />
              </div>
            )}

            {/* Campaigns You've Backed — with Ticket Visualization */}
            {!scLoading && supportedCampaigns.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-warm-50 mb-4">Campaigns You've Backed</h2>
                <div className="space-y-3">
                  {supportedCampaigns.map((sc) => (
                    <SupportedCampaignCard key={sc.supportId} data={sc} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'campaigns' && user?.role === 'ADMIN' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-400 text-sm">Create campaigns for your events and share them on social media.</p>
              <Link
                to="/artist/campaigns/new"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg text-sm transition-colors flex-shrink-0"
              >
                New Campaign
              </Link>
            </div>

            {campaignsLoading ? (
              <LoadingList />
            ) : campaigns.length > 0 ? (
              <div className="space-y-4">
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="bg-noir-900 border border-noir-800 rounded-xl p-5"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-warm-50 font-medium">{c.headline}</h3>
                        <p className="text-gray-500 text-sm mt-0.5">
                          {c.eventTitle} &middot; {formatDate(c.eventDate)}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold flex-shrink-0 ${
                        c.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : c.status === 'DRAFT' ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                            : 'bg-noir-700 text-gray-500 border border-noir-600'
                      }`}>
                        {c.status}
                      </span>
                    </div>

                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">{c.message}</p>

                    {c.goalCents > 0 && (
                      <div className="mb-4 p-3 bg-noir-950 rounded-lg border border-noir-800">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-gray-400">
                            ${(c.fundedCents / 100).toFixed(0)} of ${(c.goalCents / 100).toFixed(0)} goal
                          </span>
                          {c.goalReached ? (
                            <span className="text-green-400 font-semibold">Goal Reached!</span>
                          ) : (
                            <span className="text-gray-500">{Math.min(100, Math.round((c.fundedCents / c.goalCents) * 100))}%</span>
                          )}
                        </div>
                        <div className="w-full h-2 bg-noir-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${c.goalReached ? 'bg-green-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(100, (c.fundedCents / c.goalCents) * 100)}%` }}
                          />
                        </div>
                        {c.bonusCents > 0 && (
                          <p className="text-amber-400 text-xs mt-2 font-medium">
                            Bonus earned: ${(c.bonusCents / 100).toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-3 border-t border-noir-800">
                      <span className="text-gray-500 text-xs uppercase tracking-wider mr-1">Share:</span>
                      <button onClick={() => shareToTwitter(c)} className="px-3 py-1.5 bg-noir-800 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 rounded-lg text-xs text-gray-300 hover:text-white transition-colors" title="Share on X (Twitter)">X</button>
                      <button onClick={() => shareToFacebook(c)} className="px-3 py-1.5 bg-noir-800 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 rounded-lg text-xs text-gray-300 hover:text-white transition-colors" title="Share on Facebook">FB</button>
                      <button
                        onClick={() => {
                          const text = `${c.headline}\n\n${c.message.slice(0, 200)}\n\nGet tickets: ${getEventUrl(c.eventId)}`;
                          window.open(`https://www.instagram.com/`, '_blank');
                          navigator.clipboard.writeText(text);
                          setCopiedId(c.id + '-ig');
                          setTimeout(() => setCopiedId(null), 3000);
                        }}
                        className="px-3 py-1.5 bg-noir-800 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 rounded-lg text-xs text-gray-300 hover:text-white transition-colors"
                        title="Open Instagram (copies text to clipboard)"
                      >
                        {copiedId === c.id + '-ig' ? 'Copied!' : 'IG'}
                      </button>
                      <button
                        onClick={() => {
                          const text = `${c.headline}\n\n${c.message.slice(0, 200)}\n\nGet tickets: ${getEventUrl(c.eventId)}`;
                          window.open(`https://www.tiktok.com/`, '_blank');
                          navigator.clipboard.writeText(text);
                          setCopiedId(c.id + '-tt');
                          setTimeout(() => setCopiedId(null), 3000);
                        }}
                        className="px-3 py-1.5 bg-noir-800 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 rounded-lg text-xs text-gray-300 hover:text-white transition-colors"
                        title="Open TikTok (copies text to clipboard)"
                      >
                        {copiedId === c.id + '-tt' ? 'Copied!' : 'TT'}
                      </button>
                      <button onClick={() => copyShareText(c)} className="px-3 py-1.5 bg-noir-800 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 rounded-lg text-xs text-gray-300 hover:text-white transition-colors" title="Copy campaign text to clipboard">
                        {copiedId === c.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                message="No campaigns yet. Create one to promote your shows on social media."
                ctaText="Create Campaign"
                ctaLink="/artist/campaigns/new"
              />
            )}
          </div>
        )}

        {activeTab === 'raffles' && (
          <div>
            {rafflesLoading ? (
              <LoadingList />
            ) : raffles && raffles.length > 0 ? (
              <div className="space-y-3">
                {raffles.map((entry) => (
                  <div key={entry.id} className="bg-noir-900 border border-noir-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-warm-50 font-medium text-sm">Raffle Entry</p>
                        <p className="text-gray-500 text-xs mt-0.5">{formatDateTime(entry.createdAt)}</p>
                      </div>
                      <span className="text-sm font-medium text-gray-300">{formatCents(entry.amountCents)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No raffle entries yet." ctaText="Browse Events" ctaLink="/events" />
            )}
          </div>
        )}

        {activeTab === 'tickets' && (
          <div>
            {dashLoading ? (
              <LoadingList />
            ) : dashboard && dashboard.upcomingTickets.length > 0 ? (
              <div className="space-y-3">
                {dashboard.upcomingTickets.map((t) => (
                  <ContextualEventCard key={t.id} ticket={t} />
                ))}
              </div>
            ) : (
              <EmptyState message="No tickets yet." ctaText="Browse Events" ctaLink="/events" />
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div>
            <div className="flex gap-3 mb-4">
              {(['all', 'unread'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setNotifFilter(f); setNotifPage(1); }}
                  className={`text-sm px-3 py-1 rounded-full transition-colors ${
                    notifFilter === f
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {f === 'all' ? 'All' : 'Unread'}
                </button>
              ))}
            </div>

            {notifLoading ? (
              <LoadingList />
            ) : notifications && notifications.data.length > 0 ? (
              <>
                <div className="space-y-2">
                  {notifications.data.map((n) => (
                    <div
                      key={n.id}
                      className={`bg-noir-900 border border-noir-800 rounded-xl p-4 ${
                        !n.read ? 'border-l-2 border-l-amber-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-warm-50 font-medium text-sm">{n.title}</p>
                          <p className="text-gray-400 text-sm mt-0.5">{n.body}</p>
                          <p className="text-gray-500 text-xs mt-1">{formatDateTime(n.createdAt)}</p>
                        </div>
                        {!n.read && (
                          <button
                            onClick={() => markRead(n.id)}
                            className="text-xs text-amber-400 hover:text-amber-300 flex-shrink-0 transition-colors"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {notifications.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-6">
                    <button disabled={notifPage <= 1} onClick={() => setNotifPage((p) => p - 1)} className="text-sm text-gray-400 hover:text-amber-400 disabled:opacity-30 transition-colors">Previous</button>
                    <span className="text-xs text-gray-500">{notifPage} / {notifications.totalPages}</span>
                    <button disabled={notifPage >= notifications.totalPages} onClick={() => setNotifPage((p) => p + 1)} className="text-sm text-gray-400 hover:text-amber-400 disabled:opacity-30 transition-colors">Next</button>
                  </div>
                )}
              </>
            ) : (
              <EmptyState message="No notifications." />
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div>
            {txLoading ? (
              <LoadingList />
            ) : transactions && transactions.data.length > 0 ? (
              <>
                <div className="space-y-2">
                  {transactions.data.map((tx) => (
                    <div key={tx.id} className="bg-noir-900 border border-noir-800 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-warm-50 font-medium text-sm">
                            {TX_TYPE_LABELS[tx.type] ?? tx.type}
                          </p>
                          <p className="text-gray-500 text-xs mt-0.5">{formatDateTime(tx.createdAt)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-medium text-gray-300">{formatCents(tx.amountCents)}</p>
                          <p className={`text-[10px] uppercase font-medium ${
                            tx.status === 'completed' ? 'text-green-400' :
                            tx.status === 'pending' ? 'text-amber-400' : 'text-gray-500'
                          }`}>
                            {tx.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {transactions.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-6">
                    <button disabled={txPage <= 1} onClick={() => setTxPage((p) => p - 1)} className="text-sm text-gray-400 hover:text-amber-400 disabled:opacity-30 transition-colors">Previous</button>
                    <span className="text-xs text-gray-500">{txPage} / {transactions.totalPages}</span>
                    <button disabled={txPage >= transactions.totalPages} onClick={() => setTxPage((p) => p + 1)} className="text-sm text-gray-400 hover:text-amber-400 disabled:opacity-30 transition-colors">Next</button>
                  </div>
                )}
              </>
            ) : (
              <EmptyState message="No transactions yet." />
            )}
          </div>
        )}

        {activeTab === 'security' && <SecurityTab />}
      </div>
    </div>
  );
}

// ========================================================
// NEW COMPONENTS: Phase 1 Dashboard Enhancements
// ========================================================

// --- Impact Score Card with SVG Ring ---

function ImpactScoreCard({ impact }: { impact: ImpactData }) {
  const tier = TIER_CONFIG[impact.tier] ?? TIER_CONFIG.OPENING_ACT;
  const nextMin = impact.nextTier?.min ?? impact.score;
  const currentTierMin = impact.nextTier
    ? [0, 200, 500, 1000, 2500].find((m) => m <= impact.score && impact.score < (impact.nextTier?.min ?? Infinity)) ?? 0
    : 2500;
  const progress = impact.nextTier
    ? Math.min(1, (impact.score - currentTierMin) / (nextMin - currentTierMin))
    : 1;

  return (
    <div className={`bg-noir-900 border ${tier.border} rounded-xl p-5 flex flex-col items-center justify-center relative overflow-hidden ${tier.glow ? `shadow-lg ${tier.glow}` : ''}`}>
      {/* Ambient glow */}
      <div className="absolute inset-0 opacity-5 bg-gradient-to-br from-amber-500 to-transparent pointer-events-none" />

      {/* SVG Ring */}
      <div className="relative w-28 h-28 mb-3">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="6" className="text-noir-800" />
          <circle
            cx="60" cy="60" r="52" fill="none" strokeWidth="6"
            strokeLinecap="round"
            className="text-amber-500 transition-all duration-1000 ease-out"
            strokeDasharray={`${progress * 326.73} 326.73`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <CountUpNumber value={impact.score} className="text-2xl font-bold text-warm-50" />
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">Impact</span>
        </div>
      </div>

      {/* Tier Badge */}
      <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold ${tier.bg} ${tier.color} border ${tier.border}`}>
        {impact.tierLabel}
      </span>

      {/* Next tier progress */}
      {impact.nextTier && (
        <p className="text-gray-500 text-[10px] mt-2 text-center">
          {impact.nextTier.min - impact.score} pts to {impact.nextTier.label}
        </p>
      )}
    </div>
  );
}

// --- Animated Count-Up Number ---

function CountUpNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (animated.current) return;
    animated.current = true;
    const duration = 800;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(eased * value));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  return <span ref={ref} className={className}>{display.toLocaleString()}</span>;
}

// --- Animated Stat Card ---

function AnimatedStatCard({ label, value, highlight, prefix }: { label: string; value: number | string; highlight?: boolean; prefix?: string }) {
  const numericValue = typeof value === 'number' ? value : null;
  return (
    <div className="bg-noir-900 border border-noir-800 rounded-xl p-4 hover:border-noir-700 transition-all duration-200 group">
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${highlight ? 'text-amber-400' : 'text-warm-50'}`}>
        {numericValue !== null ? (
          <CountUpNumber value={numericValue} />
        ) : (
          value
        )}
      </p>
    </div>
  );
}

// --- Quick Action Button ---

function QuickAction({ to, icon, label, sublabel, onClick }: { to: string; icon: React.ReactNode; label: string; sublabel: string; onClick?: () => void }) {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center gap-1.5 py-4 px-3 bg-noir-900 border border-noir-800 rounded-xl hover:border-amber-500/30 hover:bg-noir-800 transition-all group"
      >
        <span className="text-amber-500 group-hover:text-amber-400 transition-colors">{icon}</span>
        <span className="text-warm-50 text-sm font-medium leading-tight">{label}</span>
        <span className="text-gray-500 text-[10px] uppercase tracking-wider">{sublabel}</span>
      </button>
    );
  }
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1.5 py-4 px-3 bg-noir-900 border border-noir-800 rounded-xl hover:border-amber-500/30 hover:bg-noir-800 transition-all group"
    >
      <span className="text-amber-500 group-hover:text-amber-400 transition-colors">{icon}</span>
      <span className="text-warm-50 text-sm font-medium leading-tight">{label}</span>
      <span className="text-gray-500 text-[10px] uppercase tracking-wider">{sublabel}</span>
    </Link>
  );
}

// --- Supported Campaign Card with Ticket Visualization ---

function SupportedCampaignCard({ data }: { data: SupportedCampaign }) {
  const c = data.campaign;
  const ticketsFunded = c && c.goalCents > 0 ? Math.min(10, Math.round((c.fundedCents / c.goalCents) * 10)) : 0;

  return (
    <Link
      to={`/events/${data.event.id}`}
      className="block bg-noir-900 border border-noir-800 rounded-xl p-4 hover:border-noir-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-warm-50 font-medium text-sm truncate">{data.event.title}</p>
          <p className="text-gray-500 text-xs">{data.event.venueName} &middot; {formatDate(data.event.date)}</p>
        </div>
        <span className="text-amber-400 text-sm font-medium flex-shrink-0">
          {formatCents(data.amountCents)}
        </span>
      </div>

      {c && c.goalCents > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] mb-2">
            <span className="text-gray-500">
              {ticketsFunded} of 10 tickets funded
            </span>
            {c.goalReached ? (
              <span className="text-green-400 font-semibold">Goal Reached!</span>
            ) : (
              <span className="text-gray-500">${(c.fundedCents / 100).toFixed(0)} / ${(c.goalCents / 100).toFixed(0)}</span>
            )}
          </div>
          {/* Ticket icon visualization */}
          <div className="flex gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-6 rounded transition-all duration-500 flex items-center justify-center ${
                  i < ticketsFunded
                    ? c.goalReached ? 'bg-green-500/20 border border-green-500/40' : 'bg-amber-500/20 border border-amber-500/40'
                    : 'bg-noir-800 border border-noir-700'
                }`}
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <svg className={`w-3 h-3 ${
                  i < ticketsFunded
                    ? c.goalReached ? 'text-green-400' : 'text-amber-400'
                    : 'text-noir-700'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
            ))}
          </div>
          {c.bonusCents > 0 && (
            <p className="text-amber-400/70 text-[10px] mt-2">
              Artist bonus: ${(c.bonusCents / 100).toFixed(2)}
            </p>
          )}
        </div>
      )}
    </Link>
  );
}

// --- Quick Action Icons (inline SVGs) ---

function SearchIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function DiceIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="1" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  );
}

// ========================================================
// PHASE 2 COMPONENTS: Activity Feed, Artist Relationships,
// Contextual Events, Onboarding
// ========================================================

// --- Activity Feed ---

const FEED_ICONS: Record<ActivityFeedItem['type'], { icon: string; color: string }> = {
  support: { icon: '♥', color: 'text-pink-400 bg-pink-500/10' },
  raffle_entry: { icon: '🎲', color: 'text-amber-400 bg-amber-500/10' },
  raffle_win: { icon: '🏆', color: 'text-green-400 bg-green-500/10' },
  ticket_purchase: { icon: '🎟', color: 'text-cyan-400 bg-cyan-500/10' },
};

function ActivityFeed({ items }: { items: ActivityFeedItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);

  return (
    <div className="bg-noir-900 border border-noir-800 rounded-xl overflow-hidden">
      <div className="divide-y divide-noir-800">
        {visible.map((item) => {
          const style = FEED_ICONS[item.type];
          return (
            <Link
              key={item.id}
              to={`/events/${item.eventId}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-noir-800/50 transition-colors"
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${style.color}`}>
                {style.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-gray-300 text-sm truncate">{item.message}</p>
                <p className="text-gray-600 text-xs">{timeAgo(item.createdAt)}</p>
              </div>
              {item.amountCents !== null && (
                <span className="text-gray-500 text-xs font-medium flex-shrink-0">
                  {formatCents(item.amountCents)}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      {items.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2.5 text-xs text-gray-500 hover:text-amber-400 border-t border-noir-800 transition-colors"
        >
          {expanded ? 'Show less' : `Show ${items.length - 5} more`}
        </button>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

// --- Artist Relationship Card ---

const FAN_LEVEL_COLORS: Record<string, { badge: string; accent: string }> = {
  PLATINUM: { badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30', accent: 'text-purple-400' },
  GOLD: { badge: 'bg-amber-500/15 text-amber-300 border-amber-400/30', accent: 'text-amber-400' },
  SILVER: { badge: 'bg-gray-400/15 text-gray-300 border-gray-400/30', accent: 'text-gray-300' },
  BRONZE: { badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', accent: 'text-orange-400' },
};

function ArtistRelationshipCard({ data }: { data: ArtistRelationship }) {
  const levelStyle = FAN_LEVEL_COLORS[data.fanLevel] ?? FAN_LEVEL_COLORS.BRONZE;
  const totalCents = data.totalSupportedCents + data.totalTicketCents;

  return (
    <div className="bg-noir-900 border border-noir-800 rounded-xl p-4 hover:border-noir-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* Artist initial avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${levelStyle.badge}`}>
              {data.stageName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-warm-50 font-medium text-sm truncate">{data.stageName}</p>
              {data.genre && <p className="text-gray-600 text-[10px] uppercase tracking-wider">{data.genre}</p>}
            </div>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-semibold border ${levelStyle.badge}`}>
          {data.fanLevelLabel}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className={`text-lg font-semibold ${levelStyle.accent}`}>{data.totalInteractions}</p>
          <p className="text-gray-600 text-[9px] uppercase tracking-wider">Interactions</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-warm-50">{data.uniqueEvents}</p>
          <p className="text-gray-600 text-[9px] uppercase tracking-wider">Events</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-warm-50">${(totalCents / 100).toFixed(0)}</p>
          <p className="text-gray-600 text-[9px] uppercase tracking-wider">Total</p>
        </div>
      </div>

      {/* Level progress bar */}
      <div className="mt-3">
        <ArtistLevelProgress level={data.fanLevel} interactions={data.totalInteractions} />
      </div>
    </div>
  );
}

function ArtistLevelProgress({ level, interactions }: { level: string; interactions: number }) {
  const thresholds = [
    { level: 'BRONZE', min: 1, next: 3 },
    { level: 'SILVER', min: 3, next: 5 },
    { level: 'GOLD', min: 5, next: 10 },
    { level: 'PLATINUM', min: 10, next: 10 },
  ];
  const current = thresholds.find((t) => t.level === level) ?? thresholds[0];
  const progress = level === 'PLATINUM' ? 1 : Math.min(1, (interactions - current.min) / (current.next - current.min));
  const nextLabel = level === 'PLATINUM' ? null : thresholds[thresholds.indexOf(current) + 1]?.level.toLowerCase();

  return (
    <div>
      <div className="w-full h-1 bg-noir-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-700"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {nextLabel && (
        <p className="text-gray-600 text-[9px] mt-1 text-right">
          {current.next - interactions} more to {nextLabel}
        </p>
      )}
    </div>
  );
}

// --- Contextual Event Card (pre-event / day-of / post-event) ---

function ContextualEventCard({ ticket }: { ticket: UpcomingTicket }) {
  const [countdown, setCountdown] = useState(getCountdown(ticket.eventDate));

  useEffect(() => {
    const timer = setInterval(() => setCountdown(getCountdown(ticket.eventDate)), 60000);
    return () => clearInterval(timer);
  }, [ticket.eventDate]);

  const eventDate = new Date(ticket.eventDate);
  const now = new Date();
  const hoursUntil = (eventDate.getTime() - now.getTime()) / 3600000;
  const isDayOf = hoursUntil >= 0 && hoursUntil <= 24;
  const isPast = hoursUntil < 0;
  const isUrgent = hoursUntil > 0 && hoursUntil <= 24;

  // Day-of state
  if (isDayOf) {
    return (
      <Link
        to={`/events/${ticket.eventId}`}
        className="block bg-gradient-to-r from-amber-500/10 to-noir-900 border border-amber-500/30 rounded-xl p-4 shadow-lg shadow-amber-500/5 transition-all hover:border-amber-500/50"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Today's Show</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-warm-50 font-semibold truncate">{ticket.eventTitle}</p>
            <p className="text-gray-400 text-sm">{ticket.venueName} &middot; {ticket.venueCity}</p>
            <p className="text-amber-400 text-xs mt-1 font-medium">
              {eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              ticket.type === 'raffle' ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'
            }`}>
              {ticket.type === 'raffle' ? 'Raffle Win' : 'Purchased'}
            </span>
            {!countdown.past && (
              <span className="text-amber-400 font-mono text-sm font-bold animate-pulse">
                {countdown.hours}h {countdown.mins}m
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Post-event state
  if (isPast) {
    return (
      <Link
        to={`/events/${ticket.eventId}`}
        className="block bg-noir-900 border border-noir-800 rounded-xl p-4 hover:border-noir-700 transition-colors opacity-80"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-warm-50 font-medium truncate">{ticket.eventTitle}</p>
            <p className="text-gray-500 text-sm">{ticket.venueName} &middot; {ticket.venueCity}</p>
            <p className="text-gray-500 text-xs mt-1">{formatDate(ticket.eventDate)}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-noir-800 text-gray-500 uppercase tracking-wider">
              {ticket.status === 'REDEEMED' ? 'Attended' : 'Past Event'}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  // Pre-event state (default — with urgency glow for <1 day)
  return (
    <Link
      to={`/events/${ticket.eventId}`}
      className={`block bg-noir-900 border rounded-xl p-4 hover:border-noir-600 transition-all ${
        isUrgent ? 'border-amber-500/40 shadow-lg shadow-amber-500/5' : 'border-noir-800'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-warm-50 font-medium truncate">{ticket.eventTitle}</p>
          <p className="text-gray-500 text-sm">{ticket.venueName} &middot; {ticket.venueCity}</p>
          <p className="text-gray-500 text-xs mt-1">{formatDate(ticket.eventDate)}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            ticket.type === 'raffle' ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'
          }`}>
            {ticket.type === 'raffle' ? 'Raffle Win' : 'Purchased'}
          </span>
          <div className={isUrgent ? 'animate-pulse' : ''}>
            <span className={`text-xs font-mono font-medium ${isUrgent ? 'text-amber-400' : 'text-gray-400'}`}>
              {countdown.days > 0 ? `${countdown.days}d ` : ''}{countdown.hours}h {countdown.mins}m
            </span>
            <span className="text-[9px] text-gray-600 block text-right">until show</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// --- Onboarding Checklist (empty state for new users) ---

function OnboardingChecklist({ setTab }: { setTab: (tab: Tab) => void }) {
  return (
    <div className="bg-gradient-to-br from-noir-900 to-noir-950 border border-amber-500/20 rounded-xl p-6">
      <div className="text-center mb-5">
        <h2 className="text-warm-50 font-display text-xl tracking-wider mb-2">Welcome to MiraCulture</h2>
        <p className="text-gray-400 text-sm">Where fans power the show. Get started with your first action.</p>
      </div>

      <div className="space-y-2">
        <OnboardingStep
          number={1}
          title="Discover an event near you"
          description="Browse upcoming shows and find artists you love"
          to="/events"
        />
        <OnboardingStep
          number={2}
          title="Support your first campaign"
          description="Help fund tickets so fans who can't afford them get in"
          to="/events"
        />
        <OnboardingStep
          number={3}
          title="Enter a raffle"
          description="Win tickets through provably fair drawings"
          to="/events"
        />
        <button
          onClick={() => setTab('security')}
          className="w-full flex items-center gap-3 px-4 py-3 bg-noir-800/50 border border-noir-700 rounded-lg hover:border-amber-500/20 transition-colors text-left"
        >
          <span className="w-6 h-6 rounded-full bg-noir-700 flex items-center justify-center text-xs text-gray-500 font-semibold flex-shrink-0">4</span>
          <div>
            <p className="text-gray-300 text-sm font-medium">Secure your account</p>
            <p className="text-gray-600 text-xs">Set up 2FA or a passkey for extra protection</p>
          </div>
        </button>
      </div>

      <div className="mt-4 text-center">
        <p className="text-gray-600 text-xs">
          Join fans who have supported live music through MiraCulture
        </p>
      </div>
    </div>
  );
}

function OnboardingStep({ number, title, description, to }: { number: number; title: string; description: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3 bg-noir-800/50 border border-noir-700 rounded-lg hover:border-amber-500/20 transition-colors"
    >
      <span className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center text-xs text-amber-400 font-semibold flex-shrink-0">{number}</span>
      <div>
        <p className="text-gray-300 text-sm font-medium">{title}</p>
        <p className="text-gray-600 text-xs">{description}</p>
      </div>
      <svg className="w-4 h-4 text-gray-600 flex-shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ========================================================
// EXISTING COMPONENTS (preserved from original)
// ========================================================

// --- Security Tab ---

function SecurityTab() {
  const { user, refreshUser } = useAuth();
  const [totpEnabled, setTotpEnabled] = useState(user?.totpEnabled ?? false);
  const [setupData, setSetupData] = useState<{ qrCodeDataUrl: string; backupCodes: string[] } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);
  const [passkeys, setPasskeys] = useState<{ id: string; friendlyName: string; createdAt: string }[]>([]);
  const [passkeyName, setPasskeyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [codesSaved, setCodesSaved] = useState(false);

  useEffect(() => {
    api.get<{ totpEnabled: boolean }>('/auth/2fa/status').then((r) => setTotpEnabled(r.totpEnabled)).catch(() => {});
    api.get<{ id: string; friendlyName: string; createdAt: string }[]>('/auth/passkeys').then(setPasskeys).catch(() => {});
  }, []);

  const handleSetup2FA = async () => {
    setError(''); setSuccess(''); setLoading(true);
    try {
      const data = await api.post<{ qrCodeDataUrl: string; backupCodes: string[] }>('/auth/2fa/setup', {});
      setSetupData(data);
      setCodesSaved(false);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleEnable2FA = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/2fa/enable', { code: verifyCode });
      setTotpEnabled(true);
      setSetupData(null);
      setVerifyCode('');
      setSuccess('Two-factor authentication enabled!');
      refreshUser();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleDisable2FA = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/2fa/disable', { code: disableCode });
      setTotpEnabled(false);
      setShowDisable(false);
      setDisableCode('');
      setSuccess('Two-factor authentication disabled.');
      refreshUser();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleRegisterPasskey = async () => {
    setError(''); setSuccess(''); setLoading(true);
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const options = await api.post<any>('/auth/passkeys/register/options', {});
      const regResponse = await startRegistration({ optionsJSON: options });
      await api.post('/auth/passkeys/register/verify', { friendlyName: passkeyName || 'My Passkey', ...regResponse });
      setPasskeyName('');
      const updated = await api.get<{ id: string; friendlyName: string; createdAt: string }[]>('/auth/passkeys');
      setPasskeys(updated);
      setSuccess('Passkey registered!');
      refreshUser();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleDeletePasskey = async (id: string) => {
    try {
      await api.delete(`/auth/passkeys/${id}`);
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
      refreshUser();
    } catch (err: any) { setError(err.message); }
  };

  const copyBackupCodes = () => {
    if (setupData) {
      navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
      setCodesSaved(true);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg text-sm">{success}</div>
      )}

      <div className="bg-noir-900 border border-noir-800 rounded-xl p-6">
        <h3 className="text-warm-50 font-semibold text-lg mb-1">Two-Factor Authentication</h3>
        <p className="text-gray-500 text-sm mb-4">Add an extra layer of security with an authenticator app.</p>

        {setupData ? (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
            <div className="flex justify-center">
              <img src={setupData.qrCodeDataUrl} alt="TOTP QR Code" className="w-48 h-48 rounded-lg bg-white p-2" />
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-2 font-medium">Backup codes (save these now!):</p>
              <div className="grid grid-cols-2 gap-2 bg-noir-800 rounded-lg p-4">
                {setupData.backupCodes.map((code, i) => (
                  <code key={i} className="text-amber-400 text-sm font-mono">{code}</code>
                ))}
              </div>
              <button onClick={copyBackupCodes} className="mt-2 text-xs text-gray-500 hover:text-amber-400 transition-colors">
                {codesSaved ? 'Copied!' : 'Copy all codes'}
              </button>
            </div>
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">Enter code to verify</label>
              <input
                type="text" inputMode="numeric" autoComplete="one-time-code"
                value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="000000" maxLength={6}
                className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-center text-xl tracking-[0.3em] font-mono"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleEnable2FA} disabled={loading || verifyCode.length !== 6} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors">
                {loading ? 'Verifying...' : 'Enable 2FA'}
              </button>
              <button onClick={() => { setSetupData(null); setVerifyCode(''); }} className="px-4 py-2.5 bg-noir-800 text-gray-400 rounded-lg hover:text-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : totpEnabled ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-green-400 text-sm font-medium">Enabled</span>
            </div>
            {showDisable ? (
              <div className="space-y-3">
                <p className="text-gray-400 text-sm">Enter your current 2FA code to disable:</p>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="000000" maxLength={6} className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-center text-xl tracking-[0.3em] font-mono" />
                <div className="flex gap-3">
                  <button onClick={handleDisable2FA} disabled={loading || disableCode.length !== 6} className="flex-1 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 disabled:opacity-50 transition-colors">
                    {loading ? 'Disabling...' : 'Disable 2FA'}
                  </button>
                  <button onClick={() => { setShowDisable(false); setDisableCode(''); }} className="px-4 py-2.5 bg-noir-800 text-gray-400 rounded-lg hover:text-gray-200 transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowDisable(true)} className="text-sm text-gray-500 hover:text-red-400 transition-colors">Disable two-factor authentication</button>
            )}
          </div>
        ) : (
          <button onClick={handleSetup2FA} disabled={loading} className="py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors">
            {loading ? 'Setting up...' : 'Set Up 2FA'}
          </button>
        )}
      </div>

      <div className="bg-noir-900 border border-noir-800 rounded-xl p-6">
        <h3 className="text-warm-50 font-semibold text-lg mb-1">Passkeys</h3>
        <p className="text-gray-500 text-sm mb-4">Sign in with your fingerprint, face, or security key instead of a password.</p>

        {passkeys.length > 0 && (
          <div className="space-y-2 mb-4">
            {passkeys.map((pk) => (
              <div key={pk.id} className="flex items-center justify-between bg-noir-800 rounded-lg p-3">
                <div>
                  <p className="text-gray-200 text-sm font-medium">{pk.friendlyName}</p>
                  <p className="text-gray-500 text-xs">Added {new Date(pk.createdAt).toLocaleDateString()}</p>
                </div>
                <button onClick={() => handleDeletePasskey(pk.id)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Remove</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">Passkey name</label>
            <input type="text" value={passkeyName} onChange={(e) => setPasskeyName(e.target.value)} placeholder="e.g. MacBook Touch ID" className="w-full px-4 py-2.5 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm placeholder-gray-600" />
          </div>
          <button onClick={handleRegisterPasskey} disabled={loading} className="py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors text-sm whitespace-nowrap">
            {loading ? 'Registering...' : 'Add Passkey'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Shared Sub-components ---

function EmptyState({ message, ctaText, ctaLink }: { message: string; ctaText?: string; ctaLink?: string }) {
  return (
    <div className="bg-noir-900 border border-noir-800 rounded-xl p-8 text-center">
      <p className="text-gray-500 text-sm">{message}</p>
      {ctaText && ctaLink && (
        <Link to={ctaLink} className="inline-block mt-4 text-sm text-amber-400 hover:text-amber-300 transition-colors">
          {ctaText}
        </Link>
      )}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-noir-900 border border-noir-800 rounded-xl p-8 animate-pulse flex justify-center">
        <div className="w-28 h-28 bg-noir-700 rounded-full" />
      </div>
      <div className="md:col-span-2 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-noir-900 border border-noir-800 rounded-xl p-4 animate-pulse">
            <div className="h-3 bg-noir-700 rounded w-16 mb-3" />
            <div className="h-7 bg-noir-700 rounded w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-noir-900 border border-noir-800 rounded-xl p-4 animate-pulse">
          <div className="h-4 bg-noir-700 rounded w-48 mb-2" />
          <div className="h-3 bg-noir-700 rounded w-32" />
        </div>
      ))}
    </div>
  );
}
