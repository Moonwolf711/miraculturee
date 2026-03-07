import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import SEO from '../components/SEO.js';

export default function RegisterPage() {
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
      await register(email, password, name, 'FAN');
      navigate('/events');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4 py-16 relative overflow-hidden">
      <SEO
        title="Sign Up"
        description="Join MiraCulture as a fan, local fan, or artist. Support live music with fair, face-value tickets and cryptographic raffles."
        noindex
      />

      {/* Ambient background elements */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-amber-500/[0.03] rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-amber-500/[0.02] rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
      </div>

      <div className="w-full max-w-md relative animate-fade-in-up">
        <div className="bg-noir-900/80 backdrop-blur-sm border border-noir-800/60 rounded-2xl p-8 shadow-2xl animate-glow-pulse">
          <h1 className="font-display text-3xl tracking-wider text-warm-50 text-center mb-8 animate-pulse-glow">
            JOIN THE MOVEMENT
          </h1>

          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <label htmlFor="register-name" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Name
              </label>
              <input
                id="register-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="w-full px-4 py-3 bg-noir-800/70 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all duration-300 placeholder-gray-600 hover:border-noir-600"
                placeholder="Your name"
              />
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <label htmlFor="register-email" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Email
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-noir-800/70 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all duration-300 placeholder-gray-600 hover:border-noir-600"
                placeholder="you@example.com"
              />
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <label htmlFor="register-password" className="block text-gray-400 text-xs uppercase tracking-wider font-medium mb-2">
                Password
              </label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-noir-800/70 border border-noir-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all duration-300 placeholder-gray-600 hover:border-noir-600"
                placeholder="Min. 8 characters"
              />
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/20 text-noir-950 font-semibold rounded-lg disabled:opacity-50 transition-all duration-300 mt-2"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </div>
          </form>

          <p className="text-sm text-gray-400 mt-6 text-center animate-fade-in" style={{ animationDelay: '0.45s' }}>
            Already have an account?{' '}
            <Link to="/login" className="text-amber-400 hover:text-amber-300 transition-colors duration-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
