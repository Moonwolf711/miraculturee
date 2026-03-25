import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../lib/api.js';

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

const SKILL_OPTIONS = [
  'Social Media Marketing', 'Flyering', 'Venue Relations', 'Ticket Sales',
  'Event Planning', 'Photography', 'Videography', 'Graphic Design',
  'Community Outreach', 'Press Relations', 'Radio Promotion', 'Street Marketing',
  'Influencer Networking', 'Brand Partnerships', 'Data Analytics',
];

const PROFESSIONAL_BACKGROUND_OPTIONS = [
  'DJ/Producer', 'Instrumentalist/Vocalist', 'Band/Label', 'Club Promoter',
  'Festival Promoter', 'Concert Promoter', 'Street Team', 'Tour Manager',
  'Venue Booker', 'Event Coordinator', 'Independent Promoter',
];

const STEPS = ['Personal', 'Professional', 'Location', 'Socials', 'Subscribe'];

const DRAFT_KEY = 'miraculturee_agent_draft';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  displayName: string;
  headline: string;
  bio: string;
  age: string;
  profileImageUrl: string;
  bannerImageUrl: string;
  professionalBackground: string[];
  yearsExperience: string;
  genres: string[];
  skills: string[];
  state: string;
  city: string;
  venueExperience: string;
  promotionHistory: string;
  instagram: string;
  twitter: string;
  tiktok: string;
  website: string;
}

interface FieldErrors {
  displayName?: string;
  state?: string;
  city?: string;
  website?: string;
}

const INITIAL_FORM: FormData = {
  displayName: '', headline: '', bio: '', age: '', profileImageUrl: '', bannerImageUrl: '',
  professionalBackground: [], yearsExperience: '', genres: [], skills: [],
  state: '', city: '', venueExperience: '', promotionHistory: '',
  instagram: '', twitter: '', tiktok: '', website: '',
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

function isValidUrl(str: string): boolean {
  if (!str) return true;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Drag-and-drop image upload zone */
function ImageDropZone({
  label,
  value,
  onUpload,
  onClear,
  aspect,
  maxSizeMb = 2,
}: {
  label: string;
  value: string;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
  aspect: 'square' | 'banner';
  maxSizeMb?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploadError('');
    if (file.size > maxSizeMb * 1024 * 1024) {
      setUploadError(`File must be under ${maxSizeMb}MB`);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setUploadError('File must be an image');
      return;
    }
    setUploading(true);
    try {
      await onUpload(file);
    } catch {
      setUploadError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const dimensionClasses = aspect === 'banner'
    ? 'w-full h-32 sm:h-40 rounded-xl'
    : 'w-24 h-24 sm:w-28 sm:h-28 rounded-full';

  const previewClasses = aspect === 'banner'
    ? 'w-full h-full rounded-xl object-cover'
    : 'w-full h-full rounded-full object-cover';

  return (
    <div>
      <label className="block text-gray-400 text-sm mb-1.5">{label}</label>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`${dimensionClasses} border-2 border-dashed cursor-pointer flex items-center justify-center overflow-hidden transition-colors ${
          dragging
            ? 'border-amber-500 bg-amber-500/5'
            : value
              ? 'border-transparent'
              : 'border-noir-600 hover:border-amber-500/30 bg-noir-800'
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
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {uploadError && <p className="text-red-400 text-xs mt-1">{uploadError}</p>}
      {value && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="text-red-400/70 hover:text-red-400 text-xs mt-1">
          Remove
        </button>
      )}
      <p className="text-gray-600 text-xs mt-1">JPEG, PNG, WebP or GIF. Max {maxSizeMb}MB.</p>
    </div>
  );
}

/** Searchable multi-select dropdown */
function SearchableMultiSelect({
  label,
  options,
  selected,
  onChange,
  max,
  placeholder = 'Search...',
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  max: number;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(
    (o) => o.toLowerCase().includes(search.toLowerCase()) && !selected.includes(o),
  );

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else if (selected.length < max) {
      onChange([...selected, val]);
      setSearch('');
    }
  };

  return (
    <div ref={ref} className="relative">
      <label className="block text-gray-400 text-sm mb-1.5">
        {label} <span className="text-gray-600 text-xs">(up to {max})</span>
      </label>
      {/* Selected pills */}
      <div
        className="min-h-[44px] sm:min-h-[40px] bg-noir-800 border border-noir-600 rounded-lg px-3 py-2 flex flex-wrap gap-1.5 cursor-text"
        onClick={() => setOpen(true)}
      >
        {selected.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
            {s}
            <button type="button" onClick={(e) => { e.stopPropagation(); toggle(s); }}
              className="hover:text-amber-200 ml-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </span>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : selected.length >= max ? 'Max reached' : ''}
          disabled={selected.length >= max}
          className="flex-1 min-w-[80px] bg-transparent text-warm-50 text-sm focus:outline-none placeholder:text-gray-600 disabled:placeholder:text-gray-700"
        />
      </div>
      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-noir-800 border border-noir-600 rounded-lg shadow-xl">
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-noir-700 hover:text-warm-50 transition-colors"
            >
              {o}
            </button>
          ))}
        </div>
      )}
      <p className="text-gray-600 text-xs mt-1">{selected.length}/{max} selected</p>
    </div>
  );
}

/** Live preview card shown alongside the form */
function PreviewCard({ form, strength }: { form: FormData; strength: number }) {
  return (
    <div className="bg-noir-900 border border-noir-700 rounded-xl overflow-hidden">
      {/* Banner */}
      <div className="h-24 bg-gradient-to-r from-noir-800 to-noir-700 overflow-hidden">
        {form.bannerImageUrl && (
          <img src={form.bannerImageUrl} alt="Banner" className="w-full h-full object-cover" />
        )}
      </div>
      {/* Avatar + info */}
      <div className="px-4 pb-4 -mt-8">
        <div className="w-16 h-16 rounded-full border-2 border-noir-900 bg-noir-700 flex items-center justify-center text-amber-400 text-xl font-bold overflow-hidden mb-2">
          {form.profileImageUrl ? (
            <img src={form.profileImageUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            form.displayName.charAt(0).toUpperCase() || '?'
          )}
        </div>
        <p className="text-warm-50 font-semibold truncate">{form.displayName || 'Your Name'}</p>
        {form.headline && <p className="text-gray-400 text-sm truncate">{form.headline}</p>}
        {(form.city || form.state) && (
          <p className="text-gray-500 text-xs mt-0.5">
            {[form.city, form.state].filter(Boolean).join(', ')}
          </p>
        )}
        {/* Verification badge */}
        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Verification Pending
        </div>
        {/* Genres */}
        {form.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {form.genres.slice(0, 6).map((g) => (
              <span key={g} className="px-2 py-0.5 bg-noir-800 text-gray-300 rounded-full text-xs">{g}</span>
            ))}
            {form.genres.length > 6 && (
              <span className="px-2 py-0.5 bg-noir-800 text-gray-500 rounded-full text-xs">+{form.genres.length - 6}</span>
            )}
          </div>
        )}
        {/* Professional background */}
        {form.professionalBackground.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {form.professionalBackground.map((b) => (
              <span key={b} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-xs">{b}</span>
            ))}
          </div>
        )}
        {/* Strength */}
        <div className="mt-3 pt-3 border-t border-noir-700">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Profile Strength</span>
            <span className={strength >= 80 ? 'text-green-400' : strength >= 50 ? 'text-amber-400' : 'text-gray-500'}>{strength}%</span>
          </div>
          <div className="h-1 bg-noir-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${strength >= 80 ? 'bg-green-500' : strength >= 50 ? 'bg-amber-500' : 'bg-gray-600'}`}
              style={{ width: `${strength}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AgentRegisterPage() {
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
    } catch { /* storage full — ignore */ }
  }, [debouncedForm]);

  // ---- Check existing profile ----
  useEffect(() => {
    if (!user) { setChecking(false); return; }
    api.get<{ id: string; subscriptionStatus?: string }>('/agents/profile/me')
      .then((agent) => {
        setHasProfile(true);
        if (agent.subscriptionStatus === 'active') {
          navigate('/agents/dashboard', { replace: true });
        } else {
          setStep(4);
        }
      })
      .catch(() => setHasProfile(false))
      .finally(() => setChecking(false));
  }, [user, navigate]);

  // ---- Helpers ----
  const set = useCallback((key: keyof FormData, val: string | string[]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    // Clear field error on change
    if (key in ({} as FieldErrors)) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }, []);

  const toggleTag = useCallback((key: 'genres' | 'skills' | 'professionalBackground', val: string, max: number) => {
    setForm((prev) => {
      const arr = prev[key] as string[];
      if (arr.includes(val)) return { ...prev, [key]: arr.filter((v) => v !== val) };
      if (arr.length < max) return { ...prev, [key]: [...arr, val] };
      return prev;
    });
  }, []);

  const validateField = useCallback((field: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (field === 'displayName' && !form.displayName.trim()) {
        next.displayName = 'Display name is required';
      } else if (field === 'displayName') {
        next.displayName = undefined;
      }
      if (field === 'state' && !form.state) {
        next.state = 'State is required';
      } else if (field === 'state') {
        next.state = undefined;
      }
      if (field === 'city' && !form.city.trim()) {
        next.city = 'City is required';
      } else if (field === 'city') {
        next.city = undefined;
      }
      if (field === 'website' && form.website && !isValidUrl(form.website)) {
        next.website = 'Enter a valid URL (https://...)';
      } else if (field === 'website') {
        next.website = undefined;
      }
      return next;
    });
  }, [form.displayName, form.state, form.city, form.website]);

  const canAdvance = (): boolean => {
    if (step === 0) return form.displayName.trim().length > 0;
    if (step === 2) return form.state !== '' && form.city.trim().length > 0;
    if (step === 3) return !form.website || isValidUrl(form.website);
    return true;
  };

  const calcStrength = useMemo((): number => {
    const checks: [boolean, number][] = [
      [!!form.displayName, 10], [!!form.profileImageUrl, 15], [!!form.bannerImageUrl, 5],
      [!!form.bio, 10], [!!form.headline, 5], [!!form.state, 5], [!!form.city, 5],
      [!!form.age, 5], [!!form.yearsExperience, 5], [form.professionalBackground.length > 0, 5],
      [!!form.venueExperience, 10], [!!form.promotionHistory, 10],
      [!!(form.instagram || form.twitter || form.tiktok || form.website), 10],
      [form.genres.length > 0, 5],
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

  // ---- Subscribe & Submit ----
  const handleSubscribe = async () => {
    setError('');
    setSubmitting(true);
    try {
      const { url } = await api.post<{ url: string }>('/agents/subscribe');
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed');
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      if (hasProfile) {
        await handleSubscribe();
        return;
      }

      const payload = {
        displayName: form.displayName,
        headline: form.headline || undefined,
        bio: form.bio || undefined,
        state: form.state,
        city: form.city,
        age: form.age ? Number(form.age) : undefined,
        profileImageUrl: form.profileImageUrl || undefined,
        bannerImageUrl: form.bannerImageUrl || undefined,
        yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined,
        promoterType: form.professionalBackground.length > 0 ? form.professionalBackground[0] : undefined,
        professionalBackground: form.professionalBackground.length > 0 ? form.professionalBackground : undefined,
        genres: form.genres.length > 0 ? form.genres : undefined,
        skills: form.skills.length > 0 ? form.skills : undefined,
        venueExperience: form.venueExperience || undefined,
        promotionHistory: form.promotionHistory || undefined,
        socialLinks: (form.instagram || form.twitter || form.tiktok || form.website) ? {
          instagram: form.instagram || undefined,
          twitter: form.twitter || undefined,
          tiktok: form.tiktok || undefined,
          website: form.website || undefined,
        } : undefined,
      };
      await api.post('/agents/profile', payload);
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
          <p className="text-gray-400 mb-4">You must be logged in to become an agent.</p>
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
        <div className="max-w-md w-full bg-noir-900 border border-noir-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-warm-50 text-xl font-semibold mb-2">Application Submitted!</h2>
          <p className="text-gray-400 mb-2">
            Your application has been submitted for human review. A MiraCulture team member will
            personally verify your experience, credentials, and social presence before approval.
          </p>
          <p className="text-gray-500 text-sm mb-2">
            This review typically takes 24-48 hours. You'll receive a notification once your profile is approved.
          </p>
          <p className="text-amber-400/80 text-sm mb-6">
            Once approved, you can activate your $19.99/mo subscription from your agent
            dashboard to receive $5 in monthly raffle credits and start earning.
          </p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/agents')} className="flex-1 px-4 py-2 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors">
              Browse Agents
            </button>
            <button onClick={() => navigate('/agents/dashboard')} className="flex-1 px-4 py-2 bg-amber-500 text-noir-950 rounded-lg hover:bg-amber-400 transition-colors font-medium">
              Agent Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const strength = calcStrength;

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="min-h-screen bg-noir-950 py-6 sm:py-8 pb-28 sm:pb-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <h1 className="text-2xl font-display tracking-wider text-warm-50 mb-1">BECOME A PROMOTER AGENT</h1>
        <div className="flex items-center gap-3 mb-6">
          <p className="text-gray-500 text-sm">Complete your profile to start earning with MiraCulture</p>
          {draftSaved && (
            <span className="text-xs text-green-400/70 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Draft saved
            </span>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center mb-2 sm:mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <button
                onClick={() => i < step && setStep(i)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0 ${
                  i < step ? 'bg-amber-500 text-noir-950 cursor-pointer' :
                  i === step ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400' :
                  'bg-noir-800 text-gray-600'
                }`}
              >
                {i < step ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-amber-500' : 'bg-noir-800'}`} />
              )}
            </div>
          ))}
        </div>
        {/* Step labels - hidden on mobile, shown on sm+ */}
        <div className="hidden sm:flex justify-between mb-6">
          {STEPS.map((label, i) => (
            <span key={label} className={`text-xs ${i === step ? 'text-amber-400' : 'text-gray-600'}`}>{label}</span>
          ))}
        </div>

        {/* Profile strength bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-500 text-xs">Profile Strength</span>
            <span className={`text-xs font-medium ${strength >= 80 ? 'text-green-400' : strength >= 50 ? 'text-amber-400' : 'text-gray-500'}`}>{strength}%</span>
          </div>
          <div className="h-1.5 bg-noir-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${strength >= 80 ? 'bg-green-500' : strength >= 50 ? 'bg-amber-500' : 'bg-gray-600'}`}
              style={{ width: `${strength}%` }}
            />
          </div>
        </div>

        {/* Main layout: form + preview */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Form column */}
          <div className="flex-1 min-w-0">
            <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-4 sm:p-6 mb-6">

              {/* ============================================================ */}
              {/* Step 0: Personal Info */}
              {/* ============================================================ */}
              {step === 0 && (
                <div className="space-y-5">
                  <h2 className="text-warm-50 font-semibold text-lg mb-1">Personal Info</h2>
                  <p className="text-gray-500 text-sm mb-4">This is how artists and fans will see you on the platform.</p>

                  {/* Display Name */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">
                      Display Name <span className="text-amber-500 text-xs font-medium">Required</span>
                    </label>
                    <input
                      type="text"
                      value={form.displayName}
                      onChange={(e) => set('displayName', e.target.value)}
                      onBlur={() => validateField('displayName')}
                      className={`w-full bg-noir-800 border rounded-lg px-4 py-3 sm:py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none text-base sm:text-sm ${
                        fieldErrors.displayName ? 'border-red-500/60' : 'border-noir-700'
                      }`}
                      placeholder="Your professional name"
                      maxLength={100}
                    />
                    {fieldErrors.displayName && <p className="text-red-400 text-xs mt-1">{fieldErrors.displayName}</p>}
                  </div>

                  {/* Headline */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Headline</label>
                    <input
                      type="text"
                      value={form.headline}
                      onChange={(e) => set('headline', e.target.value)}
                      className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-3 sm:py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none text-base sm:text-sm"
                      placeholder="e.g. 'NYC Club Promoter | 5 Years Experience'"
                      maxLength={120}
                    />
                    <p className={`text-xs mt-1 ${form.headline.length > 100 ? 'text-amber-400' : 'text-gray-600'}`}>
                      {form.headline.length}/120
                    </p>
                  </div>

                  {/* Profile Photo - drop zone */}
                  <ImageDropZone
                    label="Profile Photo"
                    value={form.profileImageUrl}
                    onUpload={(file) => handleImageUpload(file, 'profileImageUrl')}
                    onClear={() => set('profileImageUrl', '')}
                    aspect="square"
                  />

                  {/* Banner Image - drop zone */}
                  <ImageDropZone
                    label="Banner Image"
                    value={form.bannerImageUrl}
                    onUpload={(file) => handleImageUpload(file, 'bannerImageUrl')}
                    onClear={() => set('bannerImageUrl', '')}
                    aspect="banner"
                    maxSizeMb={5}
                  />

                  {/* Bio */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Bio</label>
                    <textarea
                      value={form.bio}
                      onChange={(e) => set('bio', e.target.value)}
                      rows={4}
                      className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-3 sm:py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none resize-none text-base sm:text-sm"
                      placeholder="Tell artists about yourself and what makes you great at promoting shows"
                      maxLength={500}
                    />
                    <p className={`text-xs mt-1 ${form.bio.length > 450 ? 'text-amber-400' : 'text-gray-600'}`}>
                      {form.bio.length}/500
                    </p>
                  </div>

                  {/* Age */}
                  <div className="w-32">
                    <label className="block text-gray-400 text-sm mb-1">Age</label>
                    <input
                      type="number"
                      value={form.age}
                      onChange={(e) => set('age', e.target.value)}
                      className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-3 sm:py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none text-base sm:text-sm"
                      placeholder="21"
                      min={18}
                      max={99}
                    />
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* Step 1: Professional Background */}
              {/* ============================================================ */}
              {step === 1 && (
                <div className="space-y-5">
                  <h2 className="text-warm-50 font-semibold text-lg mb-1">Professional Background</h2>
                  <p className="text-gray-500 text-sm mb-4">Help artists understand your expertise and specialties.</p>

                  {/* Professional Background - tag toggles */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Your Background</label>
                    <div className="flex flex-wrap gap-2">
                      {PROFESSIONAL_BACKGROUND_OPTIONS.map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => toggleTag('professionalBackground', b, 11)}
                          className={`px-3 py-2 sm:py-1.5 rounded-full text-xs font-medium transition-colors ${
                            form.professionalBackground.includes(b)
                              ? 'bg-amber-500 text-noir-950'
                              : 'bg-noir-800 text-gray-400 hover:bg-noir-700'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Years of Experience */}
                  <div className="w-48">
                    <label className="block text-gray-400 text-sm mb-1">Years of Experience</label>
                    <input
                      type="number"
                      value={form.yearsExperience}
                      onChange={(e) => set('yearsExperience', e.target.value)}
                      className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-3 sm:py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none text-base sm:text-sm"
                      placeholder="0"
                      min={0}
                      max={50}
                    />
                  </div>

                  {/* Genres - searchable multi-select */}
                  <SearchableMultiSelect
                    label="Genres You Promote"
                    options={GENRE_OPTIONS}
                    selected={form.genres}
                    onChange={(vals) => set('genres', vals)}
                    max={10}
                    placeholder="Search genres..."
                  />

                  {/* Skills - searchable multi-select */}
                  <SearchableMultiSelect
                    label="Your Skills"
                    options={SKILL_OPTIONS}
                    selected={form.skills}
                    onChange={(vals) => set('skills', vals)}
                    max={15}
                    placeholder="Search skills..."
                  />
                </div>
              )}

              {/* ============================================================ */}
              {/* Step 2: Location & Credentials */}
              {/* ============================================================ */}
              {step === 2 && (
                <div className="space-y-5">
                  <h2 className="text-warm-50 font-semibold text-lg mb-1">Location & Credentials</h2>
                  <p className="text-gray-500 text-sm mb-4">Artists search by location. This info also helps us verify you.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">
                        State <span className="text-amber-500 text-xs font-medium">Required</span>
                      </label>
                      <select
                        value={form.state}
                        onChange={(e) => set('state', e.target.value)}
                        onBlur={() => validateField('state')}
                        className={`w-full bg-noir-800 border rounded-lg px-4 py-3 sm:py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none text-base sm:text-sm ${
                          fieldErrors.state ? 'border-red-500/60' : 'border-noir-700'
                        }`}
                      >
                        <option value="">Select state</option>
                        {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {fieldErrors.state && <p className="text-red-400 text-xs mt-1">{fieldErrors.state}</p>}
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">
                        City <span className="text-amber-500 text-xs font-medium">Required</span>
                      </label>
                      <input
                        type="text"
                        value={form.city}
                        onChange={(e) => set('city', e.target.value)}
                        onBlur={() => validateField('city')}
                        className={`w-full bg-noir-800 border rounded-lg px-4 py-3 sm:py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none text-base sm:text-sm ${
                          fieldErrors.city ? 'border-red-500/60' : 'border-noir-700'
                        }`}
                        placeholder="Your city"
                      />
                      {fieldErrors.city && <p className="text-red-400 text-xs mt-1">{fieldErrors.city}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Venue Experience</label>
                    <textarea
                      value={form.venueExperience}
                      onChange={(e) => set('venueExperience', e.target.value)}
                      rows={3}
                      className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-3 sm:py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none resize-none text-base sm:text-sm"
                      placeholder="List venues you've worked with (e.g. 'Webster Hall NYC, Brooklyn Steel, Baby's All Right')"
                      maxLength={2000}
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Promotion History</label>
                    <textarea
                      value={form.promotionHistory}
                      onChange={(e) => set('promotionHistory', e.target.value)}
                      rows={3}
                      className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-3 sm:py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none resize-none text-base sm:text-sm"
                      placeholder="Describe shows or events you've promoted, managed, or helped sell out"
                      maxLength={2000}
                    />
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* Step 3: Socials */}
              {/* ============================================================ */}
              {step === 3 && (
                <div className="space-y-5">
                  <h2 className="text-warm-50 font-semibold text-lg mb-1">Social Links</h2>
                  <p className="text-gray-500 text-sm mb-4">Help artists find you and verify your online presence.</p>

                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Instagram</label>
                    <div className="flex items-center bg-noir-800 border border-noir-700 rounded-lg overflow-hidden">
                      <span className="px-3 text-gray-600 text-sm bg-noir-850">@</span>
                      <input
                        type="text"
                        value={form.instagram}
                        onChange={(e) => set('instagram', e.target.value)}
                        className="flex-1 bg-noir-800 px-3 py-3 sm:py-2.5 text-warm-50 focus:outline-none text-base sm:text-sm"
                        placeholder="yourhandle"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Twitter / X</label>
                    <div className="flex items-center bg-noir-800 border border-noir-700 rounded-lg overflow-hidden">
                      <span className="px-3 text-gray-600 text-sm bg-noir-850">@</span>
                      <input
                        type="text"
                        value={form.twitter}
                        onChange={(e) => set('twitter', e.target.value)}
                        className="flex-1 bg-noir-800 px-3 py-3 sm:py-2.5 text-warm-50 focus:outline-none text-base sm:text-sm"
                        placeholder="yourhandle"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-1">TikTok</label>
                    <div className="flex items-center bg-noir-800 border border-noir-700 rounded-lg overflow-hidden">
                      <span className="px-3 text-gray-600 text-sm bg-noir-850">@</span>
                      <input
                        type="text"
                        value={form.tiktok}
                        onChange={(e) => set('tiktok', e.target.value)}
                        className="flex-1 bg-noir-800 px-3 py-3 sm:py-2.5 text-warm-50 focus:outline-none text-base sm:text-sm"
                        placeholder="yourhandle"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Website</label>
                    <input
                      type="url"
                      value={form.website}
                      onChange={(e) => set('website', e.target.value)}
                      onBlur={() => validateField('website')}
                      className={`w-full bg-noir-800 border rounded-lg px-4 py-3 sm:py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none text-base sm:text-sm ${
                        fieldErrors.website ? 'border-red-500/60' : 'border-noir-700'
                      }`}
                      placeholder="https://yoursite.com"
                    />
                    {fieldErrors.website && <p className="text-red-400 text-xs mt-1">{fieldErrors.website}</p>}
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* Step 4: Subscribe & Review */}
              {/* ============================================================ */}
              {step === 4 && (
                <div className="space-y-6">
                  <h2 className="text-warm-50 font-semibold text-lg mb-1">Subscribe & Launch</h2>
                  <p className="text-gray-500 text-sm">Review your profile and start your agent subscription.</p>

                  {/* Subscription card */}
                  <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-xl p-6">
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-3xl font-bold text-warm-50">$19.99</span>
                      <span className="text-gray-400">/month</span>
                    </div>
                    <p className="text-amber-400 text-sm font-medium mb-4">Agent Pro Membership</p>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2 text-sm">
                        <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-300"><span className="text-amber-400 font-medium">$5/mo raffle credits</span> — enter any show raffle for free (use-it-or-lose-it, no rollover)</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-300"><span className="text-amber-400 font-medium">50% revenue share</span> on every campaign you manage</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-300">Verified profile badge visible to all artists</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-300">Priority listing in the marketplace</span>
                      </li>
                    </ul>
                    <div className="mt-4 pt-4 border-t border-amber-500/20">
                      <p className="text-gray-500 text-xs">
                        Your $5 raffle credit = one free ticket entry each month. Most show tickets are $5-$10,
                        so your subscription practically pays for itself. Cancel anytime.
                      </p>
                    </div>
                  </div>

                  {/* Inline profile preview (mobile only, since desktop has sidebar) */}
                  <div className="lg:hidden">
                    <h3 className="text-gray-300 text-sm font-medium mb-3">Profile Preview</h3>
                    <PreviewCard form={form} strength={strength} />
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm mb-4">
                {error}
              </div>
            )}

            {/* Desktop navigation buttons */}
            <div className="hidden sm:flex gap-3">
              {step > 0 && (
                <button onClick={() => setStep(step - 1)} className="px-6 py-3 bg-noir-800 text-gray-300 rounded-xl hover:bg-noir-700 transition-colors">
                  Back
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canAdvance()}
                  className="flex-1 py-3 bg-amber-500 text-noir-950 rounded-xl font-semibold hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={hasProfile ? handleSubscribe : handleSubmit}
                  disabled={submitting || (!hasProfile && (!form.displayName || !form.state || !form.city))}
                  className="flex-1 py-3 bg-amber-500 text-noir-950 rounded-xl font-semibold hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Redirecting to Stripe...' : hasProfile ? 'Subscribe Now — $19.99/mo' : 'Subscribe & Submit Application — $19.99/mo'}
                </button>
              )}
            </div>
          </div>

          {/* Preview column — desktop only, sticky */}
          <div className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-8">
              <h3 className="text-gray-300 text-sm font-medium mb-3">Live Preview</h3>
              <PreviewCard form={form} strength={strength} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 sm:hidden bg-noir-950 border-t border-noir-800 px-4 py-3 flex gap-3 z-40">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="px-5 py-3 bg-noir-800 text-gray-300 rounded-xl hover:bg-noir-700 transition-colors text-sm font-medium"
          >
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canAdvance()}
            className="flex-1 py-3 bg-amber-500 text-noir-950 rounded-xl font-semibold hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={hasProfile ? handleSubscribe : handleSubmit}
            disabled={submitting || (!hasProfile && (!form.displayName || !form.state || !form.city))}
            className="flex-1 py-3 bg-amber-500 text-noir-950 rounded-xl font-semibold hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {submitting ? 'Redirecting...' : hasProfile ? 'Subscribe — $19.99/mo' : 'Submit — $19.99/mo'}
          </button>
        )}
      </div>
    </div>
  );
}
