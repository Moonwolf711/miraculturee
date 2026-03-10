import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../lib/api.js';

interface InviteInfo {
  artistName: string;
  permission: string;
  expiresAt: string;
}

export default function ManagerAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${import.meta.env.VITE_API_URL || ''}/artist/managers/accept/${token}`)
      .then((res) => res.ok ? res.json() : res.json().then((e) => { throw new Error(e.error); }))
      .then(setInvite)
      .catch((err) => setError(err.message || 'Invalid or expired invite'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!user) { navigate(`/login?redirect=/manager/accept/${token}`); return; }
    if (!displayName.trim()) { setError('Display name is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/artist/managers/accept/${token}`, { displayName, bio: bio || undefined });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center">
        <div className="text-gray-500">Loading invite...</div>
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
          <h2 className="text-warm-50 text-xl font-semibold mb-2">You're In!</h2>
          <p className="text-gray-400 mb-6">You now have manager access to {invite?.artistName}'s profile.</p>
          <button onClick={() => navigate('/artist/dashboard')} className="px-6 py-2.5 bg-amber-500 text-noir-950 rounded-lg hover:bg-amber-400 transition-colors font-medium">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-noir-900 border border-noir-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-warm-50 text-xl font-semibold mb-2">Invalid Invite</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-noir-900 border border-noir-700 rounded-2xl p-8">
        <h1 className="text-2xl font-display tracking-wider text-warm-50 text-center mb-2">MANAGER INVITE</h1>
        <p className="text-gray-400 text-sm text-center mb-6">
          <span className="text-amber-400 font-medium">{invite?.artistName}</span> has invited you to be a manager with <span className="text-warm-50">{invite?.permission === 'READ_WRITE' ? 'read & write' : 'read only'}</span> access.
        </p>

        {!user && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6 text-center">
            <p className="text-amber-400 text-sm">You need to be logged in to accept this invite.</p>
            <a href={`/login?redirect=/manager/accept/${token}`} className="text-amber-400 text-sm font-medium hover:underline mt-1 inline-block">Log in or Register</a>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Your Display Name <span className="text-amber-500">*</span></label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none"
              placeholder="How the artist will see you"
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Bio (optional)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-noir-800 border border-noir-700 rounded-lg px-4 py-2.5 text-warm-50 focus:border-amber-500/50 focus:outline-none resize-none"
              placeholder="Brief intro about yourself"
              maxLength={500}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm mb-4">{error}</div>
        )}

        <button
          onClick={handleAccept}
          disabled={submitting || !user || !displayName.trim()}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Accepting...' : 'Accept Invite'}
        </button>

        <p className="text-gray-600 text-xs text-center mt-4">
          Expires {invite?.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : 'soon'}
        </p>
      </div>
    </div>
  );
}
