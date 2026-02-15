import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';
import { StatsSkeleton } from '../components/LoadingStates.js';

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  city: string | null;
  emailVerified: boolean;
  createdAt: string;
  _count: { supportTickets: number; raffleEntries: number; notifications: number };
}

interface UsersResponse {
  users: UserItem[];
  total: number;
  page: number;
  totalPages: number;
}

interface Analytics {
  users: {
    total: number;
    last30d: number;
    last7d: number;
    verified: number;
    byRole: { role: string; count: number }[];
  };
  events: { total: number; upcoming: number };
  support: { totalTickets: number; revenueCents: number; last30d: number };
  raffleEntries: number;
  directTickets: number;
  recentSignups: { id: string; email: string; name: string; role: string; createdAt: string }[];
}

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function AdminPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [users, setUsers] = useState<UsersResponse | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'analytics' | 'users'>('analytics');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(() => {
    api.get<Analytics>('/admin/dashboard/analytics')
      .then(setAnalytics)
      .catch((err: Error) => setError(err.message));
  }, []);

  const fetchUsers = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    api.get<UsersResponse>(`/admin/dashboard/users?${params}`)
      .then(setUsers)
      .catch((err: Error) => setError(err.message));
  }, [page, search, roleFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<Analytics>('/admin/dashboard/analytics'),
      api.get<UsersResponse>('/admin/dashboard/users?limit=50'),
    ])
      .then(([a, u]) => { setAnalytics(a); setUsers(u); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) fetchUsers();
  }, [page, search, roleFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-noir-950">
        <SEO title="Admin" noindex />
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="h-8 w-40 bg-noir-800 rounded animate-pulse mb-8" />
          <StatsSkeleton count={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-amber">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir-950">
      <SEO title="Admin Dashboard" noindex />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl tracking-wider text-warm-50 mb-8">ADMIN</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-noir-800">
          {(['analytics', 'users'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 font-body text-sm uppercase tracking-wider transition-colors ${
                tab === t
                  ? 'text-amber-400 border-b-2 border-amber-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Analytics Tab */}
        {tab === 'analytics' && analytics && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
              {[
                { label: 'Total Users', value: analytics.users.total, color: 'text-warm-50' },
                { label: 'Last 7 Days', value: analytics.users.last7d, color: 'text-green-400' },
                { label: 'Last 30 Days', value: analytics.users.last30d, color: 'text-warm-50' },
                { label: 'Verified', value: analytics.users.verified, color: 'text-warm-50' },
                { label: 'Total Events', value: analytics.events.total, color: 'text-warm-50' },
                { label: 'Upcoming', value: analytics.events.upcoming, color: 'text-amber-400' },
              ].map((stat) => (
                <div key={stat.label} className="bg-noir-800 border border-noir-700 rounded-xl p-4">
                  <div className={`font-display text-2xl ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Revenue Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <div className="bg-noir-800 border border-noir-700 rounded-xl p-4">
                <div className="font-display text-2xl text-amber-400">{formatPrice(analytics.support.revenueCents)}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">Total Revenue</div>
              </div>
              <div className="bg-noir-800 border border-noir-700 rounded-xl p-4">
                <div className="font-display text-2xl text-warm-50">{analytics.support.totalTickets}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">Support Tickets</div>
              </div>
              <div className="bg-noir-800 border border-noir-700 rounded-xl p-4">
                <div className="font-display text-2xl text-warm-50">{analytics.raffleEntries}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">Raffle Entries</div>
              </div>
              <div className="bg-noir-800 border border-noir-700 rounded-xl p-4">
                <div className="font-display text-2xl text-warm-50">{analytics.directTickets}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">Direct Tickets</div>
              </div>
            </div>

            {/* Users by Role */}
            <h2 className="font-display text-lg tracking-wider text-warm-50 mb-3">USERS BY ROLE</h2>
            <div className="flex gap-3 mb-10">
              {analytics.users.byRole.map((r) => (
                <div key={r.role} className="bg-noir-800 border border-noir-700 rounded-xl px-5 py-3">
                  <span className="font-display text-xl text-warm-50">{r.count}</span>
                  <span className="text-gray-400 text-xs uppercase tracking-wider ml-2">{r.role}</span>
                </div>
              ))}
            </div>

            {/* Recent Signups */}
            <h2 className="font-display text-lg tracking-wider text-warm-50 mb-3">RECENT SIGNUPS</h2>
            <div className="bg-noir-800 border border-noir-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-noir-700 text-gray-500 text-[10px] uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Role</th>
                    <th className="text-left px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recentSignups.map((u) => (
                    <tr key={u.id} className="border-b border-noir-700/50 last:border-0">
                      <td className="px-4 py-3 text-warm-50">{u.name}</td>
                      <td className="px-4 py-3 text-gray-400">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                          u.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400' : 'bg-noir-700 text-gray-400'
                        }`}>{u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Users Tab */}
        {tab === 'users' && users && (
          <>
            {/* Search + Filter Bar */}
            <div className="flex flex-wrap gap-3 mb-6">
              <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full bg-noir-800 border border-noir-700 text-gray-200 placeholder-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </form>
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                className="bg-noir-800 border border-noir-700 text-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="">All Roles</option>
                <option value="FAN">Fan</option>
                <option value="ARTIST">Artist</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            {/* User Count */}
            <p className="text-gray-500 text-xs mb-4 uppercase tracking-wider">
              {users.total} users total &middot; page {users.page} of {users.totalPages}
            </p>

            {/* Users Table */}
            <div className="bg-noir-800 border border-noir-700 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-noir-700 text-gray-500 text-[10px] uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Role</th>
                    <th className="text-left px-4 py-3">City</th>
                    <th className="text-center px-4 py-3">Verified</th>
                    <th className="text-center px-4 py-3">Supports</th>
                    <th className="text-center px-4 py-3">Raffles</th>
                    <th className="text-left px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.users.map((u) => (
                    <tr key={u.id} className="border-b border-noir-700/50 last:border-0 hover:bg-noir-700/20">
                      <td className="px-4 py-3 text-warm-50 whitespace-nowrap">{u.name}</td>
                      <td className="px-4 py-3 text-gray-400">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                          u.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : u.role === 'ARTIST' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-noir-700 text-gray-400 border border-noir-600'
                        }`}>{u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{u.city || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {u.emailVerified
                          ? <span className="text-green-400 text-xs">Yes</span>
                          : <span className="text-gray-600 text-xs">No</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400">{u._count.supportTickets}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{u._count.raffleEntries}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {users.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-lg border border-noir-700 text-gray-400 text-sm disabled:opacity-30 hover:border-amber-500/40 transition-colors"
                >
                  Prev
                </button>
                <span className="text-gray-500 text-sm px-3">{page} / {users.totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(users!.totalPages, p + 1))}
                  disabled={page >= users.totalPages}
                  className="px-4 py-2 rounded-lg border border-noir-700 text-gray-400 text-sm disabled:opacity-30 hover:border-amber-500/40 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
