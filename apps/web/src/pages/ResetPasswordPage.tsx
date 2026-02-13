import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const tokens = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/reset-password',
        { token, password },
      );
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      navigate('/events');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired reset link.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4 py-16">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Invalid reset link.</p>
          <Link to="/forgot-password" className="text-amber-400 hover:text-amber-300 transition-colors text-sm">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4 py-16">
      <SEO title="Reset Password" description="Set your new MiraCulture password." noindex />
      <div className="w-full max-w-md">
        <div className="bg-noir-900 border border-noir-800 rounded-2xl p-8 shadow-2xl">
          <h1 className="font-display text-3xl tracking-wider text-warm-50 text-center mb-8">
            NEW PASSWORD
          </h1>

          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="reset-password" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                New Password
              </label>
              <input
                id="reset-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                placeholder="Min. 8 characters"
              />
            </div>

            <div>
              <label htmlFor="reset-confirm" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Confirm Password
              </label>
              <input
                id="reset-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                placeholder="Repeat your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? 'Resetting...' : 'Set New Password'}
            </button>
          </form>

          <p className="text-sm text-gray-400 mt-6 text-center">
            <Link to="/login" className="text-amber-400 hover:text-amber-300 transition-colors">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
