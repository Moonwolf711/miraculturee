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

  // Artist profile edit state
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileTab, setProfileTab] = useState<'basic' | 'media' | 'music' | 'socials' | 'location'>('basic');
  const [profileForm, setProfileForm] = useState<Record<string, unknown>>({
    stageName: '', bio: '', professionalType: '', hometown: '',
    profileImageUrl: '', bannerImageUrl: '',
    genres: [] as string[], instruments: [] as string[], yearsActive: '',
    socialLinks: {} as Record<string, string>, followerCount: {} as Record<string, string>,
    city: '', state: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Event media edit state
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventMediaForm, setEventMediaForm] = useState<Record<string, unknown>>({
    flyerImageUrl: '', flyerImage2Url: '', promoVideoUrl: '',
    eventSocialLinks: {} as Record<string, string>, eventHashtag: '', lineupNotes: '',
  });
  const [eventMediaSaving, setEventMediaSaving] = useState(false);
  const [uploadingFlyer, setUploadingFlyer] = useState(false);
  const [uploadingFlyer2, setUploadingFlyer2] = useState(false);

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

  const GENRE_OPTIONS = ['EDM', 'Rap', 'Hip-Hop', 'R&B', 'Rock', 'Pop', 'Electronic', 'Country', 'Jazz', 'Latin', 'Reggae', 'Metal', 'Indie', 'Folk', 'Blues', 'Punk', 'Soul', 'Funk', 'Classical', 'Gospel', 'Afrobeats', 'K-Pop', 'House', 'Techno', 'Drum & Bass', 'Dubstep', 'Trap', 'Lo-Fi'];
  const INSTRUMENT_OPTIONS = ['Vocals', 'Guitar', 'Bass', 'Drums', 'Keys/Piano', 'Synthesizer', 'Turntables/DJ', 'Saxophone', 'Trumpet', 'Violin', 'Cello', 'Flute', 'Percussion', 'Harmonica', 'Ukulele', 'Banjo', 'Production/DAW'];
  const PROFESSIONAL_TYPES = ['DJ/Producer', 'Instrumentalist/Vocalist', 'Band/Label', 'Singer-Songwriter', 'MC/Rapper'];
  const US_STATES: Record<string, string> = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
    CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
    MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
    OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
    VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
    DC: 'Washington DC',
  };

  const handleArtistImageUpload = async (file: File, field: 'profileImageUrl' | 'bannerImageUrl') => {
    const setter = field === 'profileImageUrl' ? setUploadingPhoto : setUploadingBanner;
    setter(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/upload/profile-image`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      setProfileForm(prev => ({ ...prev, [field]: url }));
    } catch {
      // silent fail
    } finally {
      setter(false);
    }
  };

  const handleEventImageUpload = async (file: File, field: 'flyerImageUrl' | 'flyerImage2Url') => {
    const setter = field === 'flyerImageUrl' ? setUploadingFlyer : setUploadingFlyer2;
    setter(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/upload/profile-image`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      setEventMediaForm(prev => ({ ...prev, [field]: url }));
    } catch {
      // silent fail
    } finally {
      setter(false);
    }
  };

  const toggleArtistPill = (field: 'genres' | 'instruments', value: string) => {
    setProfileForm(prev => {
      const arr = (prev[field] as string[]) || [];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v: string) => v !== value) : [...arr, value],
      };
    });
  };

  const openProfileEdit = useCallback(() => {
    api.get<Record<string, unknown>>('/artist/profile')
      .then((p) => {
        setProfileForm({
          stageName: (p.stageName as string) || '',
          bio: (p.bio as string) || '',
          professionalType: (p.professionalType as string) || '',
          hometown: (p.hometown as string) || '',
          profileImageUrl: (p.profileImageUrl as string) || '',
          bannerImageUrl: (p.bannerImageUrl as string) || '',
          genres: (p.genres as string[]) || [],
          instruments: (p.instruments as string[]) || [],
          yearsActive: p.yearsActive ?? '',
          socialLinks: (p.socialLinks as Record<string, string>) || {},
          followerCount: (p.followerCount as Record<string, string>) || {},
          city: (p.city as string) || '',
          state: (p.state as string) || '',
        });
        setProfileTab('basic');
        setShowProfileEdit(true);
      })
      .catch(() => setShowProfileEdit(true));
  }, []);

  const saveProfile = useCallback(async () => {
    setProfileSaving(true);
    try {
      await api.put('/artist/profile', {
        stageName: profileForm.stageName || undefined,
        bio: profileForm.bio || undefined,
        professionalType: profileForm.professionalType || undefined,
        hometown: profileForm.hometown || undefined,
        profileImageUrl: profileForm.profileImageUrl || undefined,
        bannerImageUrl: profileForm.bannerImageUrl || undefined,
        genres: profileForm.genres,
        instruments: profileForm.instruments,
        yearsActive: profileForm.yearsActive ? Number(profileForm.yearsActive) : undefined,
        socialLinks: profileForm.socialLinks,
        followerCount: profileForm.followerCount,
        city: profileForm.city || undefined,
        state: profileForm.state || undefined,
      });
      setShowProfileEdit(false);
      fetchDashboard();
    } catch {}
    finally { setProfileSaving(false); }
  }, [profileForm, fetchDashboard]);

  const openEventMediaEdit = useCallback((eventId: string) => {
    // Fetch event data to populate form
    api.get<Record<string, unknown>>(`/events/${eventId}`)
      .then((e) => {
        setEventMediaForm({
          flyerImageUrl: (e.flyerImageUrl as string) || '',
          flyerImage2Url: (e.flyerImage2Url as string) || '',
          promoVideoUrl: (e.promoVideoUrl as string) || '',
          eventSocialLinks: (e.eventSocialLinks as Record<string, string>) || {},
          eventHashtag: (e.eventHashtag as string) || '',
          lineupNotes: (e.lineupNotes as string) || '',
        });
        setEditingEventId(eventId);
      })
      .catch(() => {
        setEventMediaForm({
          flyerImageUrl: '', flyerImage2Url: '', promoVideoUrl: '',
          eventSocialLinks: {}, eventHashtag: '', lineupNotes: '',
        });
        setEditingEventId(eventId);
      });
  }, []);

  const saveEventMedia = useCallback(async () => {
    if (!editingEventId) return;
    setEventMediaSaving(true);
    try {
      await api.put(`/artist/events/${editingEventId}`, {
        flyerImageUrl: eventMediaForm.flyerImageUrl || undefined,
        flyerImage2Url: eventMediaForm.flyerImage2Url || undefined,
        promoVideoUrl: eventMediaForm.promoVideoUrl || undefined,
        eventSocialLinks: eventMediaForm.eventSocialLinks,
        eventHashtag: eventMediaForm.eventHashtag || undefined,
        lineupNotes: eventMediaForm.lineupNotes || undefined,
      });
      setEditingEventId(null);
    } catch {}
    finally { setEventMediaSaving(false); }
  }, [editingEventId, eventMediaForm]);

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
            <button
              onClick={openProfileEdit}
              className="px-5 py-2.5 border border-noir-600 text-gray-300 hover:border-amber-500/40 hover:text-amber-400 font-semibold rounded-lg text-sm transition-colors"
            >
              Edit Profile
            </button>
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
              <div
                key={event.id}
                className="bg-noir-800 border border-noir-700 rounded-xl p-5 hover:border-amber-500/30 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <Link to={`/events/${event.id}`} className="flex-1 min-w-0">
                    <h3 className="text-warm-50 font-medium">{event.title}</h3>
                    <p className="text-sm text-gray-400 mt-1 font-body">
                      {event.venueName}, {event.venueCity} &middot; {formatDate(event.date)}
                    </p>
                  </Link>
                  <div className="flex items-center gap-3 ml-4">
                    <button
                      onClick={() => openEventMediaEdit(event.id)}
                      className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs uppercase tracking-wide font-semibold transition-colors"
                    >
                      Edit Media
                    </button>
                    <div className="text-right">
                      <div className="text-warm-50 font-display text-lg">
                        {event.supportedTickets}
                      </div>
                      <div className="text-xs uppercase tracking-wider text-gray-400">supported</div>
                    </div>
                  </div>
                </div>
              </div>
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

      {/* Profile edit modal — rich tabbed version */}
      {showProfileEdit && (
        <div className="fixed inset-0 z-50 bg-noir-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowProfileEdit(false)}>
          <div className="bg-noir-900 border border-noir-700 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="sticky top-0 bg-noir-900 border-b border-noir-700/50 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl shrink-0">
              <h2 className="text-lg font-display tracking-wider text-warm-50">Edit Artist Profile</h2>
              <button onClick={() => setShowProfileEdit(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 px-6 pt-4 pb-2 bg-noir-900 shrink-0 overflow-x-auto">
              {([
                { key: 'basic' as const, label: 'Basic' },
                { key: 'media' as const, label: 'Media' },
                { key: 'music' as const, label: 'Music' },
                { key: 'socials' as const, label: 'Socials' },
                { key: 'location' as const, label: 'Location' },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setProfileTab(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    profileTab === t.key
                      ? 'bg-amber-500 text-noir-950'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-noir-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">
              {/* BASIC TAB */}
              {profileTab === 'basic' && (
                <>
                  <div>
                    <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Stage Name</label>
                    <input
                      type="text"
                      value={(profileForm.stageName as string) || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, stageName: e.target.value }))}
                      className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Professional Type</label>
                    <select
                      value={(profileForm.professionalType as string) || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, professionalType: e.target.value }))}
                      className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors"
                    >
                      <option value="">Select type...</option>
                      {PROFESSIONAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Bio</label>
                    <textarea
                      rows={5}
                      maxLength={2000}
                      value={(profileForm.bio as string) || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                      className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600 resize-none"
                      placeholder="Tell fans about yourself and your music..."
                    />
                    <p className="text-gray-600 text-xs mt-1 text-right">{((profileForm.bio as string) || '').length}/2000</p>
                  </div>
                  <div>
                    <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Hometown</label>
                    <input
                      type="text"
                      value={(profileForm.hometown as string) || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, hometown: e.target.value }))}
                      className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                      placeholder="Where are you from?"
                      maxLength={100}
                    />
                  </div>
                </>
              )}

              {/* MEDIA TAB */}
              {profileTab === 'media' && (
                <>
                  <div>
                    <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Banner Image</label>
                    <label className="block cursor-pointer group">
                      <div className="h-32 rounded-lg overflow-hidden bg-noir-800 border border-noir-700 border-dashed relative">
                        {profileForm.bannerImageUrl ? (
                          <img src={profileForm.bannerImageUrl as string} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-amber-500/10 via-noir-800 to-noir-900 flex items-center justify-center">
                            <span className="text-gray-600 text-sm">Click or drag to upload banner</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-noir-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-gray-300 text-sm">{uploadingBanner ? 'Uploading...' : 'Change Banner'}</span>
                        </div>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleArtistImageUpload(file, 'bannerImageUrl');
                      }} />
                    </label>
                  </div>
                  <div>
                    <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Profile Photo</label>
                    <label className="inline-block cursor-pointer group">
                      <div className="w-24 h-24 rounded-full bg-noir-800 border-2 border-noir-700 border-dashed overflow-hidden relative flex items-center justify-center text-amber-400 text-3xl font-bold">
                        {profileForm.profileImageUrl ? (
                          <img src={profileForm.profileImageUrl as string} alt="" className="w-full h-full object-cover" />
                        ) : (
                          ((profileForm.stageName as string) || '?').charAt(0).toUpperCase()
                        )}
                        <div className="absolute inset-0 bg-noir-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                          {uploadingPhoto ? (
                            <svg className="w-5 h-5 text-gray-300 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          ) : (
                            <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          )}
                        </div>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleArtistImageUpload(file, 'profileImageUrl');
                      }} />
                    </label>
                  </div>
                </>
              )}

              {/* MUSIC TAB */}
              {profileTab === 'music' && (
                <>
                  <div>
                    <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Genres</label>
                    <div className="flex flex-wrap gap-2">
                      {GENRE_OPTIONS.map(g => {
                        const selected = ((profileForm.genres as string[]) || []).includes(g);
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => toggleArtistPill('genres', g)}
                            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                              selected
                                ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400'
                                : 'border border-noir-700 text-gray-400 hover:border-amber-500/40'
                            }`}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Instruments</label>
                    <div className="flex flex-wrap gap-2">
                      {INSTRUMENT_OPTIONS.map(i => {
                        const selected = ((profileForm.instruments as string[]) || []).includes(i);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => toggleArtistPill('instruments', i)}
                            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                              selected
                                ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400'
                                : 'border border-noir-700 text-gray-400 hover:border-amber-500/40'
                            }`}
                          >
                            {i}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Years Active</label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={(profileForm.yearsActive as string | number) ?? ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, yearsActive: e.target.value }))}
                      className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                      placeholder="0"
                    />
                  </div>
                </>
              )}

              {/* SOCIALS TAB */}
              {profileTab === 'socials' && (
                <>
                  <div>
                    <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Social Links</label>
                    <div className="space-y-3">
                      {([
                        { key: 'instagram', label: 'Instagram', placeholder: 'username' },
                        { key: 'twitter', label: 'Twitter / X', placeholder: 'username' },
                        { key: 'tiktok', label: 'TikTok', placeholder: 'username' },
                        { key: 'spotify', label: 'Spotify', placeholder: 'artist URL or ID' },
                        { key: 'soundcloud', label: 'SoundCloud', placeholder: 'username' },
                        { key: 'youtube', label: 'YouTube', placeholder: 'channel URL' },
                        { key: 'website', label: 'Website', placeholder: 'https://...' },
                      ]).map(({ key, label, placeholder }) => (
                        <div key={key} className="flex items-center gap-3">
                          <span className="text-gray-500 text-sm w-24 shrink-0">{label}</span>
                          <input
                            type="text"
                            value={((profileForm.socialLinks as Record<string, string>) || {})[key] || ''}
                            onChange={(e) => setProfileForm(prev => ({
                              ...prev,
                              socialLinks: { ...((prev.socialLinks as Record<string, string>) || {}), [key]: e.target.value },
                            }))}
                            className="flex-1 px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                            placeholder={placeholder}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Follower Counts (optional)</label>
                    <div className="space-y-3">
                      {([
                        { key: 'instagram', label: 'Instagram' },
                        { key: 'spotify', label: 'Spotify' },
                        { key: 'tiktok', label: 'TikTok' },
                        { key: 'soundcloud', label: 'SoundCloud' },
                      ]).map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-3">
                          <span className="text-gray-500 text-sm w-24 shrink-0">{label}</span>
                          <input
                            type="text"
                            value={((profileForm.followerCount as Record<string, string>) || {})[key] || ''}
                            onChange={(e) => setProfileForm(prev => ({
                              ...prev,
                              followerCount: { ...((prev.followerCount as Record<string, string>) || {}), [key]: e.target.value },
                            }))}
                            className="flex-1 px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                            placeholder="e.g. 12500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* LOCATION TAB */}
              {profileTab === 'location' && (
                <>
                  <div>
                    <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">City</label>
                    <input
                      type="text"
                      value={(profileForm.city as string) || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                      placeholder="Your city"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">State</label>
                    <select
                      value={(profileForm.state as string) || ''}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, state: e.target.value }))}
                      className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors"
                    >
                      <option value="">Select state...</option>
                      {Object.entries(US_STATES).map(([code, name]) => (
                        <option key={code} value={code}>{name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Modal footer - sticky */}
            <div className="sticky bottom-0 bg-noir-900 border-t border-noir-700/50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl shrink-0">
              <button
                onClick={() => setShowProfileEdit(false)}
                className="px-6 py-2.5 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={profileSaving || !(profileForm.stageName as string)?.trim()}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {profileSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event media edit modal */}
      {editingEventId && (
        <div className="fixed inset-0 z-50 bg-noir-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingEventId(null)}>
          <div className="bg-noir-900 border border-noir-700 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="sticky top-0 bg-noir-900 border-b border-noir-700/50 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl shrink-0">
              <h2 className="text-lg font-display tracking-wider text-warm-50">Edit Event Media</h2>
              <button onClick={() => setEditingEventId(null)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">
              {/* Flyer image upload */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Event Flyer</label>
                <label className="block cursor-pointer group">
                  <div className="h-40 rounded-lg overflow-hidden bg-noir-800 border border-noir-700 border-dashed relative">
                    {eventMediaForm.flyerImageUrl ? (
                      <img src={eventMediaForm.flyerImageUrl as string} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-gray-600 text-sm">Click or drag to upload flyer</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-noir-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-gray-300 text-sm">{uploadingFlyer ? 'Uploading...' : 'Change Flyer'}</span>
                    </div>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleEventImageUpload(file, 'flyerImageUrl');
                  }} />
                </label>
              </div>

              {/* 2nd Flyer */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Second Flyer (optional)</label>
                <label className="block cursor-pointer group">
                  <div className="h-32 rounded-lg overflow-hidden bg-noir-800 border border-noir-700 border-dashed relative">
                    {eventMediaForm.flyerImage2Url ? (
                      <img src={eventMediaForm.flyerImage2Url as string} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-gray-600 text-sm">Click or drag to upload second flyer</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-noir-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-gray-300 text-sm">{uploadingFlyer2 ? 'Uploading...' : 'Change Flyer'}</span>
                    </div>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleEventImageUpload(file, 'flyerImage2Url');
                  }} />
                </label>
              </div>

              {/* Promo Video URL */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Promo Video URL</label>
                <input
                  type="text"
                  value={(eventMediaForm.promoVideoUrl as string) || ''}
                  onChange={(e) => setEventMediaForm(prev => ({ ...prev, promoVideoUrl: e.target.value }))}
                  className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                  placeholder="YouTube or Vimeo URL"
                />
              </div>

              {/* Event social links */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Event Social Links</label>
                <div className="space-y-3">
                  {([
                    { key: 'instagram', label: 'Instagram', placeholder: 'Event IG post URL' },
                    { key: 'facebook', label: 'Facebook', placeholder: 'Facebook event URL' },
                    { key: 'eventbrite', label: 'Eventbrite', placeholder: 'Eventbrite listing URL' },
                  ]).map(({ key, label, placeholder }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-gray-500 text-sm w-24 shrink-0">{label}</span>
                      <input
                        type="text"
                        value={((eventMediaForm.eventSocialLinks as Record<string, string>) || {})[key] || ''}
                        onChange={(e) => setEventMediaForm(prev => ({
                          ...prev,
                          eventSocialLinks: { ...((prev.eventSocialLinks as Record<string, string>) || {}), [key]: e.target.value },
                        }))}
                        className="flex-1 px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                        placeholder={placeholder}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Event hashtag */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Event Hashtag</label>
                <input
                  type="text"
                  value={(eventMediaForm.eventHashtag as string) || ''}
                  onChange={(e) => setEventMediaForm(prev => ({ ...prev, eventHashtag: e.target.value }))}
                  className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                  placeholder="#YourEventHashtag"
                  maxLength={50}
                />
              </div>

              {/* Lineup notes */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Lineup Notes</label>
                <textarea
                  rows={3}
                  value={(eventMediaForm.lineupNotes as string) || ''}
                  onChange={(e) => setEventMediaForm(prev => ({ ...prev, lineupNotes: e.target.value }))}
                  className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600 resize-none"
                  placeholder="w/ Special Guest DJ XYZ, opening set by..."
                  maxLength={500}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 bg-noir-900 border-t border-noir-700/50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl shrink-0">
              <button
                onClick={() => setEditingEventId(null)}
                className="px-6 py-2.5 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEventMedia}
                disabled={eventMediaSaving}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {eventMediaSaving ? 'Saving...' : 'Save Media'}
              </button>
            </div>
          </div>
        </div>
      )}

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
