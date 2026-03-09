import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import SEO from '../components/SEO.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSocialLogin = (provider: string) => {
    window.location.href = `${API_URL}/auth/${provider}/redirect`;
  };

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

            {/* Divider */}
            <div className="flex items-center gap-3 my-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-noir-700 to-transparent" />
              <span className="text-gray-600 text-xs uppercase tracking-wider">or sign up with</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-noir-700 to-transparent" />
            </div>

            {/* Social login buttons */}
            <div className="grid grid-cols-2 gap-3 animate-fade-in-up" style={{ animationDelay: '0.45s' }}>
              <button
                onClick={() => handleSocialLogin('google')}
                disabled={loading}
                className="py-2.5 bg-noir-800/70 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 text-gray-300 text-sm font-medium rounded-lg disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
              <button
                onClick={() => handleSocialLogin('facebook')}
                disabled={loading}
                className="py-2.5 bg-noir-800/70 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 text-gray-300 text-sm font-medium rounded-lg disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Facebook
              </button>
              <button
                onClick={() => handleSocialLogin('apple')}
                disabled={loading}
                className="py-2.5 bg-noir-800/70 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 text-gray-300 text-sm font-medium rounded-lg disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Apple
              </button>
              <button
                onClick={() => handleSocialLogin('microsoft')}
                disabled={loading}
                className="py-2.5 bg-noir-800/70 hover:bg-noir-700 border border-noir-700 hover:border-noir-600 text-gray-300 text-sm font-medium rounded-lg disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                  <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                  <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                  <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
                </svg>
                Microsoft
              </button>
            </div>

          <p className="text-sm text-gray-400 mt-6 text-center animate-fade-in" style={{ animationDelay: '0.55s' }}>
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
