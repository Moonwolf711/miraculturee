import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
];

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

const STEPS = ['Basic Info', 'Music & Releases', 'Past Shows', 'Socials & Booking', 'Review'];

const DRAFT_KEY = 'miraculturee_epk_draft';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReleaseEntry {
  id: string;
  title: string;
  type: string;
  platform: string;
  url: string;
  releaseDate: string;
}

interface ShowEntry {
  id: string;
  venueName: string;
  venueCity: string;
  eventTitle: string;
  date: string;
  role: string;
  ticketsSold: string;
  totalAttendance: string;
}

interface FormData {
  stageName: string;
  city: string;
  state: string;
  professionalType: string;
  bio: string;
  yearsActive: string;
  profileImageUrl: string;
  bannerImageUrl: string;
  genres: string[];
  instruments: string[];
  releases: ReleaseEntry[];
  shows: ShowEntry[];
  instagram: string;
  twitter: string;
  tiktok: string;
  spotify: string;
  soundcloud: string;
  youtube: string;
  website: string;
  instagramFollowers: string;
  tiktokFollowers: string;
  spotifyFollowers: string;
  soundcloudFollowers: string;
  bookingEmail: string;
  bookingRate: string;
  availableForBooking: boolean;
  externalEpkUrl: string;
}

interface FieldErrors {
  stageName?: string;
  city?: string;
  state?: string;
}

const INITIAL_FORM: FormData = {
  stageName: '', city: '', state: '', professionalType: '', bio: '', yearsActive: '',
  profileImageUrl: '', bannerImageUrl: '', genres: [], instruments: [], releases: [], shows: [],
  instagram: '', twitter: '', tiktok: '', spotify: '', soundcloud: '', youtube: '', website: '',
  instagramFollowers: '', tiktokFollowers: '', spotifyFollowers: '', soundcloudFollowers: '',
  bookingEmail: '', bookingRate: '', availableForBooking: true, externalEpkUrl: '',
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Drag-and-drop image upload zone */
function ImageDropZone({
  label, value, onUpload, onClear, aspect, maxSizeMb = 2,
}: {
  label: string; value: string;
  onUpload: (file: File) => Promise<void>; onClear: () => void;
  aspect: 'square' | 'banner'; maxSizeMb?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploadError('');
    if (file.size > maxSizeMb * 1024 * 1024) { setUploadError(`File must be under ${maxSizeMb}MB`); return; }
    if (!file.type.startsWith('image/')) { setUploadError('File must be an image'); return; }
    setUploading(true);
    try { await onUpload(file); } catch { setUploadError('Upload failed. Try again.'); } finally { setUploading(false); }
  };

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files?.[0]; if (file) handleFile(file); };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const dimensionClasses = aspect === 'banner' ? 'w-full h-32 sm:h-40 rounded-xl' : 'w-24 h-24 sm:w-28 sm:h-28 rounded-full';
  const previewClasses = aspect === 'banner' ? 'w-full h-full rounded-xl object-cover' : 'w-full h-full rounded-full object-cover';

  return (
    <div>
      <label className="block text-gray-400 text-sm mb-1.5">{label}</label>
      <div
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`${dimensionClasses} border-2 border-dashed cursor-pointer flex items-center justify-center overflow-hidden transition-colors ${
          dragging ? 'border-amber-500 bg-amber-500/5' : value ? 'border-transparent' : 'border-noir-600 hover:border-amber-500/30 bg-noir-800'
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-1">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 text-xs">Uploading...</span>
          </div>
        ) : value ? (
          <img src={value} alt={label} className={previewClasses} />
        ) : (
          <div className="flex flex-col items-center gap-1 px-4 text-center">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-gray-500 text-xs">Drop image or click to upload</span>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); e.target.value = ''; }} />
      </div>
      {uploadError && <p className="text-red-400 text-xs mt-1">{uploadError}</p>}
      {value && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="text-red-400/70 hover:text-red-400 text-xs mt-1">Remove</button>
      )}
      <p className="text-gray-600 text-xs mt-1">JPEG, PNG, WebP or GIF. Max {maxSizeMb}MB.</p>
    </div>
  );
}

/** Searchable multi-select dropdown */
function SearchableMultiSelect({
  label, options, selected, onChange, max, placeholder = 'Search...',
}: {
  label: string; options: string[]; selected: string[];
  onChange: (vals: string[]) => void; max: number; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()) && !selected.includes(o));

  const toggle = (val: string) => {
    if (selected.includes(val)) { onChange(selected.filter((v) => v !== val)); }
    else if (selected.length < max) { onChange([...selected, val]); setSearch(''); }
  };

  return (
    <div ref={ref} className="relative">
      <label className="block text-gray-400 text-sm mb-1.5">
        {label} <span className="text-gray-600 text-xs">(up to {max})</span>
      </label>
      <div className="min-h-[44px] sm:min-h-[40px] bg-noir-800 border border-noir-600 rounded-lg px-3 py-2 flex flex-wrap gap-1.5 cursor-text" onClick={() => setOpen(true)}>
        {selected.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
            {s}
            <button type="button" onClick={(e) => { e.stopPropagation(); toggle(s); }} className="hover:text-amber-200 ml-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </span>
        ))}
        <input type="text" value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : selected.length >= max ? 'Max reached' : ''}
          disabled={selected.length >= max}
          className="flex-1 min-w-[80px] bg-transparent text-warm-50 text-sm focus:outline-none placeholder:text-gray-600 disabled:placeholder:text-gray-700" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-noir-800 border border-noir-600 rounded-lg shadow-xl">
          {filtered.map((o) => (
            <button key={o} type="button" onClick={() => toggle(o)}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-noir-700 hover:text-warm-50 transition-colors">{o}</button>
          ))}
        </div>
      )}
      <p className="text-gray-600 text-xs mt-1">{selected.length}/{max} selected</p>
    </div>
  );
}

/** Profile strength bar */
function StrengthBar({ strength }: { strength: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-500">Profile Strength</span>
        <span className={strength >= 80 ? 'text-green-400' : strength >= 50 ? 'text-amber-400' : 'text-gray-500'}>{strength}%</span>
      </div>
      <div className="h-1.5 bg-noir-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${strength >= 80 ? 'bg-green-500' : strength >= 50 ? 'bg-amber-500' : 'bg-gray-600'}`}
          style={{ width: `${strength}%` }}
        />
      </div>
    </div>
  );
}

/** Preview card for the review step */
function PreviewCard({ form, strength }: { form: FormData; strength: number }) {
  return (
    <div className="bg-noir-900 border border-noir-700 rounded-xl overflow-hidden">
      <div className="h-24 bg-gradient-to-r from-noir-800 to-noir-700 overflow-hidden">
        {form.bannerImageUrl && <img src={form.bannerImageUrl} alt="Banner" className="w-full h-full object-cover" />}
      </div>
      <div className="px-4 pb-4 -mt-8">
        <div className="w-16 h-16 rounded-full border-2 border-noir-900 bg-noir-700 flex items-center justify-center text-amber-400 text-xl font-bold overflow-hidden mb-2">
          {form.profileImageUrl ? (
            <img src={form.profileImageUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (form.stageName.charAt(0).toUpperCase() || '?')}
        </div>
        <p className="text-warm-50 font-semibold truncate">{form.stageName || 'Your Stage Name'}</p>
        {form.professionalType && <p className="text-amber-400/70 text-xs mt-0.5">{form.professionalType}</p>}
        {(form.city || form.state) && (
          <p className="text-gray-500 text-xs mt-0.5">{[form.city, form.state].filter(Boolean).join(', ')}</p>
        )}
        {form.bio && <p className="text-gray-400 text-sm mt-2 line-clamp-3">{form.bio}</p>}
        {form.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {form.genres.slice(0, 6).map((g) => (
              <span key={g} className="px-2 py-0.5 bg-noir-800 text-gray-300 rounded-full text-xs">{g}</span>
            ))}
            {form.genres.length > 6 && <span className="px-2 py-0.5 bg-noir-800 text-gray-500 rounded-full text-xs">+{form.genres.length - 6}</span>}
          </div>
        )}
        {form.instruments.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {form.instruments.map((i) => (
              <span key={i} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-xs">{i}</span>
            ))}
          </div>
        )}
        {form.releases.length > 0 && (
          <div className="mt-3 text-xs text-gray-500">{form.releases.length} release{form.releases.length !== 1 ? 's' : ''}</div>
        )}
        {form.shows.length > 0 && (
          <div className="text-xs text-gray-500">{form.shows.length} show{form.shows.length !== 1 ? 's' : ''}</div>
        )}
        <div className="mt-3 pt-3 border-t border-noir-700">
          <StrengthBar strength={strength} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function LocalArtistRegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) return { ...INITIAL_FORM, ...JSON.parse(saved) };
    } catch { /* ignore corrupt data */ }
    return { ...INITIAL_FORM };
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [checking, setChecking] = useState(true);
  const [draftSaved, setDraftSaved] = useState(false);

  // ---- Auto-save draft (debounced 500ms) ----
  const debouncedForm = useDebounce(form, 500);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(debouncedForm));
      setDraftSaved(true);
      const id = setTimeout(() => setDraftSaved(false), 2000);
      return () => clearTimeout(id);
    } catch { /* storage full */ }
  }, [debouncedForm]);

  // ---- Check existing profile ----
  useEffect(() => {
    if (!user) { setChecking(false); return; }
    api.get<{ id: string }>('/local-artists/profile/me')
      .then(() => {
        setHasProfile(true);
        navigate('/local-artists/dashboard', { replace: true });
      })
      .catch(() => setHasProfile(false))
      .finally(() => setChecking(false));
  }, [user, navigate]);

  // ---- Helpers ----
  const set = useCallback((key: keyof FormData, val: unknown) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (key in ({} as FieldErrors)) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }, []);

  const canAdvance = (): boolean => {
    if (step === 0) return form.stageName.trim().length > 0 && form.city.trim().length > 0 && form.state !== '';
    return true;
  };

  const calcStrength = useMemo((): number => {
    const checks: [boolean, number][] = [
      [!!form.stageName, 10], [!!form.profileImageUrl, 10], [!!form.bannerImageUrl, 5],
      [!!form.bio, 10], [!!form.city, 5], [!!form.state, 5],
      [!!form.professionalType, 5], [!!form.yearsActive, 5],
      [form.genres.length > 0, 5], [form.instruments.length > 0, 5],
      [form.releases.length > 0, 10], [form.shows.length > 0, 10],
      [!!(form.instagram || form.twitter || form.tiktok || form.spotify || form.soundcloud || form.youtube || form.website), 10],
      [!!form.bookingEmail, 5],
    ];
    return checks.reduce((s, [ok, w]) => s + (ok ? w : 0), 0);
  }, [form]);

  // ---- Image upload ----
  const handleImageUpload = useCallback(async (file: File, field: 'profileImageUrl' | 'bannerImageUrl') => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/upload/profile-image`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    const { url } = await res.json();
    set(field, url);
  }, [set]);

  // ---- Release management ----
  const addRelease = () => {
    set('releases', [...form.releases, { id: genId(), title: '', type: 'Single', platform: '', url: '', releaseDate: '' }]);
  };
  const updateRelease = (id: string, field: keyof ReleaseEntry, val: string) => {
    set('releases', form.releases.map((r) => r.id === id ? { ...r, [field]: val } : r));
  };
  const removeRelease = (id: string) => {
    set('releases', form.releases.filter((r) => r.id !== id));
  };

  // ---- Show management ----
  const addShow = () => {
    set('shows', [...form.shows, { id: genId(), venueName: '', venueCity: '', eventTitle: '', date: '', role: 'Opener', ticketsSold: '', totalAttendance: '' }]);
  };
  const updateShow = (id: string, field: keyof ShowEntry, val: string) => {
    set('shows', form.shows.map((s) => s.id === id ? { ...s, [field]: val } : s));
  };
  const removeShow = (id: string) => {
    set('shows', form.shows.filter((s) => s.id !== id));
  };

  // ---- Submit ----
  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        stageName: form.stageName,
        city: form.city,
        state: form.state,
        professionalType: form.professionalType || undefined,
        bio: form.bio || undefined,
        yearsActive: form.yearsActive ? Number(form.yearsActive) : undefined,
        profileImageUrl: form.profileImageUrl || undefined,
        bannerImageUrl: form.bannerImageUrl || undefined,
        genres: form.genres.length > 0 ? form.genres : undefined,
        instruments: form.instruments.length > 0 ? form.instruments : undefined,
        socialLinks: {
          instagram: form.instagram || undefined,
          twitter: form.twitter || undefined,
          tiktok: form.tiktok || undefined,
          spotify: form.spotify || undefined,
          soundcloud: form.soundcloud || undefined,
          youtube: form.youtube || undefined,
          website: form.website || undefined,
        },
        followerCounts: {
          instagram: form.instagramFollowers ? Number(form.instagramFollowers) : undefined,
          tiktok: form.tiktokFollowers ? Number(form.tiktokFollowers) : undefined,
          spotify: form.spotifyFollowers ? Number(form.spotifyFollowers) : undefined,
          soundcloud: form.soundcloudFollowers ? Number(form.soundcloudFollowers) : undefined,
        },
        bookingEmail: form.bookingEmail || undefined,
        bookingRate: form.bookingRate || undefined,
        availableForBooking: form.availableForBooking,
        externalEpkUrl: form.externalEpkUrl || undefined,
      };

      const profile = await api.post<{ id: string }>('/local-artists/profile', payload);

      // Create releases
      for (const r of form.releases) {
        if (!r.title) continue;
        await api.post('/local-artists/releases', {
          localArtistId: profile.id,
          title: r.title,
          type: r.type,
          platform: r.platform || undefined,
          url: r.url || undefined,
          releaseDate: r.releaseDate || undefined,
        });
      }

      // Create shows
      for (const s of form.shows) {
        if (!s.venueName) continue;
        await api.post('/local-artists/shows', {
          localArtistId: profile.id,
          venueName: s.venueName,
          venueCity: s.venueCity || undefined,
          eventTitle: s.eventTitle || undefined,
          date: s.date || undefined,
          role: s.role || undefined,
          ticketsSold: s.ticketsSold ? Number(s.ticketsSold) : undefined,
          totalAttendance: s.totalAttendance ? Number(s.totalAttendance) : undefined,
        });
      }

      localStorage.removeItem(DRAFT_KEY);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Guards ----
  if (!user) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">You must be logged in to create an artist EPK.</p>
          <a href="/login" className="text-amber-400 hover:underline">Log in</a>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4">
        <SEO title="EPK Created" noindex />
        <div className="max-w-md w-full bg-noir-900 border border-noir-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-warm-50 text-xl font-semibold mb-2">EPK Created!</h2>
          <p className="text-gray-400 mb-6">
            Your electronic press kit is live. You can manage your releases, shows, and booking info from your dashboard.
          </p>
          <button onClick={() => navigate('/local-artists/dashboard')}
            className="w-full px-6 py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ---- Show stats ----
  const totalShows = form.shows.length;
  const totalTicketsSold = form.shows.reduce((sum, s) => sum + (Number(s.ticketsSold) || 0), 0);

  // ---- Render ----
  return (
    <div className="min-h-screen bg-noir-950 py-8">
      <SEO title="Create Local Artist EPK" description="Build your electronic press kit on MiraCulture." noindex />
      <div className="max-w-5xl mx-auto px-4">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display tracking-wider text-warm-50 mb-2">CREATE YOUR EPK</h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Build your electronic press kit to get discovered by promoters, venues, and fans in your local scene.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <button onClick={() => { if (i < step) setStep(i); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  i === step ? 'bg-amber-500 text-noir-950' : i < step ? 'bg-amber-500/20 text-amber-400 cursor-pointer hover:bg-amber-500/30' : 'bg-noir-800 text-gray-600'
                }`}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-current">
                  {i < step ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  ) : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < STEPS.length - 1 && <div className={`w-6 h-px mx-1 ${i < step ? 'bg-amber-500/40' : 'bg-noir-700'}`} />}
            </div>
          ))}
        </div>

        {/* Draft saved indicator */}
        {draftSaved && (
          <div className="text-center mb-4">
            <span className="text-green-400/60 text-xs">Draft saved</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form */}
          <div className="lg:col-span-2">
            <div className="bg-noir-900 border border-noir-700/50 rounded-2xl p-6">

              {/* Step 0: Basic Info */}
              {step === 0 && (
                <div className="space-y-5">
                  <h2 className="text-warm-50 text-lg font-semibold mb-4">Basic Info</h2>

                  <div>
                    <label className="block text-gray-400 text-sm mb-1.5">Stage Name *</label>
                    <input type="text" value={form.stageName}
                      onChange={(e) => set('stageName', e.target.value)}
                      onBlur={() => { if (!form.stageName.trim()) setFieldErrors((p) => ({ ...p, stageName: 'Stage name is required' })); else setFieldErrors((p) => ({ ...p, stageName: undefined })); }}
                      placeholder="Your stage name or band name"
                      className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                    {fieldErrors.stageName && <p className="text-red-400 text-xs mt-1">{fieldErrors.stageName}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1.5">City *</label>
                      <input type="text" value={form.city}
                        onChange={(e) => set('city', e.target.value)}
                        onBlur={() => { if (!form.city.trim()) setFieldErrors((p) => ({ ...p, city: 'City is required' })); else setFieldErrors((p) => ({ ...p, city: undefined })); }}
                        placeholder="Your city"
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                      {fieldErrors.city && <p className="text-red-400 text-xs mt-1">{fieldErrors.city}</p>}
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1.5">State *</label>
                      <select value={form.state} onChange={(e) => set('state', e.target.value)}
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50">
                        <option value="">Select state</option>
                        {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {fieldErrors.state && <p className="text-red-400 text-xs mt-1">{fieldErrors.state}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-1.5">Professional Type</label>
                    <select value={form.professionalType} onChange={(e) => set('professionalType', e.target.value)}
                      className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50">
                      <option value="">Select type</option>
                      {PROFESSIONAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-1.5">Bio <span className="text-gray-600">({form.bio.length}/1000)</span></label>
                    <textarea value={form.bio}
                      onChange={(e) => { if (e.target.value.length <= 1000) set('bio', e.target.value); }}
                      rows={4} placeholder="Tell promoters and fans about yourself..."
                      className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600 resize-none" />
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-1.5">Years Active</label>
                    <input type="number" value={form.yearsActive}
                      onChange={(e) => set('yearsActive', e.target.value)}
                      min="0" max="60" placeholder="e.g. 5"
                      className="w-32 bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2.5 focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <ImageDropZone label="Profile Image" value={form.profileImageUrl}
                      onUpload={(f) => handleImageUpload(f, 'profileImageUrl')}
                      onClear={() => set('profileImageUrl', '')} aspect="square" />
                    <ImageDropZone label="Banner Image" value={form.bannerImageUrl}
                      onUpload={(f) => handleImageUpload(f, 'bannerImageUrl')}
                      onClear={() => set('bannerImageUrl', '')} aspect="banner" />
                  </div>
                </div>
              )}

              {/* Step 1: Music & Releases */}
              {step === 1 && (
                <div className="space-y-5">
                  <h2 className="text-warm-50 text-lg font-semibold mb-4">Music & Releases</h2>

                  <SearchableMultiSelect label="Genres" options={GENRE_OPTIONS} selected={form.genres}
                    onChange={(v) => set('genres', v)} max={8} placeholder="Search genres..." />

                  <SearchableMultiSelect label="Instruments / Tools" options={INSTRUMENT_OPTIONS} selected={form.instruments}
                    onChange={(v) => set('instruments', v)} max={6} placeholder="Search instruments..." />

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-gray-400 text-sm">Releases</label>
                      <button type="button" onClick={addRelease}
                        className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs hover:bg-amber-500/20 transition-colors">
                        + Add Release
                      </button>
                    </div>
                    {form.releases.length === 0 && (
                      <p className="text-gray-600 text-sm py-4 text-center">No releases added yet. Click &quot;Add Release&quot; to get started.</p>
                    )}
                    <div className="space-y-3">
                      {form.releases.map((r) => (
                        <div key={r.id} className="bg-noir-800 border border-noir-600 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <input type="text" value={r.title} onChange={(e) => updateRelease(r.id, 'title', e.target.value)}
                              placeholder="Release title" className="flex-1 bg-noir-700 border border-noir-600 text-warm-50 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                            <button type="button" onClick={() => removeRelease(r.id)} className="text-red-400/70 hover:text-red-400 text-xs shrink-0 pt-2">Remove</button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <select value={r.type} onChange={(e) => updateRelease(r.id, 'type', e.target.value)}
                              className="bg-noir-700 border border-noir-600 text-warm-50 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500/50">
                              {RELEASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input type="text" value={r.platform} onChange={(e) => updateRelease(r.id, 'platform', e.target.value)}
                              placeholder="Platform" className="bg-noir-700 border border-noir-600 text-warm-50 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                            <input type="url" value={r.url} onChange={(e) => updateRelease(r.id, 'url', e.target.value)}
                              placeholder="Link URL" className="bg-noir-700 border border-noir-600 text-warm-50 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                            <input type="date" value={r.releaseDate} onChange={(e) => updateRelease(r.id, 'releaseDate', e.target.value)}
                              className="bg-noir-700 border border-noir-600 text-warm-50 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500/50" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Past Shows */}
              {step === 2 && (
                <div className="space-y-5">
                  <h2 className="text-warm-50 text-lg font-semibold mb-4">Past Shows</h2>

                  {/* Running stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-noir-800 border border-noir-600 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-warm-50">{totalShows}</p>
                      <p className="text-gray-500 text-xs">Total Shows</p>
                    </div>
                    <div className="bg-noir-800 border border-noir-600 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-amber-400">{totalTicketsSold.toLocaleString()}</p>
                      <p className="text-gray-500 text-xs">Tickets Sold</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <label className="text-gray-400 text-sm">Shows</label>
                    <button type="button" onClick={addShow}
                      className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs hover:bg-amber-500/20 transition-colors">
                      + Add Show
                    </button>
                  </div>
                  {form.shows.length === 0 && (
                    <p className="text-gray-600 text-sm py-4 text-center">No shows added yet. Click &quot;Add Show&quot; to get started.</p>
                  )}
                  <div className="space-y-3">
                    {form.shows.map((s) => (
                      <div key={s.id} className="bg-noir-800 border border-noir-600 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <input type="text" value={s.venueName} onChange={(e) => updateShow(s.id, 'venueName', e.target.value)}
                            placeholder="Venue name *" className="flex-1 bg-noir-700 border border-noir-600 text-warm-50 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                          <button type="button" onClick={() => removeShow(s.id)} className="text-red-400/70 hover:text-red-400 text-xs shrink-0 pt-2">Remove</button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                          <input type="text" value={s.venueCity} onChange={(e) => updateShow(s.id, 'venueCity', e.target.value)}
                            placeholder="City" className="bg-noir-700 border border-noir-600 text-warm-50 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                          <input type="text" value={s.eventTitle} onChange={(e) => updateShow(s.id, 'eventTitle', e.target.value)}
                            placeholder="Event title" className="bg-noir-700 border border-noir-600 text-warm-50 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                          <input type="date" value={s.date} onChange={(e) => updateShow(s.id, 'date', e.target.value)}
                            className="bg-noir-700 border border-noir-600 text-warm-50 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500/50" />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <select value={s.role} onChange={(e) => updateShow(s.id, 'role', e.target.value)}
                            className="bg-noir-700 border border-noir-600 text-warm-50 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500/50">
                            {SHOW_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <input type="number" value={s.ticketsSold} onChange={(e) => updateShow(s.id, 'ticketsSold', e.target.value)}
                            placeholder="Tickets sold" min="0" className="bg-noir-700 border border-noir-600 text-warm-50 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                          <input type="number" value={s.totalAttendance} onChange={(e) => updateShow(s.id, 'totalAttendance', e.target.value)}
                            placeholder="Total attendance" min="0" className="bg-noir-700 border border-noir-600 text-warm-50 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Socials & Booking */}
              {step === 3 && (
                <div className="space-y-5">
                  <h2 className="text-warm-50 text-lg font-semibold mb-4">Socials & Booking</h2>

                  <div className="space-y-3">
                    <h3 className="text-gray-300 text-sm font-medium">Social Links</h3>
                    {([
                      ['instagram', 'Instagram', 'instagram.com/'],
                      ['twitter', 'Twitter / X', 'x.com/'],
                      ['tiktok', 'TikTok', 'tiktok.com/@'],
                      ['spotify', 'Spotify', 'open.spotify.com/artist/...'],
                      ['soundcloud', 'SoundCloud', 'soundcloud.com/'],
                      ['youtube', 'YouTube', 'youtube.com/@'],
                      ['website', 'Website', 'https://yoursite.com'],
                    ] as const).map(([key, label, placeholder]) => (
                      <div key={key}>
                        <label className="block text-gray-400 text-xs mb-1">{label}</label>
                        <input type="text" value={form[key]}
                          onChange={(e) => set(key, e.target.value)}
                          placeholder={placeholder}
                          className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-noir-700">
                    <h3 className="text-gray-300 text-sm font-medium">Follower Counts</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        ['instagramFollowers', 'Instagram'],
                        ['tiktokFollowers', 'TikTok'],
                        ['spotifyFollowers', 'Spotify'],
                        ['soundcloudFollowers', 'SoundCloud'],
                      ] as const).map(([key, label]) => (
                        <div key={key}>
                          <label className="block text-gray-400 text-xs mb-1">{label}</label>
                          <input type="number" value={form[key]}
                            onChange={(e) => set(key, e.target.value)}
                            min="0" placeholder="0"
                            className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-noir-700">
                    <h3 className="text-gray-300 text-sm font-medium">Booking Info</h3>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Booking Email</label>
                      <input type="email" value={form.bookingEmail}
                        onChange={(e) => set('bookingEmail', e.target.value)}
                        placeholder="booking@example.com"
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Booking Rate</label>
                      <input type="text" value={form.bookingRate}
                        onChange={(e) => set('bookingRate', e.target.value)}
                        placeholder="e.g. $200-$500 per show"
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button"
                        onClick={() => set('availableForBooking', !form.availableForBooking)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${form.availableForBooking ? 'bg-green-500' : 'bg-noir-600'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${form.availableForBooking ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-gray-400 text-sm">Available for booking</span>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">External EPK URL</label>
                      <input type="url" value={form.externalEpkUrl}
                        onChange={(e) => set('externalEpkUrl', e.target.value)}
                        placeholder="https://your-epk-site.com"
                        className="w-full bg-noir-800 border border-noir-600 text-warm-50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600" />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {step === 4 && (
                <div className="space-y-5">
                  <h2 className="text-warm-50 text-lg font-semibold mb-4">Review Your EPK</h2>

                  {/* Summary sections */}
                  <div className="space-y-4">
                    <div className="bg-noir-800 rounded-lg p-4">
                      <h3 className="text-gray-300 text-sm font-medium mb-2">Basic Info</h3>
                      <div className="text-sm space-y-1">
                        <p className="text-warm-50">{form.stageName}</p>
                        <p className="text-gray-400">{form.city}, {form.state}</p>
                        {form.professionalType && <p className="text-amber-400/70">{form.professionalType}</p>}
                        {form.bio && <p className="text-gray-400 mt-2">{form.bio}</p>}
                      </div>
                    </div>

                    {(form.genres.length > 0 || form.instruments.length > 0) && (
                      <div className="bg-noir-800 rounded-lg p-4">
                        <h3 className="text-gray-300 text-sm font-medium mb-2">Music</h3>
                        {form.genres.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {form.genres.map((g) => <span key={g} className="px-2 py-0.5 bg-amber-500/10 text-amber-400/80 rounded text-xs">{g}</span>)}
                          </div>
                        )}
                        {form.instruments.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {form.instruments.map((i) => <span key={i} className="px-2 py-0.5 bg-noir-700 text-gray-300 rounded text-xs">{i}</span>)}
                          </div>
                        )}
                      </div>
                    )}

                    {form.releases.length > 0 && (
                      <div className="bg-noir-800 rounded-lg p-4">
                        <h3 className="text-gray-300 text-sm font-medium mb-2">Releases ({form.releases.length})</h3>
                        <div className="space-y-1">
                          {form.releases.map((r) => (
                            <div key={r.id} className="flex items-center gap-2 text-sm">
                              <span className="text-warm-50">{r.title || 'Untitled'}</span>
                              <span className="text-gray-600">{r.type}</span>
                              {r.releaseDate && <span className="text-gray-600">{r.releaseDate}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {form.shows.length > 0 && (
                      <div className="bg-noir-800 rounded-lg p-4">
                        <h3 className="text-gray-300 text-sm font-medium mb-2">Shows ({form.shows.length}) - {totalTicketsSold.toLocaleString()} tickets sold</h3>
                        <div className="space-y-1">
                          {form.shows.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 text-sm">
                              <span className="text-warm-50">{s.venueName || 'Unknown venue'}</span>
                              {s.venueCity && <span className="text-gray-600">{s.venueCity}</span>}
                              <span className="text-amber-400/70 text-xs">{s.role}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-noir-800 rounded-lg p-4">
                      <h3 className="text-gray-300 text-sm font-medium mb-2">Booking</h3>
                      <div className="text-sm space-y-1">
                        <p className="text-gray-400">Status: {form.availableForBooking ? <span className="text-green-400">Available</span> : <span className="text-gray-500">Not available</span>}</p>
                        {form.bookingEmail && <p className="text-gray-400">{form.bookingEmail}</p>}
                        {form.bookingRate && <p className="text-gray-400">{form.bookingRate}</p>}
                      </div>
                    </div>
                  </div>

                  <StrengthBar strength={calcStrength} />

                  {error && <p className="text-red-400 text-sm">{error}</p>}

                  <button onClick={handleSubmit} disabled={submitting}
                    className="w-full px-6 py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {submitting ? 'Creating EPK...' : 'Create EPK'}
                  </button>
                </div>
              )}

              {/* Navigation */}
              {step < 4 && (
                <div className="flex items-center justify-between mt-8 pt-5 border-t border-noir-700/50">
                  <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
                    className="px-5 py-2.5 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm">
                    Back
                  </button>
                  <button onClick={() => setStep(step + 1)} disabled={!canAdvance()}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                    {step === 3 ? 'Review' : 'Next'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Preview sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-8">
              <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider">Preview</p>
              <PreviewCard form={form} strength={calcStrength} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
