import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../lib/api.js';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
];

const PROMOTER_TYPES = [
  'Club Promoter', 'Festival Promoter', 'Concert Promoter', 'Street Team',
  'Social Media Promoter', 'Radio Promoter', 'College Promoter', 'Event Coordinator',
  'Venue Booker', 'Tour Manager', 'Other',
];

const GENRE_OPTIONS = [
  'Hip-Hop', 'R&B', 'Pop', 'Rock', 'Electronic', 'Country', 'Jazz', 'Latin',
  'Reggae', 'Metal', 'Indie', 'Folk', 'Blues', 'Punk', 'Soul', 'Funk',
  'Classical', 'Gospel', 'Afrobeats', 'K-Pop',
];

const SKILL_OPTIONS = [
  'Social Media Marketing', 'Flyering', 'Venue Relations', 'Ticket Sales',
  'Event Planning', 'Photography', 'Videography', 'Graphic Design',
  'Community Outreach', 'Press Relations', 'Radio Promotion', 'Street Marketing',
  'Influencer Networking', 'Brand Partnerships', 'Data Analytics',
];

const STEPS = ['Personal', 'Professional', 'Location', 'Socials', 'Subscribe'];

interface FormData {
  displayName: string;
  headline: string;
  bio: string;
  age: string;
  profileImageUrl: string;
  promoterType: string;
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

export default function AgentRegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    displayName: '', headline: '', bio: '', age: '', profileImageUrl: '',
    promoterType: '', yearsExperience: '', genres: [], skills: [],
    state: '', city: '', venueExperience: '', promotionHistory: '',
    instagram: '', twitter: '', tiktok: '', website: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

  const set = (key: keyof FormData, val: string | string[]) => setForm({ ...form, [key]: val });

  const toggleTag = (key: 'genres' | 'skills', val: string, max: number) => {
    const arr = form[key];
    if (arr.includes(val)) set(key, arr.filter((v) => v !== val));
    else if (arr.length < max) set(key, [...arr, val]);
  };

  const canAdvance = (): boolean => {
    if (step === 0) return form.displayName.trim().length > 0;
    if (step === 2) return form.state !== '' && form.city.trim().length > 0;
    return true;
  };

  const calcStrength = (): number => {
    const checks: [boolean, number][] = [
      [!!form.displayName, 10], [!!form.profileImageUrl, 15], [!!form.bio, 10],
      [!!form.headline, 5], [!!form.state, 5], [!!form.city, 5], [!!form.age, 5],
      [!!form.yearsExperience, 5], [!!form.promoterType, 5], [!!form.venueExperience, 10],
      [!!form.promotionHistory, 10], [form.instagram || form.twitter || form.tiktok || form.website ? true : false, 10],
      [form.genres.length > 0, 5],
    ];
    return checks.reduce((s, [ok, w]) => s + (ok ? w : 0), 0);
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        displayName: form.displayName,
        headline: form.headline || undefined,
        bio: form.bio || undefined,
        state: form.state,
        city: form.city,
        age: form.age ? Number(form.age) : undefined,
        profileImageUrl: form.profileImageUrl || undefined,
        yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined,
        promoterType: form.promoterType || undefined,
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
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setSubmitting(false);
    }
  };

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
            Your promoter agent profile is under review. We'll verify your experience
            and approve your profile within 24-48 hours.
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

  const strength = calcStrength();

  return (
    <div className="min-h-screen bg-noir-950 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <h1 className="text-2xl font-display tracking-wider text-warm-50 mb-1">BECOME A PROMOTER AGENT</h1>
        <p className="text-gray-500 text-sm mb-6">Complete your profile to start earning with MiraCulture</p>

        {/* Step indicator */}
        <div className="flex items-center mb-8">
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
        <div className="flex justify-between mb-6">
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

        {/* Step content */}
        <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-6 mb-6">
          {/* Step 1: Personal Info */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-warm-50 font-semibold text-lg mb-1">Personal Info</h2>
              <p className="text-gray-500 text-sm mb-4">This is how artists and fans will see you on the platform.</p>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Display Name <span className="text-amber-500">*</span></label>
                <input type="text" value={form.displayName} onChange={(e) => set('displayName', e.target.value)}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none"
                  placeholder="Your professional name" maxLength={100} />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Headline</label>
                <input type="text" value={form.headline} onChange={(e) => set('headline', e.target.value)}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none"
                  placeholder="e.g. 'NYC Club Promoter | 5 Years Experience'" maxLength={120} />
                <p className="text-gray-600 text-xs mt-1">{form.headline.length}/120</p>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Profile Photo URL</label>
                <input type="url" value={form.profileImageUrl} onChange={(e) => set('profileImageUrl', e.target.value)}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none"
                  placeholder="https://..." />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Bio</label>
                <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={4}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none resize-none"
                  placeholder="Tell artists about yourself and what makes you great at promoting shows" maxLength={2000} />
                <p className="text-gray-600 text-xs mt-1">{form.bio.length}/2000</p>
              </div>

              <div className="w-32">
                <label className="block text-gray-400 text-sm mb-1">Age</label>
                <input type="number" value={form.age} onChange={(e) => set('age', e.target.value)}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none"
                  placeholder="21" min={18} max={99} />
              </div>
            </div>
          )}

          {/* Step 2: Professional Info */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-warm-50 font-semibold text-lg mb-1">Professional Background</h2>
              <p className="text-gray-500 text-sm mb-4">Help artists understand your expertise and specialties.</p>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Promoter Type</label>
                <select value={form.promoterType} onChange={(e) => set('promoterType', e.target.value)}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none">
                  <option value="">Select your specialty</option>
                  {PROMOTER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="w-48">
                <label className="block text-gray-400 text-sm mb-1">Years of Experience</label>
                <input type="number" value={form.yearsExperience} onChange={(e) => set('yearsExperience', e.target.value)}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none"
                  placeholder="0" min={0} max={50} />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Genres You Promote <span className="text-gray-600 text-xs">(select up to 10)</span></label>
                <div className="flex flex-wrap gap-2">
                  {GENRE_OPTIONS.map((g) => (
                    <button key={g} type="button" onClick={() => toggleTag('genres', g, 10)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        form.genres.includes(g) ? 'bg-amber-500 text-noir-950' : 'bg-noir-800 text-gray-400 hover:bg-noir-700'
                      }`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Your Skills <span className="text-gray-600 text-xs">(select up to 15)</span></label>
                <div className="flex flex-wrap gap-2">
                  {SKILL_OPTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => toggleTag('skills', s, 15)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        form.skills.includes(s) ? 'bg-amber-500 text-noir-950' : 'bg-noir-800 text-gray-400 hover:bg-noir-700'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Location & Credentials */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-warm-50 font-semibold text-lg mb-1">Location & Credentials</h2>
              <p className="text-gray-500 text-sm mb-4">Artists search by location. This info also helps us verify you.</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">State <span className="text-amber-500">*</span></label>
                  <select value={form.state} onChange={(e) => set('state', e.target.value)}
                    className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none">
                    <option value="">Select state</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">City <span className="text-amber-500">*</span></label>
                  <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)}
                    className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none"
                    placeholder="Your city" />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Venue Experience</label>
                <textarea value={form.venueExperience} onChange={(e) => set('venueExperience', e.target.value)} rows={3}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none resize-none"
                  placeholder="List venues you've worked with (e.g. 'Webster Hall NYC, Brooklyn Steel, Baby's All Right')" maxLength={2000} />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Promotion History</label>
                <textarea value={form.promotionHistory} onChange={(e) => set('promotionHistory', e.target.value)} rows={3}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none resize-none"
                  placeholder="Describe shows or events you've promoted, managed, or helped sell out" maxLength={2000} />
              </div>
            </div>
          )}

          {/* Step 4: Socials */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-warm-50 font-semibold text-lg mb-1">Social Links</h2>
              <p className="text-gray-500 text-sm mb-4">Help artists find you and verify your online presence.</p>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Instagram</label>
                <div className="flex items-center bg-noir-800 border border-noir-700 rounded-lg overflow-hidden">
                  <span className="px-3 text-gray-600 text-sm bg-noir-850">@</span>
                  <input type="text" value={form.instagram} onChange={(e) => set('instagram', e.target.value)}
                    className="flex-1 bg-noir-800 px-3 py-2.5 text-warm-50 focus:outline-none" placeholder="yourhandle" />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Twitter / X</label>
                <div className="flex items-center bg-noir-800 border border-noir-700 rounded-lg overflow-hidden">
                  <span className="px-3 text-gray-600 text-sm bg-noir-850">@</span>
                  <input type="text" value={form.twitter} onChange={(e) => set('twitter', e.target.value)}
                    className="flex-1 bg-noir-800 px-3 py-2.5 text-warm-50 focus:outline-none" placeholder="yourhandle" />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">TikTok</label>
                <div className="flex items-center bg-noir-800 border border-noir-700 rounded-lg overflow-hidden">
                  <span className="px-3 text-gray-600 text-sm bg-noir-850">@</span>
                  <input type="text" value={form.tiktok} onChange={(e) => set('tiktok', e.target.value)}
                    className="flex-1 bg-noir-800 px-3 py-2.5 text-warm-50 focus:outline-none" placeholder="yourhandle" />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Website</label>
                <input type="url" value={form.website} onChange={(e) => set('website', e.target.value)}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none"
                  placeholder="https://yoursite.com" />
              </div>
            </div>
          )}

          {/* Step 5: Subscribe & Review */}
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

              {/* Profile preview */}
              <div>
                <h3 className="text-gray-300 text-sm font-medium mb-3">Profile Preview</h3>
                <div className="bg-noir-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-noir-700 flex items-center justify-center text-amber-400 text-lg font-bold shrink-0">
                      {form.profileImageUrl ? (
                        <img src={form.profileImageUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : form.displayName.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-warm-50 font-semibold">{form.displayName || 'Your Name'}</p>
                      {form.headline && <p className="text-gray-400 text-sm">{form.headline}</p>}
                      {form.city && form.state && <p className="text-gray-500 text-xs">{form.city}, {form.state}</p>}
                    </div>
                  </div>
                  {form.bio && <p className="text-gray-400 text-sm">{form.bio}</p>}
                  <div className="flex flex-wrap gap-2">
                    {form.promoterType && <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-xs">{form.promoterType}</span>}
                    {form.yearsExperience && <span className="px-2 py-0.5 bg-noir-700 text-gray-400 rounded text-xs">{form.yearsExperience} yrs exp</span>}
                    {form.age && <span className="px-2 py-0.5 bg-noir-700 text-gray-400 rounded text-xs">Age {form.age}</span>}
                  </div>
                  {form.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.genres.map((g) => <span key={g} className="px-2 py-0.5 bg-noir-700 text-gray-300 rounded-full text-xs">{g}</span>)}
                    </div>
                  )}
                  {form.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.skills.map((s) => <span key={s} className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-xs">{s}</span>)}
                    </div>
                  )}

                  {/* Strength */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500">Profile Strength</span>
                      <span className={strength >= 80 ? 'text-green-400' : strength >= 50 ? 'text-amber-400' : 'text-gray-500'}>{strength}%</span>
                    </div>
                    <div className="h-1 bg-noir-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${strength >= 80 ? 'bg-green-500' : strength >= 50 ? 'bg-amber-500' : 'bg-gray-600'}`} style={{ width: `${strength}%` }} />
                    </div>
                    {strength < 80 && <p className="text-gray-600 text-xs mt-1">Complete more fields to boost your visibility</p>}
                  </div>
                </div>
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

        {/* Navigation buttons */}
        <div className="flex gap-3">
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
              onClick={handleSubmit}
              disabled={submitting || !form.displayName || !form.state || !form.city}
              className="flex-1 py-3 bg-amber-500 text-noir-950 rounded-xl font-semibold hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Subscribe & Submit Application — $19.99/mo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
