import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4 py-16">
      <SEO title="Forgot Password" description="Reset your MiraCulture password." noindex />
      <div className="w-full max-w-md">
        <div className="bg-noir-900 border border-noir-800 rounded-2xl p-8 shadow-2xl">
          <h1 className="font-display text-3xl tracking-wider text-warm-50 text-center mb-4">
            RESET PASSWORD
          </h1>
          <p className="text-gray-400 text-sm text-center mb-8">
            Enter your email and we'll send you a link to reset your password.
          </p>

          {submitted ? (
            <div className="text-center">
              <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg mb-6 text-sm">
                If that email exists, we sent a reset link. Check your inbox.
              </div>
              <Link to="/login" className="text-amber-400 hover:text-amber-300 transition-colors text-sm">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="forgot-email" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                    Email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <p className="text-sm text-gray-400 mt-6 text-center">
                Remember your password?{' '}
                <Link to="/login" className="text-amber-400 hover:text-amber-300 transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
