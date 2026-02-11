import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';

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

const TABS = ['overview', 'raffles', 'tickets', 'notifications', 'transactions'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  raffles: 'Raffles',
  tickets: 'Tickets',
  notifications: 'Notifications',
  transactions: 'Transactions',
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

  useEffect(() => {
    setDashLoading(true);
    api.get<DashboardData>('/user/dashboard')
      .then(setDashboard)
      .catch(() => {})
      .finally(() => setDashLoading(false));
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

  // --- Raffles data (uses dashboard) ---
  const [raffles, setRaffles] = useState<any[] | null>(null);
  const [rafflesLoading, setRafflesLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'raffles') return;
    setRafflesLoading(true);
    api.get<{ data: any[]; total: number }>('/user/transactions?limit=50')
      .then((res) => {
        setRaffles(res.data.filter((t: any) => t.type === 'RAFFLE_ENTRY'));
      })
      .catch(() => {})
      .finally(() => setRafflesLoading(false));
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-noir-950 px-4 py-8 sm:py-12">
      <SEO title="Dashboard" description="Your MiraCulture activity." noindex />
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-3xl tracking-wider text-warm-50 mb-8">MY DASHBOARD</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto border-b border-noir-800 -mx-4 px-4 sm:mx-0 sm:px-0">
          {TABS.map((tab) => (
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
          <div>
            {dashLoading ? (
              <LoadingGrid />
            ) : dashboard ? (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <StatCard label="Raffle Entries" value={dashboard.stats.totalRaffleEntries} />
                  <StatCard label="Raffle Wins" value={dashboard.stats.raffleWins} highlight />
                  <StatCard label="Tickets Owned" value={dashboard.stats.ticketsOwned} />
                  <StatCard label="Total Supported" value={formatCents(dashboard.stats.totalSupportedCents)} />
                </div>

                {/* Upcoming Tickets */}
                <h2 className="text-lg font-semibold text-warm-50 mb-4">Upcoming Events</h2>
                {dashboard.upcomingTickets.length === 0 ? (
                  <EmptyState message="No upcoming tickets." ctaText="Browse Events" ctaLink="/events" />
                ) : (
                  <div className="space-y-3">
                    {dashboard.upcomingTickets.map((t) => (
                      <Link
                        key={t.id}
                        to={`/events/${t.eventId}`}
                        className="block bg-noir-900 border border-noir-800 rounded-xl p-4 hover:border-noir-700 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-warm-50 font-medium">{t.eventTitle}</p>
                            <p className="text-gray-500 text-sm">{t.venueName} &middot; {t.venueCity}</p>
                            <p className="text-gray-500 text-xs mt-1">{formatDate(t.eventDate)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              t.type === 'raffle' ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'
                            }`}>
                              {t.type === 'raffle' ? 'Raffle Win' : 'Purchased'}
                            </span>
                            <span className="text-[10px] text-gray-500 uppercase">{t.status}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <EmptyState message="Could not load dashboard." />
            )}
          </div>
        )}

        {activeTab === 'raffles' && (
          <div>
            {rafflesLoading ? (
              <LoadingList />
            ) : raffles && raffles.length > 0 ? (
              <div className="space-y-3">
                {raffles.map((entry: any) => (
                  <div
                    key={entry.id}
                    className="bg-noir-900 border border-noir-800 rounded-xl p-4"
                  >
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
                  <Link
                    key={t.id}
                    to={`/events/${t.eventId}`}
                    className="block bg-noir-900 border border-noir-800 rounded-xl p-4 hover:border-noir-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-warm-50 font-medium">{t.eventTitle}</p>
                        <p className="text-gray-500 text-sm">{t.venueName} &middot; {t.venueCity}</p>
                        <p className="text-gray-500 text-xs mt-1">{formatDate(t.eventDate)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          t.type === 'raffle' ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'
                        }`}>
                          {t.type === 'raffle' ? 'Raffle Win' : 'Purchased'}
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase">{t.status}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState message="No tickets yet." ctaText="Browse Events" ctaLink="/events" />
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div>
            {/* Filter */}
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

                {/* Pagination */}
                {notifications.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-6">
                    <button
                      disabled={notifPage <= 1}
                      onClick={() => setNotifPage((p) => p - 1)}
                      className="text-sm text-gray-400 hover:text-amber-400 disabled:opacity-30 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-gray-500">
                      {notifPage} / {notifications.totalPages}
                    </span>
                    <button
                      disabled={notifPage >= notifications.totalPages}
                      onClick={() => setNotifPage((p) => p + 1)}
                      className="text-sm text-gray-400 hover:text-amber-400 disabled:opacity-30 transition-colors"
                    >
                      Next
                    </button>
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
                    <button
                      disabled={txPage <= 1}
                      onClick={() => setTxPage((p) => p - 1)}
                      className="text-sm text-gray-400 hover:text-amber-400 disabled:opacity-30 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-gray-500">
                      {txPage} / {transactions.totalPages}
                    </span>
                    <button
                      disabled={txPage >= transactions.totalPages}
                      onClick={() => setTxPage((p) => p + 1)}
                      className="text-sm text-gray-400 hover:text-amber-400 disabled:opacity-30 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <EmptyState message="No transactions yet." />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Shared Sub-components ---

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-noir-900 border border-noir-800 rounded-xl p-4">
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${highlight ? 'text-amber-400' : 'text-warm-50'}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ message, ctaText, ctaLink }: { message: string; ctaText?: string; ctaLink?: string }) {
  return (
    <div className="bg-noir-900 border border-noir-800 rounded-xl p-8 text-center">
      <p className="text-gray-500 text-sm">{message}</p>
      {ctaText && ctaLink && (
        <Link
          to={ctaLink}
          className="inline-block mt-4 text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          {ctaText}
        </Link>
      )}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-noir-900 border border-noir-800 rounded-xl p-4 animate-pulse">
          <div className="h-3 bg-noir-700 rounded w-16 mb-3" />
          <div className="h-7 bg-noir-700 rounded w-12" />
        </div>
      ))}
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
