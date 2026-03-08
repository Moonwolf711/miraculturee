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

export default function AgentRegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    state: '',
    city: '',
    venueExperience: '',
    promotionHistory: '',
    instagram: '',
    twitter: '',
    website: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        displayName: form.displayName,
        bio: form.bio || undefined,
        state: form.state,
        city: form.city,
        venueExperience: form.venueExperience || undefined,
        promotionHistory: form.promotionHistory || undefined,
        socialLinks: (form.instagram || form.twitter || form.website) ? {
          instagram: form.instagram || undefined,
          twitter: form.twitter || undefined,
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
      <div className="min-h-screen bg-noir-950 flex items-center justify-center">
        <div className="max-w-md w-full bg-noir-900 border border-noir-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-warm-50 text-xl font-semibold mb-2">Application Submitted!</h2>
          <p className="text-gray-400 mb-6">
            Your promoter agent profile is under review. Our team will verify your experience
            and approve your profile within 24-48 hours. You'll be notified once approved.
          </p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/agents')} className="flex-1 px-4 py-2 bg-noir-800 text-gray-300 rounded-lg hover:bg-noir-700 transition-colors">
              Browse Agents
            </button>
            <button onClick={() => navigate('/dashboard')} className="flex-1 px-4 py-2 bg-amber-500 text-noir-950 rounded-lg hover:bg-amber-400 transition-colors font-medium">
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir-950 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-display tracking-wider text-warm-50 mb-2">BECOME A PROMOTER AGENT</h1>
        <p className="text-gray-400 mb-8">
          Help artists run their MiraCulture campaigns in your area. Earn 50% of campaign proceeds
          by leveraging your local venue connections and promotion expertise.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-6">
            <h2 className="text-warm-50 font-semibold mb-4">Basic Info</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Display Name *</label>
                <input
                  type="text"
                  required
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2 text-warm-50 focus:border-amber-500/50 focus:outline-none"
                  placeholder="How artists will see you"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Bio</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2 text-warm-50 focus:border-amber-500/50 focus:outline-none resize-none"
                  placeholder="Tell artists about yourself and what you bring to the table"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-6">
            <h2 className="text-warm-50 font-semibold mb-4">Your Location</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">State *</label>
                <select
                  required
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2 text-warm-50 focus:border-amber-500/50 focus:outline-none"
                >
                  <option value="">Select state</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2 text-warm-50 focus:border-amber-500/50 focus:outline-none"
                  placeholder="Your city"
                />
              </div>
            </div>
          </div>

          {/* Experience (verification) */}
          <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-6">
            <h2 className="text-warm-50 font-semibold mb-1">Experience & Verification</h2>
            <p className="text-gray-500 text-sm mb-4">This information helps us verify you're a legit local promoter.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Venue Experience</label>
                <textarea
                  value={form.venueExperience}
                  onChange={(e) => setForm({ ...form, venueExperience: e.target.value })}
                  rows={3}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2 text-warm-50 focus:border-amber-500/50 focus:outline-none resize-none"
                  placeholder="List venues you've worked with or have connections at (e.g., 'Webster Hall NYC, Brooklyn Steel, Baby's All Right')"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Promotion History</label>
                <textarea
                  value={form.promotionHistory}
                  onChange={(e) => setForm({ ...form, promotionHistory: e.target.value })}
                  rows={3}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2 text-warm-50 focus:border-amber-500/50 focus:outline-none resize-none"
                  placeholder="Describe shows or events you've promoted, managed, or helped sell out"
                />
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="bg-noir-900 border border-noir-700/50 rounded-xl p-6">
            <h2 className="text-warm-50 font-semibold mb-4">Social Links</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Instagram</label>
                <input
                  type="text"
                  value={form.instagram}
                  onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2 text-warm-50 focus:border-amber-500/50 focus:outline-none"
                  placeholder="@handle (without the @)"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Twitter / X</label>
                <input
                  type="text"
                  value={form.twitter}
                  onChange={(e) => setForm({ ...form, twitter: e.target.value })}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2 text-warm-50 focus:border-amber-500/50 focus:outline-none"
                  placeholder="@handle (without the @)"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Website</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2 text-warm-50 focus:border-amber-500/50 focus:outline-none"
                  placeholder="https://yoursite.com"
                />
              </div>
            </div>
          </div>

          {/* Revenue info */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-6">
            <h2 className="text-amber-400 font-semibold mb-2">How Earnings Work</h2>
            <ul className="text-gray-400 text-sm space-y-2">
              <li>When an artist selects you as their campaign agent, you'll manage the campaign in your area.</li>
              <li>You earn <span className="text-amber-400 font-semibold">50% of campaign proceeds</span> for campaigns you manage.</li>
              <li>Your profile must be verified before artists can select you.</li>
              <li>Build your reputation through successful campaigns and artist ratings.</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-amber-500 text-noir-950 rounded-xl font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  );
}
