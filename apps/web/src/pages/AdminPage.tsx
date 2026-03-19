import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';
import SEO from '../components/SEO.js';
import { StatsSkeleton } from '../components/LoadingStates.js';
import AdminAnalytics from '../components/admin/AdminAnalytics.js';
import AdminUserManagement from '../components/admin/AdminUserManagement.js';
import AdminArtistManagement from '../components/admin/AdminArtistManagement.js';
import AdminDeveloperInvites from '../components/admin/AdminDeveloperInvites.js';
import AdminIntegrations from '../components/admin/AdminIntegrations.js';

const DevChat = lazy(() => import('../components/DevChat.js'));

interface Analytics {
  users: { total: number; last30d: number; last7d: number; verified: number; byRole: { role: string; count: number }[] };
  events: { total: number; upcoming: number };
  support: { totalTickets: number; revenueCents: number; last30d: number };
  raffleEntries: number; directTickets: number;
  recentSignups: { id: string; email: string; name: string; role: string; createdAt: string }[];
}

interface UsersResponse {
  users: { id: string; email: string; name: string; role: string; city: string | null; emailVerified: boolean; createdAt: string; _count: { supportTickets: number; raffleEntries: number; notifications: number } }[];
  total: number; page: number; totalPages: number;
}

interface ArtistsResponse {
  artists: { id: string; stageName: string; genre: string | null; bio: string | null; isVerified: boolean; verificationStatus: string; isPlaceholder: boolean; spotifyArtistId: string | null; stripeAccountId: string | null; createdAt: string; user: { id: string; email: string; name: string; role: string; isBanned: boolean; emailVerified: boolean }; _count: { socialAccounts: number; campaigns: number; events: number }; activeCampaigns: number }[];
  total: number; page: number; totalPages: number;
}

interface DeveloperItem { id: string; email: string; name: string; permission: string; invitedBy: { name: string; email: string } | null; joinedAt: string }
interface DevInviteItem { id: string; email: string; permission: string; invitedBy: { name: string; email: string }; expiresAt: string; createdAt: string }

interface PendingAgent {
  id: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  state: string;
  city: string;
  age: number | null;
  profileImageUrl: string | null;
  yearsExperience: number | null;
  promoterType: string | null;
  genres: string[];
  skills: string[];
  profileStrength: number;
  verificationStatus: string;
  createdAt: string;
  user: { email: string; name: string };
}

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [users, setUsers] = useState<UsersResponse | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'analytics' | 'users' | 'artists' | 'agents' | 'developers' | 'integrations'>('analytics');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Artists state
  const [artists, setArtists] = useState<ArtistsResponse | null>(null);
  const [artistSearch, setArtistSearch] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');
  const [artistPage, setArtistPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Developers state
  const [developers, setDevelopers] = useState<DeveloperItem[]>([]);
  const [devInvites, setDevInvites] = useState<DevInviteItem[]>([]);

  // Agents state
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([]);
  const [agentNote, setAgentNote] = useState<Record<string, string>>({});

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

  const fetchPendingAgents = useCallback(() => {
    api.get<PendingAgent[]>('/agents/pending')
      .then(setPendingAgents)
      .catch((err: Error) => setError(err.message));
  }, []);

  const handleAgentVerify = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setActionLoading(id);
    try {
      await api.post(`/agents/verify/${id}`, { status, note: agentNote[id] || undefined });
      fetchPendingAgents();
      setAgentNote((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  };

  const fetchDevelopers = useCallback(() => {
    Promise.all([
      api.get<{ developers: DeveloperItem[] }>('/admin/developers/'),
      api.get<{ invites: DevInviteItem[] }>('/admin/developers/invites'),
    ])
      .then(([d, i]) => { setDevelopers(d.developers); setDevInvites(i.invites); })
      .catch((err: Error) => setError(err.message));
  }, []);

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

  useEffect(() => { if (!loading) fetchUsers(); }, [page, search, roleFilter]);
  useEffect(() => { if (!loading) fetchArtists(); }, [artistPage, artistSearch, verificationFilter]);
  useEffect(() => { if (tab === 'developers' && currentUser?.role === 'ADMIN') fetchDevelopers(); }, [tab]);
  useEffect(() => { if (tab === 'agents' && currentUser?.role === 'ADMIN') fetchPendingAgents(); }, [tab]);

  // User management callbacks
  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchUsers(); };
  const handleRoleFilterChange = (value: string) => { setRoleFilter(value); setPage(1); };

  // Artist management callbacks
  const handleArtistSearch = (e: React.FormEvent) => { e.preventDefault(); setArtistPage(1); fetchArtists(); };
  const handleVerificationFilterChange = (value: string) => { setVerificationFilter(value); setArtistPage(1); };

  const handleVerify = async (id: string) => {
    setActionLoading(id);
    try { await api.put(`/admin/dashboard/artists/${id}/verify`); fetchArtists(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try { await api.put(`/admin/dashboard/artists/${id}/reject`); fetchArtists(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setActionLoading(null); }
  };

  const handleBan = async (id: string, ban: boolean) => {
    const msg = ban ? 'Ban this artist? They will not be able to log in.' : 'Unban this artist?';
    if (!confirm(msg)) return;
    setActionLoading(id);
    try { await api.put(`/admin/dashboard/artists/${id}/ban`, { banned: ban }); fetchArtists(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setActionLoading(null); }
  };

  const handleEditSave = async (id: string, form: { stageName: string; genre: string; bio: string }) => {
    setActionLoading(id);
    try { await api.put(`/admin/dashboard/artists/${id}`, form); fetchArtists(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setActionLoading(null); }
  };

  const handleEmailSend = async (id: string, form: { subject: string; message: string }): Promise<boolean> => {
    try { await api.post(`/admin/dashboard/artists/${id}/email`, form); return true; }
    catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); return false; }
  };

  // Developer callbacks
  const handleInviteDev = async (form: { email: string; permission: string }) => {
    await api.post('/admin/developers/invite', form);
    fetchDevelopers();
  };

  const handleCancelInvite = async (id: string) => {
    setActionLoading(id);
    try { await api.delete(`/admin/developers/invites/${id}`); fetchDevelopers(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setActionLoading(null); }
  };

  const handleResendInvite = async (id: string) => {
    setActionLoading(id);
    try { await api.post(`/admin/developers/invites/${id}/resend`); fetchDevelopers(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setActionLoading(null); }
  };

  const handleRevokeDev = async (id: string) => {
    if (!confirm('Revoke developer access? They will be demoted to FAN.')) return;
    setActionLoading(id);
    try { await api.put(`/admin/developers/${id}/revoke`); fetchDevelopers(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
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
          {([...(['analytics', 'users', 'artists'] as const), ...(currentUser?.role === 'ADMIN' ? ['agents' as const, 'developers' as const, 'integrations' as const] : [])]).map((t) => (
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

        {tab === 'analytics' && analytics && (
          <AdminAnalytics analytics={analytics} />
        )}

        {tab === 'users' && users && (
          <AdminUserManagement
            users={users}
            search={search}
            roleFilter={roleFilter}
            page={page}
            onSearchChange={setSearch}
            onRoleFilterChange={handleRoleFilterChange}
            onPageChange={setPage}
            onSearchSubmit={handleSearch}
          />
        )}

        {tab === 'artists' && artists && (
          <AdminArtistManagement
            artists={artists}
            artistSearch={artistSearch}
            verificationFilter={verificationFilter}
            artistPage={artistPage}
            actionLoading={actionLoading}
            onArtistSearchChange={setArtistSearch}
            onVerificationFilterChange={handleVerificationFilterChange}
            onArtistPageChange={setArtistPage}
            onArtistSearchSubmit={handleArtistSearch}
            onVerify={handleVerify}
            onReject={handleReject}
            onBan={handleBan}
            onEditSave={handleEditSave}
            onEmailSend={handleEmailSend}
          />
        )}

        {tab === 'agents' && currentUser?.role === 'ADMIN' && (
          <div>
            <h2 className="font-display text-lg tracking-wider text-warm-50 mb-4">PENDING AGENT APPLICATIONS</h2>
            {pendingAgents.length === 0 ? (
              <div className="bg-noir-900 border border-noir-700 rounded-xl p-8 text-center">
                <p className="text-gray-500">No pending agent applications</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingAgents.map((agent) => (
                  <div key={agent.id} className="bg-noir-900 border border-noir-700 rounded-xl p-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Avatar */}
                      <div className="w-16 h-16 rounded-full bg-noir-800 flex items-center justify-center text-amber-400 text-xl font-bold shrink-0 overflow-hidden">
                        {agent.profileImageUrl ? (
                          <img src={agent.profileImageUrl} alt={agent.displayName} className="w-full h-full object-cover" />
                        ) : agent.displayName.charAt(0).toUpperCase()}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-warm-50 font-semibold text-lg">{agent.displayName}</h3>
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-xs">Pending</span>
                        </div>
                        {agent.headline && <p className="text-gray-400 text-sm mb-1">{agent.headline}</p>}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
                          <span>{agent.city}, {agent.state}</span>
                          <span>{agent.user.email}</span>
                          {agent.age && <span>Age {agent.age}</span>}
                          {agent.yearsExperience !== null && <span>{agent.yearsExperience} yrs exp</span>}
                          {agent.promoterType && <span>{agent.promoterType}</span>}
                          <span>Profile: {agent.profileStrength}%</span>
                        </div>
                        {agent.bio && <p className="text-gray-400 text-sm mb-2 line-clamp-2">{agent.bio}</p>}
                        {agent.genres.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {agent.genres.map((g) => (
                              <span key={g} className="px-2 py-0.5 bg-amber-500/10 text-amber-400/80 rounded text-[10px]">{g}</span>
                            ))}
                          </div>
                        )}
                        {agent.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {agent.skills.map((s) => (
                              <span key={s} className="px-2 py-0.5 bg-noir-800 text-gray-400 rounded text-[10px]">{s}</span>
                            ))}
                          </div>
                        )}
                        {/* Note + Actions */}
                        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                          <input
                            type="text"
                            placeholder="Optional note..."
                            value={agentNote[agent.id] || ''}
                            onChange={(e) => setAgentNote((prev) => ({ ...prev, [agent.id]: e.target.value }))}
                            className="flex-1 px-3 py-1.5 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg text-sm placeholder-gray-600 focus:ring-1 focus:ring-amber-500/50 outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAgentVerify(agent.id, 'APPROVED')}
                              disabled={actionLoading === agent.id}
                              className="px-4 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm font-medium hover:bg-green-500/30 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === agent.id ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleAgentVerify(agent.id, 'REJECTED')}
                              disabled={actionLoading === agent.id}
                              className="px-4 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === agent.id ? '...' : 'Reject'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'developers' && currentUser?.role === 'ADMIN' && (
          <AdminDeveloperInvites
            developers={developers}
            devInvites={devInvites}
            actionLoading={actionLoading}
            onInviteDev={handleInviteDev}
            onCancelInvite={handleCancelInvite}
            onResendInvite={handleResendInvite}
            onRevokeDev={handleRevokeDev}
          />
        )}

        {tab === 'integrations' && currentUser?.role === 'ADMIN' && (
          <AdminIntegrations />
        )}
      </div>

      {/* Floating Dev Chat */}
      <Suspense fallback={null}>
        <DevChat />
      </Suspense>
    </div>
  );
}
