import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import SEO from '../components/SEO.js';
import { PageError, StatsSkeleton } from '../components/LoadingStates.js';

interface CampaignEarnings {
  campaignId: string;
  eventTitle: string;
  eventDate: string;
  campaignStatus: string;
  fundedCents: number;
  platformFeeCents: number;
  artistEarningsCents: number;
  paidOutCents: number;
  availableCents: number;
  eligible: boolean;
  eligibilityReason?: string;
}

interface PayoutRecord {
  id: string;
  campaignId: string | null;
  eventTitle: string;
  amountCents: number;
  status: string;
  createdAt: string;
}

interface PayoutSummary {
  totalEarningsCents: number;
  totalPaidOutCents: number;
  totalAvailableCents: number;
  connectAccountStatus: 'none' | 'pending' | 'ready';
  campaigns: CampaignEarnings[];
  payoutHistory: PayoutRecord[];
}

export default function ArtistEarningsPage() {
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const fetchSummary = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    api.get<PayoutSummary>('/artist/payouts')
      .then(setSummary)
      .catch((err: Error) => setFetchError(err.message || 'Failed to load earnings.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  async function handleRequestPayout(campaignId: string) {
    setRequestingId(campaignId);
    setRequestError(null);
    try {
      await api.post('/artist/payouts/request', { campaignId });
      fetchSummary();
    } catch (err) {
      setRequestError((err as Error).message || 'Payout request failed.');
    } finally {
      setRequestingId(null);
    }
  }

  /* ---------- Loading skeleton ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-noir-950">
        <SEO title="Earnings" description="Loading earnings..." noindex />
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-8">
            <div className="h-8 w-48 bg-noir-800 rounded animate-pulse" />
            <div className="h-10 w-32 bg-noir-800 rounded-lg animate-pulse" />
          </div>
          <StatsSkeleton count={3} />
          <div className="h-6 w-40 bg-noir-800 rounded animate-pulse mb-4 mt-6" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-noir-800 border border-noir-700 rounded-xl p-5 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="space-y-2">
                    <div className="h-5 w-48 bg-noir-700 rounded" />
                    <div className="h-4 w-36 bg-noir-700 rounded" />
                  </div>
                  <div className="h-9 w-28 bg-noir-700 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) return <PageError message={fetchError} onRetry={fetchSummary} />;
  if (!summary) return <PageError message="Failed to load earnings data." onRetry={fetchSummary} />;

  return (
    <div className="min-h-screen bg-noir-950">
      <SEO
        title="Earnings & Payouts"
        description="View your campaign earnings and request payouts."
        noindex
      />
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl tracking-wider text-warm-50">
            EARNINGS
          </h1>
          <Link
            to="/artist/dashboard"
            className="px-5 py-2.5 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-semibold rounded-lg text-sm transition-colors"
          >
            Dashboard
          </Link>
        </div>

        {/* Balance Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5">
            <div className="font-display text-3xl text-warm-50">
              {formatPrice(summary.totalEarningsCents)}
            </div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Total Earned</div>
          </div>
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5">
            <div className="font-display text-3xl text-warm-50">
              {formatPrice(summary.totalPaidOutCents)}
            </div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Paid Out</div>
          </div>
          <div className="bg-noir-800 border border-noir-700 rounded-xl p-5">
            <div className="font-display text-3xl text-amber-400">
              {formatPrice(summary.totalAvailableCents)}
            </div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">Available</div>
          </div>
        </div>

        {/* Connect Status Banner */}
        {summary.connectAccountStatus !== 'ready' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 mb-8 flex items-center justify-between">
            <div>
              <h3 className="text-amber-400 font-semibold text-sm">
                {summary.connectAccountStatus === 'none'
                  ? 'Set Up Stripe to Receive Payouts'
                  : 'Complete Stripe Onboarding'}
              </h3>
              <p className="text-gray-400 text-sm font-body mt-1">
                {summary.connectAccountStatus === 'none'
                  ? 'Connect a Stripe account so you can receive your earnings.'
                  : 'Your Stripe account setup is incomplete. Finish onboarding to enable payouts.'}
              </p>
            </div>
            <Link
              to="/connect/dashboard"
              className="px-4 py-2 bg-amber-400 text-noir-950 font-semibold rounded-lg text-sm hover:bg-amber-300 transition-colors shrink-0"
            >
              {summary.connectAccountStatus === 'none' ? 'Set Up Stripe' : 'Complete Setup'}
            </Link>
          </div>
        )}

        {/* Request error banner */}
        {requestError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <p className="text-red-400 text-sm">{requestError}</p>
          </div>
        )}

        {/* Campaign Earnings */}
        <h2 className="font-display text-xl tracking-wider text-warm-50 mb-4">
          CAMPAIGN EARNINGS
        </h2>
        {summary.campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-noir-800 border border-noir-700 rounded-xl mb-10">
            <h3 className="font-display text-lg tracking-wider text-gray-500 mb-2">
              NO CAMPAIGNS YET
            </h3>
            <p className="text-gray-400 text-sm font-body">
              Campaign earnings will appear here once you have active campaigns.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-10">
            {summary.campaigns.map((c) => (
              <div
                key={c.campaignId}
                className="bg-noir-800 border border-noir-700 rounded-xl p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-warm-50 font-medium truncate">{c.eventTitle}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold shrink-0 ${
                        c.campaignStatus === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : c.campaignStatus === 'DRAFT' ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                            : 'bg-noir-700 text-gray-500 border border-noir-600'
                      }`}>
                        {c.campaignStatus}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 font-body">{formatDate(c.eventDate)}</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm font-body">
                      <span className="text-gray-400">
                        Funded: <span className="text-warm-50">{formatPrice(c.fundedCents)}</span>
                      </span>
                      <span className="text-gray-400">
                        Fee: <span className="text-warm-50">{formatPrice(c.platformFeeCents)}</span>
                      </span>
                      <span className="text-gray-400">
                        Earned: <span className="text-amber-400">{formatPrice(c.artistEarningsCents)}</span>
                      </span>
                      <span className="text-gray-400">
                        Paid: <span className="text-warm-50">{formatPrice(c.paidOutCents)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="text-right mb-1">
                      <div className="font-display text-lg text-amber-400">{formatPrice(c.availableCents)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400">available</div>
                    </div>
                    {c.eligible ? (
                      <button
                        onClick={() => handleRequestPayout(c.campaignId)}
                        disabled={requestingId === c.campaignId}
                        className="px-4 py-2 bg-amber-400 text-noir-950 font-semibold rounded-lg text-sm hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-wait"
                      >
                        {requestingId === c.campaignId ? 'Requesting...' : 'Request Payout'}
                      </button>
                    ) : (
                      <div className="group relative">
                        <button
                          disabled
                          className="px-4 py-2 border border-noir-600 text-gray-500 rounded-lg text-sm cursor-not-allowed"
                        >
                          Request Payout
                        </button>
                        {c.eligibilityReason && (
                          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-noir-700 border border-noir-600 rounded-lg text-xs text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {c.eligibilityReason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payout History */}
        <h2 className="font-display text-xl tracking-wider text-warm-50 mb-4">
          PAYOUT HISTORY
        </h2>
        {summary.payoutHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-noir-800 border border-noir-700 rounded-xl">
            <h3 className="font-display text-lg tracking-wider text-gray-500 mb-2">
              NO PAYOUTS YET
            </h3>
            <p className="text-gray-400 text-sm font-body">
              Your payout history will appear here after your first payout.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {summary.payoutHistory.map((p) => (
              <div
                key={p.id}
                className="bg-noir-800 border border-noir-700 rounded-xl p-5 flex items-center justify-between"
              >
                <div>
                  <h3 className="text-warm-50 font-medium">{p.eventTitle}</h3>
                  <p className="text-sm text-gray-400 font-body mt-1">{formatDate(p.createdAt)}</p>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg text-amber-400">{formatPrice(p.amountCents)}</div>
                  <span className={`text-[10px] uppercase tracking-wider font-semibold ${
                    p.status === 'completed' ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
