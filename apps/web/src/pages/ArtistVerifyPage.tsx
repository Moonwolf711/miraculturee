import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';
import SocialConnectButton from '../components/artist/SocialConnectButton.js';
import SocialAccountCard from '../components/artist/SocialAccountCard.js';
import VerificationBadge from '../components/artist/VerificationBadge.js';

interface SocialAccount {
  id: string;
  provider: string;
  providerUsername: string | null;
  profileUrl: string | null;
  followerCount: number | null;
  connectedAt: string;
  lastVerifiedAt: string | null;
}

interface SocialAccountsResponse {
  accounts: SocialAccount[];
  isVerified: boolean;
  verificationStatus: string;
}

export default function ArtistVerifyPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<SocialAccountsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const verified = searchParams.get('verified');
  const errorParam = searchParams.get('error');

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get<SocialAccountsResponse>('/artist/me/social-accounts');
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (verified) {
      setSuccessMsg(`Successfully connected ${verified.charAt(0).toUpperCase() + verified.slice(1)}!`);
    }
    if (errorParam) {
      const messages: Record<string, string> = {
        spotify_denied: 'Spotify authorization was denied.',
        soundcloud_denied: 'SoundCloud authorization was denied.',
        invalid_state: 'Invalid OAuth state. Please try again.',
        spotify_failed: 'Failed to connect Spotify. Please try again.',
        soundcloud_failed: 'Failed to connect SoundCloud. Please try again.',
      };
      setError(messages[errorParam] ?? 'Something went wrong. Please try again.');
    }
  }, [verified, errorParam]);

  const handleDisconnect = async (provider: string) => {
    try {
      await api.delete(`/artist/me/social-accounts/${provider.toLowerCase()}`);
      await fetchAccounts();
      setSuccessMsg(`Disconnected ${provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase()}`);
    } catch {
      setError('Failed to disconnect account');
    }
  };

  const connectedProviders = new Set(data?.accounts.map((a) => a.provider) ?? []);

  return (
    <div className="min-h-screen bg-noir-950 py-16 px-4">
      <SEO title="Verify Your Artist Account" noindex />
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="font-display text-sm tracking-[0.3em] text-amber-500/60 mb-2">
            ARTIST VERIFICATION
          </p>
          <h1 className="font-display text-3xl sm:text-4xl tracking-wider text-warm-50 mb-3">
            VERIFY YOUR IDENTITY
          </h1>
          <p className="font-body text-gray-400 text-sm max-w-md mx-auto">
            Connect at least one music platform to verify your artist identity.
            This helps fans and venues trust your profile.
          </p>
        </div>

        {/* Status messages */}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg mb-6 text-sm">
            {successMsg}
          </div>
        )}
        {error && (
          <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Verification status */}
        {data && (
          <div className="flex items-center justify-center gap-3 mb-8">
            <VerificationBadge verified={data.isVerified} />
            {!data.isVerified && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                Unverified — connect a platform below
              </span>
            )}
          </div>
        )}

        {/* Connected accounts */}
        {data && data.accounts.length > 0 && (
          <div className="mb-8">
            <h2 className="font-body text-xs tracking-widest uppercase text-gray-500 font-semibold mb-3">
              Connected Accounts
            </h2>
            <div className="space-y-3">
              {data.accounts.map((account) => (
                <SocialAccountCard
                  key={account.id}
                  account={account}
                  onDisconnect={() => handleDisconnect(account.provider)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Connect buttons */}
        <div className="bg-noir-900 border border-noir-800 rounded-2xl p-6">
          <h2 className="font-body text-xs tracking-widest uppercase text-gray-500 font-semibold mb-4">
            {data && data.accounts.length > 0 ? 'Connect More Platforms' : 'Connect a Platform'}
          </h2>
          <div className="space-y-3">
            {!connectedProviders.has('SPOTIFY') && (
              <SocialConnectButton provider="spotify" />
            )}
            {!connectedProviders.has('SOUNDCLOUD') && (
              <SocialConnectButton provider="soundcloud" />
            )}
            {connectedProviders.has('SPOTIFY') && connectedProviders.has('SOUNDCLOUD') && (
              <p className="font-body text-gray-500 text-sm text-center py-2">
                All available platforms connected. More coming soon.
              </p>
            )}
          </div>
        </div>

        {/* Next steps */}
        {data?.isVerified && (
          <div className="mt-8 text-center">
            <Link
              to="/artist/dashboard"
              className="btn-amber inline-flex items-center justify-center px-8 py-3 text-sm rounded-sm group"
            >
              <span>Go to Artist Dashboard</span>
              <svg className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '200ms' }} />
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
