import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';

interface InviteDetails {
  email: string;
  permission: string;
  inviterName: string;
  expiresAt: string;
}

export default function DevInviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get<InviteDetails>(`/auth/dev-invite/${token}`)
      .then(setInvite)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      await api.post(`/auth/dev-invite/${token}/accept`);
      setAccepted(true);
      await refreshUser();
      setTimeout(() => navigate('/admin'), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center">
        <SEO title="Developer Invite" noindex />
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4">
        <SEO title="Developer Invite" noindex />
        <div className="text-center max-w-md">
          <h1 className="font-display text-2xl text-warm-50 mb-4">Invite Error</h1>
          <p className="text-red-400 mb-6">{error}</p>
          <Link to="/" className="text-amber-400 hover:text-amber-300 text-sm">Go Home</Link>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4">
        <SEO title="Invite Accepted" noindex />
        <div className="text-center">
          <h1 className="font-display text-2xl text-warm-50 mb-2">Welcome, Developer!</h1>
          <p className="text-gray-400">Redirecting to admin panel...</p>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4">
      <SEO title="Developer Invite" noindex />
      <div className="w-full max-w-md bg-noir-900 border border-noir-700 rounded-xl p-8">
        <h1 className="font-display text-2xl tracking-wider text-warm-50 mb-2">DEVELOPER INVITE</h1>
        <p className="text-gray-400 text-sm mb-6">You have been invited to join MiraCulture as a developer.</p>

        <div className="bg-noir-800 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Email</span>
            <span className="text-warm-50">{invite.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Permission</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
              invite.permission === 'FULL'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-noir-700 text-gray-400 border border-noir-600'
            }`}>{invite.permission}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Invited By</span>
            <span className="text-warm-50">{invite.inviterName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Expires</span>
            <span className="text-warm-50">{new Date(invite.expiresAt).toLocaleDateString()}</span>
          </div>
        </div>

        {!user ? (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm text-center">Log in or register to accept this invite.</p>
            <div className="flex gap-3">
              <Link
                to="/login"
                state={{ from: `/dev-invite/${token}` }}
                className="flex-1 text-center px-4 py-2.5 rounded-lg bg-amber-500 text-noir-950 font-medium text-sm hover:bg-amber-400 transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/register"
                state={{ from: `/dev-invite/${token}` }}
                className="flex-1 text-center px-4 py-2.5 rounded-lg border border-noir-700 text-gray-300 text-sm hover:border-amber-500/40 transition-colors"
              >
                Register
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">
              Logged in as <span className="text-warm-50">{user.email}</span>
            </p>
            {user.email.toLowerCase() !== invite.email.toLowerCase() ? (
              <p className="text-red-400 text-sm">
                This invite was sent to {invite.email}. Please log in with that account.
              </p>
            ) : (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full px-4 py-2.5 rounded-lg bg-amber-500 text-noir-950 font-medium text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
              >
                {accepting ? 'Accepting...' : 'Accept Invitation'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
