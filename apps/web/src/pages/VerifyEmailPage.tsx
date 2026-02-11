import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';
import SEO from '../components/SEO.js';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const { refreshUser } = useAuth();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No verification token provided.');
      return;
    }

    api
      .post('/auth/verify-email', { token })
      .then(() => {
        setStatus('success');
        refreshUser?.();
      })
      .catch((err: any) => {
        setStatus('error');
        setError(err.message || 'Verification failed.');
      });
  }, [token, refreshUser]);

  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4 py-16">
      <SEO title="Verify Email" noindex />
      <div className="w-full max-w-md">
        <div className="bg-noir-900 border border-noir-800 rounded-2xl p-8 shadow-2xl text-center">
          {status === 'loading' && (
            <>
              <h1 className="font-display text-3xl tracking-wider text-warm-50 mb-4">
                VERIFYING...
              </h1>
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '200ms' }} />
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '400ms' }} />
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <h1 className="font-display text-3xl tracking-wider text-warm-50 mb-4">
                EMAIL VERIFIED
              </h1>
              <p className="text-gray-400 mb-6">
                Your email has been verified successfully. You now have full access to your account.
              </p>
              <Link to="/events" className="btn-amber inline-block">
                Browse Events
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <h1 className="font-display text-3xl tracking-wider text-warm-50 mb-4">
                VERIFICATION FAILED
              </h1>
              <p className="text-red-400 mb-6">{error}</p>
              <Link to="/events" className="btn-amber inline-block">
                Go to Events
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
