import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../lib/api.js';

export default function EmailVerifyBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerified || dismissed) return null;

  const resend = async () => {
    setSending(true);
    try {
      await api.post('/auth/resend-verification');
      setSent(true);
    } catch {
      // Fail silently — user can retry
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 text-sm">
        <p className="text-amber-300">
          {sent ? (
            'Verification email sent — check your inbox.'
          ) : (
            <>
              Please verify your email.{' '}
              <button
                onClick={resend}
                disabled={sending}
                className="underline hover:text-amber-200 transition-colors disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Resend verification'}
              </button>
            </>
          )}
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-500/60 hover:text-amber-400 transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
