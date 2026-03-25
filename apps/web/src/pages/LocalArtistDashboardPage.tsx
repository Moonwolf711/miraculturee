import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const GENRE_OPTIONS = [
  'EDM', 'Rap', 'Hip-Hop', 'R&B', 'Rock', 'Pop', 'Country', 'Jazz', 'Latin',
  'Reggae', 'Metal', 'Indie', 'Folk', 'Blues', 'Soul', 'Funk', 'Classical',
  'Afrobeats', 'World',
];

const INSTRUMENT_OPTIONS = [
  'Turntables/CDJs', 'Ableton/DAW', 'Guitar', 'Bass', 'Drums', 'Keys/Piano',
  'Vocals', 'Saxophone', 'Trumpet', 'Violin', 'Other',
];

const PROFESSIONAL_TYPES = [
  'DJ/Producer', 'Vocalist/Singer', 'Instrumentalist', 'Band', 'MC/Rapper', 'Producer',
];

const RELEASE_TYPES = ['Single', 'EP', 'Album', 'Mixtape', 'Remix'];
const SHOW_ROLES = ['Headliner', 'Direct Support', 'Opener', 'Guest', 'Resident'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Release {
  id: string;
  title: string;
  type: string;
  platform: string | null;
  url: string | null;
  releaseDate: string | null;
}

interface Show {
  id: string;
  venueName: string;
  venueCity: string | null;
  eventTitle: string | null;
  date: string | null;
  role: string | null;
  ticketsSold: number | null;
  totalAttendance: number | null;
}

interface BookingRequest {
  id: string;
  requesterName: string;
  requesterEmail: string;
  message: string | null;
  eventTitle: string | null;
  eventDate: string | null;
  status: string;
  createdAt: string;
}

interface LocalArtistProfile {
  id: string;
  stageName: string;
  city: string;
  state: string;
  professionalType: string | null;
  bio: string | null;
  yearsActive: number | null;
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
  genres: string[];
  instruments: string[];
  socialLinks: {
    instagram?: string; twitter?: string; tiktok?: string;
    spotify?: string; soundcloud?: string; youtube?: string; website?: string;
  } | null;
  followerCounts: {
    instagram?: number; tiktok?: number; spotify?: number; soundcloud?: number;
  } | null;
  bookingEmail: string | null;
  bookingRate: string | null;
  availableForBooking: boolean;
  externalEpkUrl: string | null;
  verificationStatus: string;
  profileStrength: number;
  releases: Release[];
  shows: Show[];
  bookingRequests: BookingRequest[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
        Pending
      </span>
    );
  }
  return null;
}

function StrengthBar({ strength }: { strength: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-500">Profile Strength</span>
        <span className={strength >= 80 ? 'text-green-400' : strength >= 50 ? 'text-amber-400' : 'text-gray-500'}>{strength}%</span>
      </div>
      <div className="h-1.5 bg-noir-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${strength >= 80 ? 'bg-green-500' : strength >= 50 ? 'bg-amber-500' : 'bg-gray-600'}`} style={{ width: `${strength}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function LocalArtistDashboardPage() {
  const { user } = useAuth();
  const [artist, setArtist] = useState<LocalArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit modal
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Release modal
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);
  const [releaseForm, setReleaseForm] = useState({ title: '', type: 'Single', platform: '', url: '', releaseDate: '' });
  const [savingRelease, setSavingRelease] = useState(false);

  // Show modal
  const [showShowModal, setShowShowModal] = useState(false);
  const [editingShow, setEditingShow] = useState<Show | null>(null);
  const [showForm, setShowForm] = useState({ venueName: '', venueCity: '', eventTitle: '', date: '', role: 'Opener', ticketsSold: '', totalAttendance: '' });
  const [savingShow, setSavingShow] = useState(false);

  useEffect(() => {
    api.get<LocalArtistProfile>('/local-artists/profile/me')
      .then(setArtist)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  // ---- Profile Edit ----
  const openEditModal = () => {
    if (!artist) return;
    setEditForm({
      stageName: artist.stageName,
      bio: artist.bio || '',
      professionalType: artist.professionalType || '',
      yearsActive: artist.yearsActive ?? '',
      profileImageUrl: artist.profileImageUrl || '',
      bannerImageUrl: artist.bannerImageUrl || '',
      genres: [...(artist.genres || [])],
      instruments: [...(artist.instruments || [])],
      bookingEmail: artist.bookingEmail || '',
      bookingRate: artist.bookingRate || '',
      availableForBooking: artist.availableForBooking,
      socialLinks: { ...(artist.socialLinks || {}) },
    });
    setEditing(true);
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
      setEditForm((prev) => ({ ...prev, [field]: url }));
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
        stageName: editForm.stageName,
        bio: editForm.bio || undefined,
        professionalType: editForm.professionalType || undefined,
        yearsActive: editForm.yearsActive ? Number(editForm.yearsActive) : undefined,
        profileImageUrl: editForm.profileImageUrl || undefined,
        bannerImageUrl: editForm.bannerImageUrl || undefined,
        genres: editForm.genres,
        instruments: editForm.instruments,
        bookingEmail: editForm.bookingEmail || undefined,
        bookingRate: editForm.bookingRate || undefined,
        availableForBooking: editForm.availableForBooking,
        socialLinks: editForm.socialLinks,
      };
      const updated = await api.put<LocalArtistProfile>('/local-artists/profile', payload);
      setArtist(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const togglePill = (field: 'genres' | 'instruments', value: string) => {
    setEditForm((prev) => {
      const arr = (prev[field] as string[]) || [];
      return { ...prev, [field]: arr.includes(value) ? arr.filter((v: string) => v !== value) : [...arr, value] };
    });
  };

  // ---- Release CRUD ----
  const openAddRelease = () => {
    setEditingRelease(null);
    setReleaseForm({ title: '', type: 'Single', platform: '', url: '', releaseDate: '' });
    setShowReleaseModal(true);
  };
  const openEditRelease = (r: Release) => {
    setEditingRelease(r);
    setReleaseForm({ title: r.title, type: r.type, platform: r.platform || '', url: r.url || '', releaseDate: r.releaseDate || '' });
    setShowReleaseModal(true);
  };
  const handleSaveRelease = async () => {
    setSavingRelease(true);
    try {
      const payload = {
        title: releaseForm.title,
        type: releaseForm.type,
        platform: releaseForm.platform || undefined,
        url: releaseForm.url || undefined,
        releaseDate: releaseForm.releaseDate || undefined,
      };
      if (editingRelease) {
        const updated = await api.put<Release>(`/local-artists/releases/${editingRelease.id}`, payload);
        setArtist((prev) => prev ? { ...prev, releases: prev.releases.map((r) => r.id === updated.id ? updated : r) } : prev);
      } else {
        const created = await api.post<Release>('/local-artists/releases', payload);
        setArtist((prev) => prev ? { ...prev, releases: [...prev.releases, created] } : prev);
      }
      setShowReleaseModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save release');
    } finally {
      setSavingRelease(false);
    }
  };
  const handleDeleteRelease = async (id: string) => {
    try {
      await api.delete(`/local-artists/releases/${id}`);
      setArtist((prev) => prev ? { ...prev, releases: prev.releases.filter((r) => r.id !== id) } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete release');
    }
  };

  // ---- Show CRUD ----
  const openAddShow = () => {
    setEditingShow(null);
    setShowForm({ venueName: '', venueCity: '', eventTitle: '', date: '', role: 'Opener', ticketsSold: '', totalAttendance: '' });
    setShowShowModal(true);
  };
  const openEditShow = (s: Show) => {
    setEditingShow(s);
    setShowForm({
      venueName: s.venueName, venueCity: s.venueCity || '', eventTitle: s.eventTitle || '',
      date: s.date || '', role: s.role || 'Opener',
      ticketsSold: s.ticketsSold?.toString() || '', totalAttendance: s.totalAttendance?.toString() || '',
    });
    setShowShowModal(true);
  };
  const handleSaveShow = async () => {
    setSavingShow(true);
    try {
      const payload = {
        venueName: showForm.venueName,
        venueCity: showForm.venueCity || undefined,
        eventTitle: showForm.eventTitle || undefined,
        date: showForm.date || undefined,
        role: showForm.role || undefined,
        ticketsSold: showForm.ticketsSold ? Number(showForm.ticketsSold) : undefined,
        totalAttendance: showForm.totalAttendance ? Number(showForm.totalAttendance) : undefined,
      };
      if (editingShow) {
        const updated = await api.put<Show>(`/local-artists/shows/${editingShow.id}`, payload);
        setArtist((prev) => prev ? { ...prev, shows: prev.shows.map((s) => s.id === updated.id ? updated : s) } : prev);
      } else {
        const created = await api.post<Show>('/local-artists/shows', payload);
        setArtist((prev) => prev ? { ...prev, shows: [...prev.shows, created] } : prev);
      }
      setShowShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save show');
    } finally {
      setSavingShow(false);
    }
  };
  const handleDeleteShow = async (id: string) => {
    try {
      await api.delete(`/local-artists/shows/${id}`);
      setArtist((prev) => prev ? { ...prev, shows: prev.shows.filter((s) => s.id !== id) } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete show');
    }
  };

  // ---- Booking Requests ----
  const handleBookingRespond = async (id: string, action: 'accept' | 'decline') => {
    try {
      await api.put(`/booking/${id}/respond`, { action });
      setArtist((prev) => prev ? {
        ...prev,
        bookingRequests: prev.bookingRequests.map((b) => b.id === id ? { ...b, status: action === 'accept' ? 'ACCEPTED' : 'DECLINED' } : b),
      } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond');
    }
  };

  // ---- File upload ref for edit modal ----
  const photoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center">
        <div className="text-gray-500">Loading your artist profile...</div>
      </div>
    );
  }

  if (error && !artist) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-gray-400 mb-4">{error || 'No local artist profile found.'}</p>
          <Link to="/local-artists/register" className="text-amber-400 hover:underline">Create your EPK</Link>
        </div>
      </div>
    );
  }

  if (!artist) return null;

  const totalTicketsSold = artist.shows.reduce((sum, s) => sum + (s.ticketsSold || 0), 0);
  const avgPerShow = artist.shows.length > 0 ? Math.round(totalTicketsSold / artist.shows.length) : 0;
  const pendingRequests = artist.bookingRequests.filter((b) => b.status === 'PENDING');

  return (
    <div className="min-h-screen bg-noir-950 py-8">
      <SEO title="Local Artist Dashboard" noindex />
      <div className="max-w-4xl mx-auto px-4">

        {/* Profile header */}
        <div className="bg-noir-900 border border-noir-700/50 rounded-2xl mb-6">
          {/* Banner */}
          <div className="h-40 bg-noir-800 relative rounded-t-2xl overflow-hidden">
            {artist.bannerImageUrl ? (
              <img src={artist.bannerImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-500/10 via-noir-800 to-noir-900" />
            )}
          </div>
          {/* Profile content */}
          <div className="px-6 pb-6">
            <div className="-mt-12 flex flex-col sm:flex-row gap-5">
              <div className="w-24 h-24 rounded-full bg-noir-800 border-4 border-noir-900 flex items-center justify-center text-amber-400 text-3xl font-bold shrink-0 self-center sm:self-start overflow-hidden relative z-10">
                {artist.profileImageUrl ? (
                  <img src={artist.profileImageUrl} alt={artist.stageName} className="w-full h-full rounded-full object-cover" />
                ) : artist.stageName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 pt-2">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl font-display tracking-wider text-warm-50">{artist.stageName}</h1>
                  <VerificationBadge status={artist.verificationStatus} />
                  {artist.availableForBooking && (
                    <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-full text-xs">Available</span>
                  )}
                </div>
                {artist.professionalType && <p className="text-amber-400/70 text-sm mb-1">{artist.professionalType}</p>}
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-2">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {artist.city}, {US_STATES[artist.state] || artist.state}
                  </span>
                  {artist.yearsActive !== null && <span>{artist.yearsActive} yrs active</span>}
                </div>
                {artist.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {artist.genres.map((g) => <span key={g} className="px-2 py-0.5 bg-amber-500/10 text-amber-400/80 rounded text-xs">{g}</span>)}
                  </div>
                )}
              </div>
              <button onClick={openEditModal}
                className="px-5 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 hover:border-amber-500/50 transition-all text-sm font-medium self-start flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit Profile
              </button>
            </div>
            <div className="mt-5 pt-4 border-t border-noir-700/50">
              <StrengthBar strength={artist.profileStrength} />
            </div>
          </div>
        </div>

        {/* Profile completion banner */}
        {artist.profileStrength < 100 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="text-warm-50 text-sm font-medium">Your EPK is {artist.profileStrength}% complete</p>
                <p className="text-gray-500 text-xs">Complete profiles get more visibility and booking requests</p>
              </div>
            </div>
            <button onClick={openEditModal}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors text-sm shrink-0">
              Complete EPK
            </button>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-6 flex items-center justify-between">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={() => setError('')} className="text-red-400/70 hover:text-red-400 text-xs">Dismiss</button>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-warm-50">{artist.shows.length}</p>
            <p className="text-gray-500 text-xs mt-1">Total Shows</p>
          </div>
          <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{totalTicketsSold.toLocaleString()}</p>
            <p className="text-gray-500 text-xs mt-1">Tickets Sold</p>
          </div>
          <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-warm-50">{avgPerShow}</p>
            <p className="text-gray-500 text-xs mt-1">Avg per Show</p>
          </div>
          <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{pendingRequests.length}</p>
            <p className="text-gray-500 text-xs mt-1">Booking Requests</p>
          </div>
        </div>

        {/* Releases section */}
        <div className="bg-noir-900 border border-noir-700/50 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-warm-50 text-lg font-semibold">Releases</h2>
            <button onClick={openAddRelease}
              className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs hover:bg-amber-500/20 transition-colors">
              + Add Release
            </button>
          </div>
          {artist.releases.length === 0 ? (
            <p className="text-gray-600 text-sm py-4 text-center">No releases yet. Add your music to build your EPK.</p>
          ) : (
            <div className="space-y-2">
              {artist.releases.map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-noir-800 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-warm-50 text-sm font-medium truncate">{r.title}</p>
                      <p className="text-gray-500 text-xs">{r.type}{r.releaseDate ? ` - ${r.releaseDate}` : ''}{r.platform ? ` on ${r.platform}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-amber-400 text-xs hover:underline">Listen</a>
                    )}
                    <button onClick={() => openEditRelease(r)} className="text-gray-400 hover:text-warm-50 text-xs">Edit</button>
                    <button onClick={() => handleDeleteRelease(r.id)} className="text-red-400/70 hover:text-red-400 text-xs">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Shows section */}
        <div className="bg-noir-900 border border-noir-700/50 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-warm-50 text-lg font-semibold">Past Shows</h2>
            <button onClick={openAddShow}
              className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs hover:bg-amber-500/20 transition-colors">
              + Add Show
            </button>
          </div>
          {artist.shows.length === 0 ? (
            <p className="text-gray-600 text-sm py-4 text-center">No shows yet. Add your performance history to build credibility.</p>
          ) : (
            <div className="space-y-2">
              {artist.shows.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-noir-800 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-warm-50 text-sm font-medium truncate">{s.venueName}</p>
                      <p className="text-gray-500 text-xs">
                        {s.role && <span className="text-amber-400/70">{s.role}</span>}
                        {s.venueCity && <span> - {s.venueCity}</span>}
                        {s.date && <span> - {s.date}</span>}
                        {s.ticketsSold !== null && <span> - {s.ticketsSold} tickets</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEditShow(s)} className="text-gray-400 hover:text-warm-50 text-xs">Edit</button>
                    <button onClick={() => handleDeleteShow(s.id)} className="text-red-400/70 hover:text-red-400 text-xs">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Booking Requests section */}
        <div className="bg-noir-900 border border-noir-700/50 rounded-2xl p-6 mb-6">
          <h2 className="text-warm-50 text-lg font-semibold mb-4">Booking Requests</h2>
          {artist.bookingRequests.length === 0 ? (
            <p className="text-gray-600 text-sm py-4 text-center">No booking requests yet. Make sure your profile is visible in the marketplace.</p>
          ) : (
            <div className="space-y-3">
              {artist.bookingRequests.map((b) => (
                <div key={b.id} className="bg-noir-800 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-warm-50 text-sm font-medium">{b.requesterName}</p>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          b.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' :
                          b.status === 'ACCEPTED' ? 'bg-green-500/10 text-green-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>{b.status}</span>
                      </div>
                      {b.eventTitle && <p className="text-gray-400 text-xs">{b.eventTitle}{b.eventDate ? ` - ${b.eventDate}` : ''}</p>}
                      {b.message && <p className="text-gray-500 text-sm mt-1">{b.message}</p>}
                      <p className="text-gray-600 text-xs mt-1">{b.requesterEmail} - {new Date(b.createdAt).toLocaleDateString()}</p>
                    </div>
                    {b.status === 'PENDING' && (
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleBookingRespond(b.id, 'accept')}
                          className="px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg text-xs hover:bg-green-500/20 transition-colors">
                          Accept
                        </button>
                        <button onClick={() => handleBookingRespond(b.id, 'decline')}
                          className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-colors">
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ============== EDIT PROFILE MODAL ============== */}
        {editing && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setEditing(false)}>
            <div className="bg-noir-900 border border-noir-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-warm-50 text-lg font-semibold">Edit Profile</h2>
                  <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-warm-50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Photo */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-1.5">Profile Photo</label>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-noir-800 flex items-center justify-center overflow-hidden shrink-0">
                        {editForm.profileImageUrl ? (
                          <img src={editForm.profileImageUrl as string} alt="" className="w-full h-full object-cover" />
                        ) : <span className="text-amber-400 text-lg font-bold">{(editForm.stageName as string)?.charAt(0) || '?'}</span>}
                      </div>
                      <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
                        className="px-3 py-1.5 bg-noir-800 text-gray-300 rounded-lg text-xs hover:bg-noir-700 transition-colors disabled:opacity-50">
                        {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
                      </button>
                      <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'profileImageUrl'); e.target.value = ''; }} />
                    </div>
                  </div>

                  {/* Banner */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-1.5">Banner</label>
                    <div className="h-24 bg-noir-800 rounded-lg overflow-hidden cursor-pointer relative" onClick={() => bannerInputRef.current?.click()}>
                      {editForm.bannerImageUrl ? (
                        <img src={editForm.bannerImageUrl as string} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">Click to upload banner</div>
                      )}
                      {uploadingBanner && <div className="absolute inset-0 bg-noir-800/70 flex items-center justify-center"><div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}
                    </div>
                    <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'bannerImageUrl'); e.target.value = ''; }} />
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-1.5">Stage Name</label>
                    <input type="text" value={editForm.stageName as string || ''}
                      onChange={(e) => setEditForm((p) => ({ ...p, stageName: e.target.value }))}
                      className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-1.5">Bio</label>
                    <textarea value={editForm.bio as string || ''}
                      onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                      rows={3}
                      className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50 resize-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1.5">Type</label>
                      <select value={editForm.professionalType as string || ''}
                        onChange={(e) => setEditForm((p) => ({ ...p, professionalType: e.target.value }))}
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50">
                        <option value="">Select</option>
                        {PROFESSIONAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1.5">Years Active</label>
                      <input type="number" value={editForm.yearsActive as string || ''}
                        onChange={(e) => setEditForm((p) => ({ ...p, yearsActive: e.target.value }))}
                        min="0" max="60"
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
                    </div>
                  </div>

                  {/* Genres */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-1.5">Genres</label>
                    <div className="flex flex-wrap gap-1.5">
                      {GENRE_OPTIONS.map((g) => (
                        <button key={g} type="button" onClick={() => togglePill('genres', g)}
                          className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                            (editForm.genres as string[] || []).includes(g) ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-noir-800 text-gray-500 hover:text-gray-300'
                          }`}>{g}</button>
                      ))}
                    </div>
                  </div>

                  {/* Instruments */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-1.5">Instruments</label>
                    <div className="flex flex-wrap gap-1.5">
                      {INSTRUMENT_OPTIONS.map((i) => (
                        <button key={i} type="button" onClick={() => togglePill('instruments', i)}
                          className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                            (editForm.instruments as string[] || []).includes(i) ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-noir-800 text-gray-500 hover:text-gray-300'
                          }`}>{i}</button>
                      ))}
                    </div>
                  </div>

                  {/* Booking */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1.5">Booking Email</label>
                      <input type="email" value={editForm.bookingEmail as string || ''}
                        onChange={(e) => setEditForm((p) => ({ ...p, bookingEmail: e.target.value }))}
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1.5">Booking Rate</label>
                      <input type="text" value={editForm.bookingRate as string || ''}
                        onChange={(e) => setEditForm((p) => ({ ...p, bookingRate: e.target.value }))}
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button type="button"
                      onClick={() => setEditForm((p) => ({ ...p, availableForBooking: !p.availableForBooking }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${editForm.availableForBooking ? 'bg-green-500' : 'bg-noir-600'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${editForm.availableForBooking ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-gray-400 text-sm">Available for booking</span>
                  </div>

                  {/* Social links */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-1.5">Social Links</label>
                    <div className="space-y-2">
                      {(['instagram', 'twitter', 'tiktok', 'spotify', 'soundcloud', 'youtube', 'website'] as const).map((key) => (
                        <input key={key} type="text"
                          value={((editForm.socialLinks as Record<string, string>) || {})[key] || ''}
                          onChange={(e) => setEditForm((p) => ({ ...p, socialLinks: { ...((p.socialLinks as Record<string, string>) || {}), [key]: e.target.value } }))}
                          placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                          className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setEditing(false)}
                    className="flex-1 px-4 py-2.5 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors">Cancel</button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============== RELEASE MODAL ============== */}
        {showReleaseModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowReleaseModal(false)}>
            <div className="bg-noir-900 border border-noir-700 rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <h2 className="text-warm-50 text-lg font-semibold mb-4">{editingRelease ? 'Edit Release' : 'Add Release'}</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Title *</label>
                    <input type="text" value={releaseForm.title}
                      onChange={(e) => setReleaseForm((p) => ({ ...p, title: e.target.value }))}
                      className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Type</label>
                      <select value={releaseForm.type}
                        onChange={(e) => setReleaseForm((p) => ({ ...p, type: e.target.value }))}
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50">
                        {RELEASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Platform</label>
                      <input type="text" value={releaseForm.platform}
                        onChange={(e) => setReleaseForm((p) => ({ ...p, platform: e.target.value }))}
                        placeholder="Spotify, SoundCloud..."
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">URL</label>
                    <input type="url" value={releaseForm.url}
                      onChange={(e) => setReleaseForm((p) => ({ ...p, url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Release Date</label>
                    <input type="date" value={releaseForm.releaseDate}
                      onChange={(e) => setReleaseForm((p) => ({ ...p, releaseDate: e.target.value }))}
                      className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowReleaseModal(false)}
                    className="flex-1 px-4 py-2.5 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors">Cancel</button>
                  <button onClick={handleSaveRelease} disabled={savingRelease || !releaseForm.title}
                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {savingRelease ? 'Saving...' : editingRelease ? 'Update' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============== SHOW MODAL ============== */}
        {showShowModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowShowModal(false)}>
            <div className="bg-noir-900 border border-noir-700 rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <h2 className="text-warm-50 text-lg font-semibold mb-4">{editingShow ? 'Edit Show' : 'Add Show'}</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Venue Name *</label>
                    <input type="text" value={showForm.venueName}
                      onChange={(e) => setShowForm((p) => ({ ...p, venueName: e.target.value }))}
                      className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">City</label>
                      <input type="text" value={showForm.venueCity}
                        onChange={(e) => setShowForm((p) => ({ ...p, venueCity: e.target.value }))}
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Event Title</label>
                      <input type="text" value={showForm.eventTitle}
                        onChange={(e) => setShowForm((p) => ({ ...p, eventTitle: e.target.value }))}
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Date</label>
                      <input type="date" value={showForm.date}
                        onChange={(e) => setShowForm((p) => ({ ...p, date: e.target.value }))}
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Role</label>
                      <select value={showForm.role}
                        onChange={(e) => setShowForm((p) => ({ ...p, role: e.target.value }))}
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50">
                        {SHOW_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Tickets Sold</label>
                      <input type="number" value={showForm.ticketsSold}
                        onChange={(e) => setShowForm((p) => ({ ...p, ticketsSold: e.target.value }))}
                        min="0"
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Total Attendance</label>
                      <input type="number" value={showForm.totalAttendance}
                        onChange={(e) => setShowForm((p) => ({ ...p, totalAttendance: e.target.value }))}
                        min="0"
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowShowModal(false)}
                    className="flex-1 px-4 py-2.5 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors">Cancel</button>
                  <button onClick={handleSaveShow} disabled={savingShow || !showForm.venueName}
                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {savingShow ? 'Saving...' : editingShow ? 'Update' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
