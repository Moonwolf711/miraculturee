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

interface ArtistItem {
  id: string;
  stageName: string;
  genre: string | null;
  bio: string | null;
  isVerified: boolean;
  verificationStatus: string;
  isPlaceholder: boolean;
  spotifyArtistId: string | null;
  stripeAccountId: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string; role: string; isBanned: boolean; emailVerified: boolean };
  _count: { socialAccounts: number; campaigns: number; events: number };
  activeCampaigns: number;
}

interface ArtistsResponse {
  artists: ArtistItem[];
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
  const [tab, setTab] = useState<'analytics' | 'users' | 'artists'>('analytics');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Artists state
  const [artists, setArtists] = useState<ArtistsResponse | null>(null);
  const [artistSearch, setArtistSearch] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');
  const [artistPage, setArtistPage] = useState(1);
  const [editingArtist, setEditingArtist] = useState<ArtistItem | null>(null);
  const [editForm, setEditForm] = useState({ stageName: '', genre: '', bio: '' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const fetchArtists = useCallback(() => {
    const params = new URLSearchParams({ page: String(artistPage), limit: '50' });
    if (artistSearch) params.set('search', artistSearch);
    if (verificationFilter) params.set('verification', verificationFilter);
    api.get<ArtistsResponse>(`/admin/dashboard/artists?${params}`)
      .then(setArtists)
      .catch((err: Error) => setError(err.message));
  }, [artistPage, artistSearch, verificationFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<Analytics>('/admin/dashboard/analytics'),
      api.get<UsersResponse>('/admin/dashboard/users?limit=50'),
      api.get<ArtistsResponse>('/admin/dashboard/artists?limit=50'),
    ])
      .then(([a, u, ar]) => { setAnalytics(a); setUsers(u); setArtists(ar); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) fetchUsers();
  }, [page, search, roleFilter]);

  useEffect(() => {
    if (!loading) fetchArtists();
  }, [artistPage, artistSearch, verificationFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleArtistSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setArtistPage(1);
    fetchArtists();
  };

  const handleVerify = async (id: string) => {
    setActionLoading(id);
    try {
      await api.put(`/admin/dashboard/artists/${id}/verify`);
      fetchArtists();
    } catch (err: any) { setError(err.message); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await api.put(`/admin/dashboard/artists/${id}/reject`);
      fetchArtists();
    } catch (err: any) { setError(err.message); }
    finally { setActionLoading(null); }
  };

  const handleBan = async (id: string, ban: boolean) => {
    const msg = ban ? 'Ban this artist? They will not be able to log in.' : 'Unban this artist?';
    if (!confirm(msg)) return;
    setActionLoading(id);
    try {
      await api.put(`/admin/dashboard/artists/${id}/ban`, { banned: ban });
      fetchArtists();
    } catch (err: any) { setError(err.message); }
    finally { setActionLoading(null); }
  };

  const handleEditOpen = (a: ArtistItem) => {
    setEditingArtist(a);
    setEditForm({ stageName: a.stageName, genre: a.genre || '', bio: a.bio || '' });
  };

  const handleEditSave = async () => {
    if (!editingArtist) return;
    setActionLoading(editingArtist.id);
    try {
      await api.put(`/admin/dashboard/artists/${editingArtist.id}`, editForm);
      setEditingArtist(null);
      fetchArtists();
    } catch (err: any) { setError(err.message); }
    finally { setActionLoading(null); }
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
          {(['analytics', 'users', 'artists'] as const).map((t) => (
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
              {[
                { label: 'Total Users', value: analytics.users.total, color: 'text-warm-50' },
                { label: 'Last 7 Days', value: analytics.users.last7d, color: 'text-green-400' },
                { label: 'Last 30 Days', value: analytics.users.last30d, color: 'text-warm-50' },
                { label: 'Verified', value: analytics.users.verified, color: 'text-warm-50' },
                { label: 'Total Events', value: analytics.events.total, color: 'text-warm-50' },
                { label: 'Upcoming', value: analytics.events.upcoming, color: 'text-amber-400' },
              ].map((stat) => (
                <div key={stat.label} className="bg-noir-800 border border-noir-700 rounded-xl p-3 sm:p-4">
                  <div className={`font-display text-xl sm:text-2xl ${stat.color}`}>{stat.value.toLocaleString()}</div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Revenue Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: 'Total Revenue', value: formatPrice(analytics.support.revenueCents), color: 'text-amber-400' },
                { label: 'Support Tickets', value: analytics.support.totalTickets, color: 'text-warm-50' },
                { label: 'Raffle Entries', value: analytics.raffleEntries, color: 'text-warm-50' },
                { label: 'Direct Tickets', value: analytics.directTickets, color: 'text-warm-50' },
              ].map((stat) => (
                <div key={stat.label} className="bg-noir-800 border border-noir-700 rounded-xl p-3 sm:p-4">
                  <div className={`font-display text-xl sm:text-2xl ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Users by Role */}
            <h2 className="font-display text-lg tracking-wider text-warm-50 mb-3">USERS BY ROLE</h2>
            <div className="flex flex-wrap gap-2 sm:gap-3 mb-8">
              {analytics.users.byRole.map((r) => (
                <div key={r.role} className="bg-noir-800 border border-noir-700 rounded-xl px-3 py-2 sm:px-5 sm:py-3">
                  <span className="font-display text-lg sm:text-xl text-warm-50">{r.count.toLocaleString()}</span>
                  <span className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider ml-2">{r.role}</span>
                </div>
              ))}
            </div>

            {/* Recent Signups — cards on mobile, table on md+ */}
            <h2 className="font-display text-lg tracking-wider text-warm-50 mb-3">RECENT SIGNUPS</h2>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {analytics.recentSignups.map((u) => (
                <div key={u.id} className="bg-noir-800 border border-noir-700 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-warm-50 font-medium text-sm truncate mr-2">{u.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider shrink-0 ${
                      u.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400' : 'bg-noir-700 text-gray-400'
                    }`}>{u.role}</span>
                  </div>
                  <p className="text-gray-400 text-xs truncate">{u.email}</p>
                  <p className="text-gray-500 text-[10px] mt-1">{formatDate(u.createdAt)}</p>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block bg-noir-800 border border-noir-700 rounded-xl overflow-hidden">
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
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <form onSubmit={handleSearch} className="flex-1">
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
              {users.total.toLocaleString()} users total &middot; page {users.page} of {users.totalPages}
            </p>

            {/* Mobile User Cards */}
            <div className="space-y-2 md:hidden">
              {users.users.map((u) => (
                <div key={u.id} className="bg-noir-800 border border-noir-700 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-warm-50 font-medium text-sm truncate mr-2">{u.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider shrink-0 ${
                      u.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : u.role === 'ARTIST' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-noir-700 text-gray-400 border border-noir-600'
                    }`}>{u.role}</span>
                  </div>
                  <p className="text-gray-400 text-xs truncate">{u.email}</p>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500 uppercase tracking-wider">
                    <span>{u.city || 'No city'}</span>
                    <span>{u.emailVerified ? <span className="text-green-400">Verified</span> : 'Unverified'}</span>
                    <span>{formatDate(u.createdAt)}</span>
                  </div>
                  {(u._count.supportTickets > 0 || u._count.raffleEntries > 0) && (
                    <div className="flex gap-3 mt-1.5 text-[10px] text-gray-500 uppercase tracking-wider">
                      {u._count.supportTickets > 0 && <span>{u._count.supportTickets} support</span>}
                      {u._count.raffleEntries > 0 && <span>{u._count.raffleEntries} raffle</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Users Table */}
            <div className="hidden md:block bg-noir-800 border border-noir-700 rounded-xl overflow-x-auto">
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

        {/* Artists Tab */}
        {tab === 'artists' && artists && (
          <>
            {/* Search + Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <form onSubmit={handleArtistSearch} className="flex-1">
                <input
                  type="text"
                  value={artistSearch}
                  onChange={(e) => setArtistSearch(e.target.value)}
                  placeholder="Search by stage name or email..."
                  className="w-full bg-noir-800 border border-noir-700 text-gray-200 placeholder-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </form>
              <select
                value={verificationFilter}
                onChange={(e) => { setVerificationFilter(e.target.value); setArtistPage(1); }}
                className="bg-noir-800 border border-noir-700 text-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="">All Artists</option>
                <option value="VERIFIED">Verified</option>
                <option value="UNVERIFIED">Unverified</option>
              </select>
            </div>

            {/* Artist Count */}
            <p className="text-gray-500 text-xs mb-4 uppercase tracking-wider">
              {artists.total.toLocaleString()} artists total &middot; page {artists.page} of {artists.totalPages}
            </p>

            {/* Mobile Artist Cards */}
            <div className="space-y-2 md:hidden">
              {artists.artists.map((a) => (
                <div key={a.id} className="bg-noir-800 border border-noir-700 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-warm-50 font-medium text-sm truncate mr-2">{a.stageName}</span>
                    <div className="flex gap-1 shrink-0">
                      {a.isVerified && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">Verified</span>
                      )}
                      {a.isPlaceholder && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-gray-500/10 text-gray-400 border border-gray-500/20">Placeholder</span>
                      )}
                      {a.user.isBanned && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">Banned</span>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs truncate">{a.user.email}</p>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500 uppercase tracking-wider">
                    <span>{a.genre || 'No genre'}</span>
                    <span>{a._count.socialAccounts} socials</span>
                    <span>{a.activeCampaigns}/{a._count.campaigns} campaigns</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {a.isVerified ? (
                      <button onClick={() => handleReject(a.id)} disabled={actionLoading === a.id}
                        className="px-3 py-1.5 rounded-lg text-xs border border-gray-600 text-gray-400 hover:border-gray-400 transition-colors disabled:opacity-30">Reject</button>
                    ) : (
                      <button onClick={() => handleVerify(a.id)} disabled={actionLoading === a.id}
                        className="px-3 py-1.5 rounded-lg text-xs border border-green-600 text-green-400 hover:border-green-400 transition-colors disabled:opacity-30">Verify</button>
                    )}
                    <button onClick={() => handleEditOpen(a)} className="px-3 py-1.5 rounded-lg text-xs border border-amber-600 text-amber-400 hover:border-amber-400 transition-colors">Edit</button>
                    {a.user.isBanned ? (
                      <button onClick={() => handleBan(a.id, false)} disabled={actionLoading === a.id}
                        className="px-3 py-1.5 rounded-lg text-xs border border-blue-600 text-blue-400 hover:border-blue-400 transition-colors disabled:opacity-30">Unban</button>
                    ) : (
                      <button onClick={() => handleBan(a.id, true)} disabled={actionLoading === a.id}
                        className="px-3 py-1.5 rounded-lg text-xs border border-red-600 text-red-400 hover:border-red-400 transition-colors disabled:opacity-30">Ban</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Artists Table */}
            <div className="hidden md:block bg-noir-800 border border-noir-700 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-noir-700 text-gray-500 text-[10px] uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Stage Name</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Genre</th>
                    <th className="text-center px-4 py-3">Socials</th>
                    <th className="text-center px-4 py-3">Campaigns</th>
                    <th className="text-center px-4 py-3">Events</th>
                    <th className="text-left px-4 py-3">Joined</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {artists.artists.map((a) => (
                    <tr key={a.id} className="border-b border-noir-700/50 last:border-0 hover:bg-noir-700/20">
                      <td className="px-4 py-3 text-warm-50 whitespace-nowrap">{a.stageName}</td>
                      <td className="px-4 py-3 text-gray-400">{a.user.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {a.isVerified ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">Verified</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-noir-700 text-gray-400 border border-noir-600">Unverified</span>
                          )}
                          {a.isPlaceholder && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-gray-500/10 text-gray-400 border border-gray-500/20">Placeholder</span>
                          )}
                          {a.user.isBanned && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">Banned</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{a.genre || '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{a._count.socialAccounts}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{a.activeCampaigns}/{a._count.campaigns}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{a._count.events}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(a.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end">
                          {a.isVerified ? (
                            <button onClick={() => handleReject(a.id)} disabled={actionLoading === a.id}
                              className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-gray-600 text-gray-400 hover:border-gray-400 transition-colors disabled:opacity-30">Reject</button>
                          ) : (
                            <button onClick={() => handleVerify(a.id)} disabled={actionLoading === a.id}
                              className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-green-600 text-green-400 hover:border-green-400 transition-colors disabled:opacity-30">Verify</button>
                          )}
                          <button onClick={() => handleEditOpen(a)}
                            className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-amber-600 text-amber-400 hover:border-amber-400 transition-colors">Edit</button>
                          {a.user.isBanned ? (
                            <button onClick={() => handleBan(a.id, false)} disabled={actionLoading === a.id}
                              className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-blue-600 text-blue-400 hover:border-blue-400 transition-colors disabled:opacity-30">Unban</button>
                          ) : (
                            <button onClick={() => handleBan(a.id, true)} disabled={actionLoading === a.id}
                              className="px-2.5 py-1 rounded text-[10px] uppercase tracking-wider border border-red-600 text-red-400 hover:border-red-400 transition-colors disabled:opacity-30">Ban</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Artists Pagination */}
            {artists.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setArtistPage((p) => Math.max(1, p - 1))}
                  disabled={artistPage <= 1}
                  className="px-4 py-2 rounded-lg border border-noir-700 text-gray-400 text-sm disabled:opacity-30 hover:border-amber-500/40 transition-colors"
                >
                  Prev
                </button>
                <span className="text-gray-500 text-sm px-3">{artistPage} / {artists.totalPages}</span>
                <button
                  onClick={() => setArtistPage((p) => Math.min(artists!.totalPages, p + 1))}
                  disabled={artistPage >= artists.totalPages}
                  className="px-4 py-2 rounded-lg border border-noir-700 text-gray-400 text-sm disabled:opacity-30 hover:border-amber-500/40 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Edit Artist Modal */}
        {editingArtist && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setEditingArtist(null)}>
            <div className="bg-noir-900 border border-noir-700 rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-display text-lg tracking-wider text-warm-50 mb-4">EDIT ARTIST</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Stage Name</label>
                  <input
                    type="text"
                    value={editForm.stageName}
                    onChange={(e) => setEditForm((f) => ({ ...f, stageName: e.target.value }))}
                    className="w-full bg-noir-800 border border-noir-700 text-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Genre</label>
                  <input
                    type="text"
                    value={editForm.genre}
                    onChange={(e) => setEditForm((f) => ({ ...f, genre: e.target.value }))}
                    className="w-full bg-noir-800 border border-noir-700 text-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Bio</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                    rows={3}
                    className="w-full bg-noir-800 border border-noir-700 text-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setEditingArtist(null)}
                  className="px-4 py-2 rounded-lg border border-noir-700 text-gray-400 text-sm hover:border-gray-500 transition-colors">Cancel</button>
                <button onClick={handleEditSave} disabled={actionLoading === editingArtist.id}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-noir-950 text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-50">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
