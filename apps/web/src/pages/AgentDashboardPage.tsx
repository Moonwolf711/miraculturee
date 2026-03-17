import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../lib/api.js';

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

interface CampaignInfo {
  id: string;
  status: string;
  revenueSharePct: number;
  artistRating: number | null;
  artistReview: string | null;
  createdAt: string;
  campaign: {
    id: string;
    headline: string;
    status: string;
    fundedCents: number;
    goalCents: number;
    event: { title: string; date: string; venueCity: string } | null;
  };
}

interface AgentProfile {
  id: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  state: string;
  city: string;
  age: number | null;
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
  yearsExperience: number | null;
  promoterType: string | null;
  genres: string[];
  skills: string[];
  venueExperience: string | null;
  promotionHistory: string | null;
  socialLinks: { instagram?: string; twitter?: string; tiktok?: string; website?: string } | null;
  totalCampaigns: number;
  totalEarnedCents: number;
  rating: number | null;
  ratingCount: number;
  verificationStatus: string;
  profileStrength: number;
  createdAt: string;
  campaigns: CampaignInfo[];
}

function StarRating({ rating, count }: { rating: number | null; count: number }) {
  if (rating === null) return <span className="text-gray-600 text-sm">No ratings yet</span>;
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`w-5 h-5 ${s <= Math.round(rating) ? 'text-amber-400' : 'text-gray-700'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-warm-50 font-medium ml-1">{rating.toFixed(1)}</span>
      <span className="text-gray-500 text-sm">({count} review{count !== 1 ? 's' : ''})</span>
    </div>
  );
}

function VerificationBadge({ status }: { status: string }) {
  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-full text-xs font-medium">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        Verified
      </span>
    );
  }
  if (status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-medium">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Pending Verification
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full text-xs font-medium">
      Rejected
    </span>
  );
}

interface SubscriptionStatus {
  status: string;
  currentPeriodEnd: string | null;
  raffleCreditCents: number;
  raffleCreditDollars: string;
  creditExpiresAt: string | null;
  priceCents: number;
  priceDollars: string;
  monthlyCreditCents: number;
  monthlyCreditDollars: string;
}

export default function AgentDashboardPage() {
  const { user } = useAuth();
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'campaigns' | 'reviews'>('overview');
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<AgentProfile>('/agents/profile/me').then(setAgent),
      api.get<SubscriptionStatus>('/agents/subscription').then(setSub).catch(() => {}),
    ])
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const { url } = await api.post<{ url: string }>('/agents/subscribe');
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed');
      setSubscribing(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const { url } = await api.post<{ url: string }>('/agents/portal');
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    }
  };

  const handleImageUpload = async (file: File, field: 'profileImageUrl' | 'bannerImageUrl') => {
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
      setEditForm(prev => ({ ...prev, [field]: url }));
    } catch {
      setError('Image upload failed');
    } finally {
      setter(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        displayName: editForm.displayName,
        headline: editForm.headline || undefined,
        bio: editForm.bio || undefined,
        profileImageUrl: editForm.profileImageUrl || undefined,
        bannerImageUrl: editForm.bannerImageUrl || undefined,
        promoterType: editForm.promoterType || undefined,
        yearsExperience: editForm.yearsExperience ? Number(editForm.yearsExperience) : undefined,
        genres: editForm.genres,
        skills: editForm.skills,
        socialLinks: editForm.socialLinks,
      };
      const updated = await api.put<AgentProfile>('/agents/profile', payload);
      setAgent(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const GENRE_OPTIONS = ['Hip-Hop', 'R&B', 'Pop', 'Rock', 'Electronic', 'Country', 'Jazz', 'Latin', 'Reggae', 'Metal', 'Indie', 'Folk', 'Blues', 'Punk', 'Soul', 'Funk', 'Classical', 'Gospel', 'Afrobeats', 'K-Pop'];
  const SKILL_OPTIONS = ['Social Media Marketing', 'Flyering', 'Venue Relations', 'Ticket Sales', 'Event Planning', 'Photography', 'Videography', 'Graphic Design', 'Community Outreach', 'Press Relations', 'Radio Promotion', 'Street Marketing', 'Influencer Networking', 'Brand Partnerships', 'Data Analytics'];
  const PROMOTER_TYPES = ['Concert', 'Club', 'Festival', 'Venue', 'Street Team', 'Independent', 'Other'];

  const openEditModal = () => {
    if (!agent) return;
    setEditForm({
      displayName: agent.displayName,
      headline: agent.headline || '',
      bio: agent.bio || '',
      profileImageUrl: agent.profileImageUrl || '',
      bannerImageUrl: agent.bannerImageUrl || '',
      promoterType: agent.promoterType || '',
      yearsExperience: agent.yearsExperience ?? '',
      genres: [...(agent.genres || [])],
      skills: [...(agent.skills || [])],
      socialLinks: { ...(agent.socialLinks || {}) },
    });
    setEditing(true);
  };

  const togglePill = (field: 'genres' | 'skills', value: string) => {
    setEditForm(prev => {
      const arr = (prev[field] as string[]) || [];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v: string) => v !== value) : [...arr, value],
      };
    });
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center">
        <div className="text-gray-500">Loading your agent profile...</div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-gray-400 mb-4">{error || 'No agent profile found.'}</p>
          <Link to="/agents/register" className="text-amber-400 hover:underline">Create your agent profile</Link>
        </div>
      </div>
    );
  }

  const reviews = agent.campaigns.filter((c) => c.artistRating !== null);
  const activeCampaigns = agent.campaigns.filter((c) => c.status === 'ACTIVE' || c.status === 'ASSIGNED');
  const completedCampaigns = agent.campaigns.filter((c) => c.status === 'COMPLETED');

  return (
    <div className="min-h-screen bg-noir-950 py-8">
      <div className="max-w-4xl mx-auto px-4">

        {/* Profile header */}
        <div className="bg-noir-900 border border-noir-700/50 rounded-2xl overflow-hidden mb-6">
          {/* Banner */}
          <div className="h-40 bg-noir-800 relative">
            {agent.bannerImageUrl ? (
              <img src={agent.bannerImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-500/10 via-noir-800 to-noir-900" />
            )}
          </div>
          {/* Profile content overlapping banner */}
          <div className="px-6 pb-6">
            <div className="-mt-12 flex flex-col sm:flex-row gap-5">
              {/* Avatar with border */}
              <div className="w-24 h-24 rounded-full bg-noir-800 border-4 border-noir-900 flex items-center justify-center text-amber-400 text-3xl font-bold shrink-0 self-center sm:self-start overflow-hidden">
                {agent.profileImageUrl ? (
                  <img src={agent.profileImageUrl} alt={agent.displayName} className="w-full h-full rounded-full object-cover" />
                ) : agent.displayName.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 pt-2">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl font-display tracking-wider text-warm-50">{agent.displayName}</h1>
                  <VerificationBadge status={agent.verificationStatus} />
                </div>
                {agent.headline && <p className="text-gray-400 mb-2">{agent.headline}</p>}
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {agent.city}, {US_STATES[agent.state] || agent.state}
                  </span>
                  {agent.age && <span>Age {agent.age}</span>}
                  {agent.yearsExperience !== null && <span>{agent.yearsExperience} yrs experience</span>}
                  {agent.promoterType && (
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-xs">{agent.promoterType}</span>
                  )}
                </div>
                <StarRating rating={agent.rating} count={agent.ratingCount} />
              </div>

              {/* Edit button */}
              <button
                onClick={openEditModal}
                className="px-4 py-2 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors text-sm self-start"
              >
                Edit Profile
              </button>
            </div>

            {/* Profile strength bar */}
            <div className="mt-5 pt-4 border-t border-noir-700/50">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500">Profile Strength</span>
                <span className={agent.profileStrength >= 80 ? 'text-green-400' : agent.profileStrength >= 50 ? 'text-amber-400' : 'text-gray-500'}>{agent.profileStrength}%</span>
              </div>
              <div className="h-1.5 bg-noir-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${agent.profileStrength >= 80 ? 'bg-green-500' : agent.profileStrength >= 50 ? 'bg-amber-500' : 'bg-gray-600'}`} style={{ width: `${agent.profileStrength}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-warm-50">{agent.totalCampaigns}</p>
            <p className="text-gray-500 text-xs mt-1">Total Campaigns</p>
          </div>
          <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">${((agent.totalEarnedCents || 0) / 100).toFixed(0)}</p>
            <p className="text-gray-500 text-xs mt-1">Total Earned</p>
          </div>
          <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{agent.rating?.toFixed(1) || '---'}</p>
            <p className="text-gray-500 text-xs mt-1">Avg Rating</p>
          </div>
          <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-warm-50">{activeCampaigns.length}</p>
            <p className="text-gray-500 text-xs mt-1">Active Now</p>
          </div>
        </div>

        {/* Subscription & Raffle Credits */}
        {sub?.status === 'active' ? (
          <div className="bg-gradient-to-r from-amber-500/5 to-green-500/5 border border-amber-500/20 rounded-xl p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-warm-50 font-semibold mb-1">Agent Pro Subscription</h3>
                <p className="text-gray-400 text-sm">${sub.priceDollars}/mo &mdash; Active</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-amber-400">${sub.raffleCreditDollars}</p>
                  <p className="text-gray-500 text-xs">Raffle Credits</p>
                </div>
                <div className="h-8 w-px bg-noir-700" />
                <div className="text-center">
                  {sub.creditExpiresAt && (
                    <p className="text-xs text-gray-500">Expires {new Date(sub.creditExpiresAt).toLocaleDateString()}</p>
                  )}
                  <p className="text-amber-400/70 text-xs">Use it or lose it</p>
                </div>
              </div>
              <button onClick={handleManageBilling} className="px-4 py-2 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors text-sm">
                Manage Billing
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-xl p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-warm-50 font-semibold mb-1">Agent Pro Subscription</h3>
                <p className="text-gray-400 text-sm">$19.99/mo &mdash; Get $5/mo in raffle credits, 50% campaign revenue, verified badge</p>
              </div>
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className="px-6 py-2.5 bg-amber-500 text-noir-950 rounded-lg font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {subscribing ? 'Redirecting...' : 'Subscribe — $19.99/mo'}
              </button>
            </div>
          </div>
        )}

        {/* Tab nav */}
        <div className="flex gap-1 mb-6 bg-noir-900 rounded-lg p-1">
          {(['overview', 'campaigns', 'reviews'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-amber-500 text-noir-950' : 'text-gray-400 hover:text-gray-300'
              }`}>
              {t} {t === 'reviews' ? `(${reviews.length})` : t === 'campaigns' ? `(${agent.campaigns.length})` : ''}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Bio */}
            {agent.bio && (
              <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-5">
                <h3 className="text-gray-300 text-sm font-medium mb-2">About</h3>
                <p className="text-gray-400 text-sm whitespace-pre-line">{agent.bio}</p>
              </div>
            )}

            {/* Genres & Skills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {agent.genres.length > 0 && (
                <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-5">
                  <h3 className="text-gray-300 text-sm font-medium mb-3">Genres</h3>
                  <div className="flex flex-wrap gap-2">
                    {agent.genres.map((g) => (
                      <span key={g} className="px-3 py-1 bg-noir-800 text-gray-300 rounded-full text-xs">{g}</span>
                    ))}
                  </div>
                </div>
              )}
              {agent.skills.length > 0 && (
                <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-5">
                  <h3 className="text-gray-300 text-sm font-medium mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {agent.skills.map((s) => (
                      <span key={s} className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Venue Experience */}
            {agent.venueExperience && (
              <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-5">
                <h3 className="text-gray-300 text-sm font-medium mb-2">Venue Experience</h3>
                <p className="text-gray-400 text-sm whitespace-pre-line">{agent.venueExperience}</p>
              </div>
            )}

            {/* Promotion History */}
            {agent.promotionHistory && (
              <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-5">
                <h3 className="text-gray-300 text-sm font-medium mb-2">Promotion History</h3>
                <p className="text-gray-400 text-sm whitespace-pre-line">{agent.promotionHistory}</p>
              </div>
            )}

            {/* Social Links */}
            {agent.socialLinks && Object.values(agent.socialLinks).some(Boolean) && (
              <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-5">
                <h3 className="text-gray-300 text-sm font-medium mb-3">Social Links</h3>
                <div className="flex flex-wrap gap-3">
                  {agent.socialLinks.instagram && (
                    <a href={`https://instagram.com/${agent.socialLinks.instagram}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-noir-800 rounded-lg text-sm text-gray-300 hover:text-amber-400 transition-colors">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                      @{agent.socialLinks.instagram}
                    </a>
                  )}
                  {agent.socialLinks.twitter && (
                    <a href={`https://twitter.com/${agent.socialLinks.twitter}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-noir-800 rounded-lg text-sm text-gray-300 hover:text-amber-400 transition-colors">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      @{agent.socialLinks.twitter}
                    </a>
                  )}
                  {agent.socialLinks.tiktok && (
                    <a href={`https://tiktok.com/@${agent.socialLinks.tiktok}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-noir-800 rounded-lg text-sm text-gray-300 hover:text-amber-400 transition-colors">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43v-7.15a8.16 8.16 0 005.58 2.17V11.2a4.85 4.85 0 01-3.58-1.93V6.69h3.58z"/></svg>
                      @{agent.socialLinks.tiktok}
                    </a>
                  )}
                  {agent.socialLinks.website && (
                    <a href={agent.socialLinks.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-noir-800 rounded-lg text-sm text-gray-300 hover:text-amber-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      Website
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'campaigns' && (
          <div className="space-y-3">
            {agent.campaigns.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-2">No campaigns yet</p>
                <p className="text-gray-600 text-sm">Artists will find you in the marketplace once you're verified</p>
              </div>
            ) : (
              agent.campaigns.map((ac) => (
                <div key={ac.id} className="bg-noir-900 border border-noir-700/50 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-warm-50 font-medium">{ac.campaign.headline}</h4>
                      {ac.campaign.event && (
                        <p className="text-gray-500 text-sm">{ac.campaign.event.title} &mdash; {ac.campaign.event.venueCity}</p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      ac.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                      ac.status === 'ACTIVE' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-noir-800 text-gray-500'
                    }`}>
                      {ac.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span>{ac.revenueSharePct}% revenue share</span>
                    <span>${(ac.campaign.fundedCents / 100).toFixed(0)} / ${(ac.campaign.goalCents / 100).toFixed(0)} funded</span>
                    {ac.artistRating && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        {ac.artistRating}/5
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'reviews' && (
          <div className="space-y-3">
            {reviews.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-2">No reviews yet</p>
                <p className="text-gray-600 text-sm">Reviews appear here after artists rate your campaign work</p>
              </div>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="bg-noir-900 border border-noir-700/50 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <svg key={s} className={`w-4 h-4 ${s <= (r.artistRating ?? 0) ? 'text-amber-400' : 'text-gray-700'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-gray-500 text-xs">{r.campaign.headline}</span>
                  </div>
                  {r.artistReview && <p className="text-gray-400 text-sm">{r.artistReview}</p>}
                  {r.campaign.event && (
                    <p className="text-gray-600 text-xs mt-2">{r.campaign.event.title} &mdash; {r.campaign.event.venueCity}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Member since */}
        <div className="text-center text-gray-600 text-xs mt-8">
          Member since {new Date(agent.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-noir-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-noir-900 border border-noir-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-noir-900 border-b border-noir-700/50 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-display tracking-wider text-warm-50">Edit Profile</h2>
              <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Banner image upload */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Banner Image</label>
                <label className="block cursor-pointer group">
                  <div className="h-32 rounded-lg overflow-hidden bg-noir-800 border border-noir-700 relative">
                    {editForm.bannerImageUrl ? (
                      <img src={editForm.bannerImageUrl as string} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-500/10 via-noir-800 to-noir-900 flex items-center justify-center">
                        <span className="text-gray-600 text-sm">Click to upload banner</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-noir-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {uploadingBanner ? (
                        <span className="text-gray-300 text-sm">Uploading...</span>
                      ) : (
                        <span className="text-gray-300 text-sm">Change Banner</span>
                      )}
                    </div>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'bannerImageUrl');
                  }} />
                </label>
              </div>

              {/* Profile photo upload */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Profile Photo</label>
                <label className="inline-block cursor-pointer group">
                  <div className="w-24 h-24 rounded-full bg-noir-800 border-2 border-noir-700 overflow-hidden relative flex items-center justify-center text-amber-400 text-3xl font-bold">
                    {editForm.profileImageUrl ? (
                      <img src={editForm.profileImageUrl as string} alt="" className="w-full h-full object-cover" />
                    ) : (
                      agent.displayName.charAt(0).toUpperCase()
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
                    if (file) handleImageUpload(file, 'profileImageUrl');
                  }} />
                </label>
              </div>

              {/* Display Name */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Display Name</label>
                <input
                  type="text"
                  value={(editForm.displayName as string) || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                  className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                  placeholder="Your display name"
                />
              </div>

              {/* Headline */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Headline</label>
                <input
                  type="text"
                  maxLength={120}
                  value={(editForm.headline as string) || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, headline: e.target.value }))}
                  className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                  placeholder="Short tagline about you"
                />
                <p className="text-gray-600 text-xs mt-1 text-right">{((editForm.headline as string) || '').length}/120</p>
              </div>

              {/* Bio */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Bio</label>
                <textarea
                  rows={4}
                  value={(editForm.bio as string) || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                  className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600 resize-none"
                  placeholder="Tell artists about yourself..."
                />
              </div>

              {/* Promoter Type */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Promoter Type</label>
                <select
                  value={(editForm.promoterType as string) || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, promoterType: e.target.value }))}
                  className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors"
                >
                  <option value="">Select type...</option>
                  {PROMOTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Years Experience */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Years of Experience</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={(editForm.yearsExperience as string | number) ?? ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, yearsExperience: e.target.value }))}
                  className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                  placeholder="0"
                />
              </div>

              {/* Genres */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Genres</label>
                <div className="flex flex-wrap gap-2">
                  {GENRE_OPTIONS.map(g => {
                    const selected = ((editForm.genres as string[]) || []).includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => togglePill('genres', g)}
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

              {/* Skills */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {SKILL_OPTIONS.map(s => {
                    const selected = ((editForm.skills as string[]) || []).includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => togglePill('skills', s)}
                        className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                          selected
                            ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400'
                            : 'border border-noir-700 text-gray-400 hover:border-amber-500/40'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Social Links */}
              <div>
                <label className="font-display text-xs tracking-wider text-amber-500 uppercase mb-3 block">Social Links</label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-sm w-20 shrink-0">Instagram</span>
                    <input
                      type="text"
                      value={((editForm.socialLinks as Record<string, string>) || {}).instagram || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, socialLinks: { ...((prev.socialLinks as Record<string, string>) || {}), instagram: e.target.value } }))}
                      className="flex-1 px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                      placeholder="username"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-sm w-20 shrink-0">Twitter / X</span>
                    <input
                      type="text"
                      value={((editForm.socialLinks as Record<string, string>) || {}).twitter || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, socialLinks: { ...((prev.socialLinks as Record<string, string>) || {}), twitter: e.target.value } }))}
                      className="flex-1 px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                      placeholder="username"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-sm w-20 shrink-0">TikTok</span>
                    <input
                      type="text"
                      value={((editForm.socialLinks as Record<string, string>) || {}).tiktok || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, socialLinks: { ...((prev.socialLinks as Record<string, string>) || {}), tiktok: e.target.value } }))}
                      className="flex-1 px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                      placeholder="username"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-sm w-20 shrink-0">Website</span>
                    <input
                      type="text"
                      value={((editForm.socialLinks as Record<string, string>) || {}).website || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, socialLinks: { ...((prev.socialLinks as Record<string, string>) || {}), website: e.target.value } }))}
                      className="flex-1 px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer - sticky */}
            <div className="sticky bottom-0 bg-noir-900 border-t border-noir-700/50 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditing(false)}
                className="px-6 py-2.5 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editForm.displayName}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
