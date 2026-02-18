import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import SEO from '../components/SEO.js';

export default function ArtistRegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, name, 'ARTIST');
      navigate('/artist/verify');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4 py-16">
      <SEO
        title="Artist Registration"
        description="Register as an artist on MiraCulture. List your events, connect with fans, and receive direct support."
        noindex
      />
      <div className="w-full max-w-md">
        <div className="bg-noir-900 border border-noir-800 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <p className="font-display text-sm tracking-[0.3em] text-amber-500/60 mb-2">
              FOR ARTISTS
            </p>
            <h1 className="font-display text-3xl tracking-wider text-warm-50">
              CREATE YOUR ACCOUNT
            </h1>
            <p className="font-body text-gray-400 text-sm mt-3">
              Register to list events and connect with fans worldwide.
            </p>
          </div>

          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="artist-name" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Stage Name / Artist Name
              </label>
              <input
                id="artist-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                placeholder="Your artist or stage name"
              />
            </div>

            <div>
              <label htmlFor="artist-email" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Email
              </label>
              <input
                id="artist-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-noir-800 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors placeholder-gray-600"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="artist-password" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Password
              </label>
              <input
                id="artist-password"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? 'Creating account...' : 'Register as Artist'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-amber-400 hover:text-amber-300 transition-colors">
                Sign in
              </Link>
            </p>
            <p className="text-sm text-gray-500">
              Not an artist?{' '}
              <Link to="/register" className="text-gray-400 hover:text-amber-400 transition-colors">
                Sign up as a fan
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
