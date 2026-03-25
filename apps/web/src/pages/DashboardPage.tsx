import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';
import { useAuth } from '../hooks/useAuth.js';

// --- Sub-components ---
import DashboardStats from '../components/dashboard/DashboardStats.js';
import ImpactScore from '../components/dashboard/ImpactScore.js';
import ActivityFeed, { ArtistRelationshipCard, SupportedCampaignCard } from '../components/dashboard/ActivityFeed.js';
import UpcomingTickets, { ContextualEventCard, EmptyState, LoadingList, LoadingGrid } from '../components/dashboard/UpcomingTickets.js';
import NotificationsPanel from '../components/dashboard/NotificationsPanel.js';
import AccountSettings from '../components/dashboard/AccountSettings.js';
import SecuritySettings from '../components/dashboard/SecuritySettings.js';
import CampaignsTab from '../components/dashboard/CampaignsTab.js';
import TransactionsTab from '../components/dashboard/TransactionsTab.js';
import RafflesTab from '../components/dashboard/RafflesTab.js';
import QuickActions, { OnboardingChecklist } from '../components/dashboard/QuickActions.js';

// --- Types ---
import type {
  DashboardData, ImpactData, SupportedCampaign, ActivityFeedItem,
  ArtistRelationship, PaginatedNotifications, PaginatedTransactions,
  Transaction, CampaignItem, Tab,
} from '../components/dashboard/types.js';
import { TABS, TAB_LABELS } from '../components/dashboard/types.js';

// --- Component ---

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'overview';
  const setTab = (tab: Tab) => setSearchParams(tab === 'overview' ? {} : { tab });

  // --- Role detection (check for agent/artist profiles regardless of role enum) ---
  const [hasAgentProfile, setHasAgentProfile] = useState(false);
  const [hasArtistProfile, setHasArtistProfile] = useState(false);
  const [hasManagerProfile, setHasManagerProfile] = useState(false);
  const [hasLocalArtistProfile, setHasLocalArtistProfile] = useState(false);

  useEffect(() => {
    api.get('/agents/profile').then(() => setHasAgentProfile(true)).catch(() => {});
    api.get('/artist/profile').then(() => setHasArtistProfile(true)).catch(() => {});
    api.get('/manager/profile').then(() => setHasManagerProfile(true)).catch(() => {});
    api.get('/local-artists/profile/me').then(() => setHasLocalArtistProfile(true)).catch(() => {});
  }, []);

  // --- Dashboard Data ---
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [impactLoading, setImpactLoading] = useState(true);
  const [supportedCampaigns, setSupportedCampaigns] = useState<SupportedCampaign[]>([]);
  const [scLoading, setScLoading] = useState(true);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [artistRelationships, setArtistRelationships] = useState<ArtistRelationship[]>([]);
  const [arLoading, setArLoading] = useState(true);

  useEffect(() => {
    setDashLoading(true); setImpactLoading(true); setScLoading(true); setFeedLoading(true); setArLoading(true);
    Promise.all([
      api.get<DashboardData>('/user/dashboard').then(setDashboard).catch(() => {}),
      api.get<ImpactData>('/user/impact').then(setImpact).catch(() => {}),
      api.get<SupportedCampaign[]>('/user/supported-campaigns').then(setSupportedCampaigns).catch(() => {}),
      api.get<ActivityFeedItem[]>('/user/activity-feed').then(setActivityFeed).catch(() => {}),
      api.get<ArtistRelationship[]>('/user/artist-relationships').then(setArtistRelationships).catch(() => {}),
    ]).finally(() => {
      setDashLoading(false); setImpactLoading(false); setScLoading(false); setFeedLoading(false); setArLoading(false);
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
      const res = await api.get<PaginatedNotifications>(`/user/notifications?page=${notifPage}&limit=20${readParam}`);
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
      .then((res) => { setRaffles(res.data.filter((t) => t.type === 'RAFFLE_ENTRY')); })
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
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getEventUrl(c.eventId))}`, '_blank');
  };

  const shareToFacebook = (c: CampaignItem) => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getEventUrl(c.eventId))}`, '_blank');
  };

  const copyShareText = (c: CampaignItem) => {
    const text = `${c.headline}\n\n${c.message}\n\nGet tickets: ${getEventUrl(c.eventId)}`;
    navigator.clipboard.writeText(text).then(() => { setCopiedId(c.id); setTimeout(() => setCopiedId(null), 2000); });
  };

  return (
    <div className="min-h-screen bg-noir-950 px-4 py-8 sm:py-12">
      <SEO title="Dashboard" description="Your MiraCulture activity." noindex />
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl tracking-wider text-warm-50">MY DASHBOARD</h1>
          <div className="flex gap-2">
            {(hasAgentProfile || user?.role === 'AGENT') && (
              <Link
                to="/agents/dashboard"
                className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 hover:border-amber-500/50 transition-all text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Agent Dashboard
              </Link>
            )}
            {(hasArtistProfile || user?.role === 'ARTIST') && (
              <Link
                to="/artist/dashboard"
                className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 hover:border-amber-500/50 transition-all text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                Artist Dashboard
              </Link>
            )}
            {hasManagerProfile && (
              <Link
                to="/manager/dashboard"
                className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/20 hover:border-blue-500/50 transition-all text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                Manager Dashboard
              </Link>
            )}
            {hasLocalArtistProfile && (
              <Link
                to="/local-artists/dashboard"
                className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 hover:border-amber-500/50 transition-all text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                Local Artist Dashboard
              </Link>
            )}
            {(user?.role === 'ADMIN' || user?.role === 'DEVELOPER') && (
              <Link
                to="/admin"
                className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 hover:border-red-500/50 transition-all text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Admin
              </Link>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto border-b border-noir-800 -mx-4 px-4 sm:mx-0 sm:px-0">
          {TABS.filter((tab) => tab !== 'campaigns' || user?.role === 'ADMIN').map((tab) => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {!dashLoading && !impactLoading && !feedLoading && (() => {
              const stats = dashboard?.stats;
              const hasNoActivity = stats && stats.totalRaffleEntries === 0 && stats.ticketsOwned === 0 && stats.supportPurchases === 0;
              return hasNoActivity ? <OnboardingChecklist setTab={setTab} /> : null;
            })()}

            <QuickActions setTab={setTab} />

            {impactLoading || dashLoading ? <LoadingGrid /> : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {impact && <ImpactScore impact={impact} />}
                <DashboardStats stats={dashboard?.stats} />
              </div>
            )}

            {arLoading ? <LoadingList /> : artistRelationships.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-warm-50 mb-4">Your Artists</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {artistRelationships.slice(0, 6).map((ar) => (
                    <ArtistRelationshipCard key={ar.artistId} data={ar} />
                  ))}
                </div>
              </div>
            )}

            <UpcomingTickets tickets={dashboard?.upcomingTickets ?? []} loading={dashLoading} />

            {feedLoading ? <LoadingList /> : activityFeed.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-warm-50 mb-4">Recent Activity</h2>
                <ActivityFeed items={activityFeed} />
              </div>
            )}

            {!scLoading && supportedCampaigns.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-warm-50 mb-4">Campaigns You've Backed</h2>
                <div className="space-y-3">
                  {supportedCampaigns.map((sc) => <SupportedCampaignCard key={sc.supportId} data={sc} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && user?.role === 'ADMIN' && (
          <CampaignsTab
            campaigns={campaigns} loading={campaignsLoading} copiedId={copiedId}
            onShareTwitter={shareToTwitter} onShareFacebook={shareToFacebook} onCopyShareText={copyShareText}
            onSocialShare={(c, platform) => {
              const text = `${c.headline}\n\n${c.message.slice(0, 200)}\n\nGet tickets: ${getEventUrl(c.eventId)}`;
              window.open(`https://www.${platform}/`, '_blank');
              navigator.clipboard.writeText(text);
              setCopiedId(c.id + '-' + (platform === 'instagram.com' ? 'ig' : 'tt'));
              setTimeout(() => setCopiedId(null), 3000);
            }}
          />
        )}

        {/* Raffles Tab */}
        {activeTab === 'raffles' && <RafflesTab raffles={raffles} loading={rafflesLoading} />}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <div>
            {dashLoading ? <LoadingList /> : dashboard && dashboard.upcomingTickets.length > 0 ? (
              <div className="space-y-3">
                {dashboard.upcomingTickets.map((t) => <ContextualEventCard key={t.id} ticket={t} />)}
              </div>
            ) : (
              <EmptyState message="No tickets yet." ctaText="Browse Events" ctaLink="/events" />
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <NotificationsPanel
            notifications={notifications} loading={notifLoading} filter={notifFilter} page={notifPage}
            onFilterChange={(f) => { setNotifFilter(f); setNotifPage(1); }}
            onPageChange={setNotifPage} onMarkRead={markRead}
          />
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <TransactionsTab transactions={transactions} loading={txLoading} page={txPage} onPageChange={setTxPage} />
        )}

        {/* Account Tab */}
        {activeTab === 'account' && <AccountSettings />}

        {/* Security Tab */}
        {activeTab === 'security' && <SecuritySettings />}
      </div>
    </div>
  );
}
