import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';

interface ConnectedAccount {
  id: string;
  stripeAccountId: string;
  displayName: string;
  onboardingComplete: boolean;
  paymentsEnabled: boolean;
  subscription: { status: string; cancelAtPeriodEnd: boolean } | null;
}

interface AccountStatus {
  accountId: string;
  readyToProcessPayments: boolean;
  onboardingComplete: boolean;
  requirementsStatus: string;
}

interface SubscriptionInfo {
  id: string;
  status: string;
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export default function ConnectDashboardPage() {
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(
    searchParams.get('accountId'),
  );
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create account form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Create product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productPrice, setProductPrice] = useState('');

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get<{ accounts: ConnectedAccount[] }>('/connect/my-accounts');
      setAccounts(res.accounts);
      if (!selectedAccount && res.accounts.length > 0) {
        setSelectedAccount(res.accounts[0].stripeAccountId);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount]);

  const fetchStatus = useCallback(async (accountId: string) => {
    try {
      const res = await api.get<AccountStatus>(`/connect/accounts/${accountId}/status`);
      setAccountStatus(res);
    } catch {
      // non-critical
    }
  }, []);

  const fetchSubscription = useCallback(async (accountId: string) => {
    try {
      const res = await api.get<{ subscription: SubscriptionInfo | null }>(
        `/connect/accounts/${accountId}/subscription`,
      );
      setSubscription(res.subscription);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (selectedAccount) {
      fetchStatus(selectedAccount);
      fetchSubscription(selectedAccount);
    }
  }, [selectedAccount, fetchStatus, fetchSubscription]);

  const handleCreateAccount = async () => {
    if (!displayName || !contactEmail) return;
    setActionLoading('create');
    try {
      const res = await api.post<{ accountId: string }>('/connect/accounts', {
        displayName,
        contactEmail,
      });
      setSelectedAccount(res.accountId);
      setShowCreateForm(false);
      setDisplayName('');
      setContactEmail('');
      await fetchAccounts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOnboard = async () => {
    if (!selectedAccount) return;
    setActionLoading('onboard');
    try {
      const res = await api.post<{ url: string }>(
        `/connect/accounts/${selectedAccount}/onboarding-link`,
      );
      window.location.href = res.url;
    } catch (err: any) {
      setError(err.message);
      setActionLoading(null);
    }
  };

  const handleCreateProduct = async () => {
    if (!selectedAccount || !productName || !productPrice) return;
    setActionLoading('product');
    try {
      await api.post(`/connect/accounts/${selectedAccount}/products`, {
        name: productName,
        description: productDesc || undefined,
        priceInCents: Math.round(parseFloat(productPrice) * 100),
      });
      setShowProductForm(false);
      setProductName('');
      setProductDesc('');
      setProductPrice('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedAccount) return;
    setActionLoading('subscribe');
    try {
      const res = await api.post<{ url: string }>(
        `/connect/accounts/${selectedAccount}/subscribe`,
      );
      window.location.href = res.url;
    } catch (err: any) {
      setError(err.message);
      setActionLoading(null);
    }
  };

  const handleBillingPortal = async () => {
    if (!selectedAccount) return;
    setActionLoading('billing');
    try {
      const res = await api.post<{ url: string }>(
        `/connect/accounts/${selectedAccount}/billing-portal`,
      );
      window.location.href = res.url;
    } catch (err: any) {
      setError(err.message);
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-noir-950">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="h-8 w-64 bg-noir-800 rounded animate-pulse mb-8" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-noir-800 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentAccount = accounts.find((a) => a.stripeAccountId === selectedAccount);

  return (
    <div className="min-h-screen bg-noir-950">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl tracking-wider text-warm-50">
            STRIPE CONNECT
          </h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg text-sm transition-colors"
          >
            {showCreateForm ? 'Cancel' : 'Create Account'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-red-300 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Create Account Form */}
        {showCreateForm && (
          <div className="mb-8 bg-noir-800 border border-noir-700 rounded-xl p-6">
            <h2 className="font-display text-lg tracking-wider text-warm-50 mb-4">
              CREATE CONNECTED ACCOUNT
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your business or artist name"
                  className="w-full px-4 py-2.5 bg-noir-900 border border-noir-600 rounded-lg text-warm-50 placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2.5 bg-noir-900 border border-noir-600 rounded-lg text-warm-50 placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleCreateAccount}
                disabled={actionLoading === 'create' || !displayName || !contactEmail}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-noir-700 disabled:text-gray-500 text-noir-950 font-semibold rounded-lg text-sm transition-colors"
              >
                {actionLoading === 'create' ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </div>
        )}

        {/* No accounts */}
        {accounts.length === 0 && !showCreateForm && (
          <div className="flex flex-col items-center justify-center py-16 bg-noir-800 border border-noir-700 rounded-xl">
            <div className="w-14 h-14 rounded-full border-2 border-noir-700 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <h3 className="font-display text-lg tracking-wider text-gray-500 mb-2">
              NO CONNECTED ACCOUNTS
            </h3>
            <p className="text-gray-400 text-sm font-body mb-5">
              Create a Stripe Connect account to start accepting payments.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg text-sm transition-colors"
            >
              Create Account
            </button>
          </div>
        )}

        {/* Account Selector (if multiple) */}
        {accounts.length > 1 && (
          <div className="mb-6">
            <select
              value={selectedAccount || ''}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-4 py-2.5 bg-noir-800 border border-noir-700 rounded-lg text-warm-50 focus:border-amber-500 focus:outline-none"
            >
              {accounts.map((a) => (
                <option key={a.stripeAccountId} value={a.stripeAccountId}>
                  {a.displayName} ({a.stripeAccountId})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Account Details */}
        {currentAccount && (
          <div className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-noir-800 border border-noir-700 rounded-xl p-5">
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Account</div>
                <div className="text-warm-50 font-medium truncate">{currentAccount.displayName}</div>
                <div className="text-xs text-gray-500 mt-1 font-mono">{currentAccount.stripeAccountId}</div>
              </div>
              <div className="bg-noir-800 border border-noir-700 rounded-xl p-5">
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Onboarding</div>
                <div className={`font-display text-lg ${accountStatus?.onboardingComplete ? 'text-green-400' : 'text-amber-400'}`}>
                  {accountStatus?.onboardingComplete ? 'COMPLETE' : 'PENDING'}
                </div>
              </div>
              <div className="bg-noir-800 border border-noir-700 rounded-xl p-5">
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Payments</div>
                <div className={`font-display text-lg ${accountStatus?.readyToProcessPayments ? 'text-green-400' : 'text-red-400'}`}>
                  {accountStatus?.readyToProcessPayments ? 'ENABLED' : 'DISABLED'}
                </div>
              </div>
            </div>

            {/* Onboarding CTA */}
            {!accountStatus?.onboardingComplete && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6">
                <h3 className="font-display text-lg tracking-wider text-amber-400 mb-2">
                  COMPLETE ONBOARDING
                </h3>
                <p className="text-gray-300 text-sm font-body mb-4">
                  Complete Stripe onboarding to start accepting payments and create products.
                </p>
                <button
                  onClick={handleOnboard}
                  disabled={actionLoading === 'onboard'}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-noir-700 text-noir-950 font-semibold rounded-lg text-sm transition-colors"
                >
                  {actionLoading === 'onboard' ? 'Redirecting...' : 'Start Onboarding'}
                </button>
              </div>
            )}

            {/* Products Section */}
            {accountStatus?.onboardingComplete && (
              <div className="bg-noir-800 border border-noir-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg tracking-wider text-warm-50">
                    PRODUCTS
                  </h3>
                  <button
                    onClick={() => setShowProductForm(!showProductForm)}
                    className="px-4 py-2 bg-noir-700 hover:bg-noir-600 text-warm-50 text-sm rounded-lg transition-colors"
                  >
                    {showProductForm ? 'Cancel' : '+ Add Product'}
                  </button>
                </div>

                {showProductForm && (
                  <div className="space-y-3 mb-4 p-4 bg-noir-900 rounded-lg">
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="Product name"
                      className="w-full px-3 py-2 bg-noir-800 border border-noir-600 rounded-lg text-warm-50 placeholder-gray-500 text-sm focus:border-amber-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={productDesc}
                      onChange={(e) => setProductDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-3 py-2 bg-noir-800 border border-noir-600 rounded-lg text-warm-50 placeholder-gray-500 text-sm focus:border-amber-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      placeholder="Price in USD (e.g. 29.99)"
                      step="0.01"
                      min="0.50"
                      className="w-full px-3 py-2 bg-noir-800 border border-noir-600 rounded-lg text-warm-50 placeholder-gray-500 text-sm focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={handleCreateProduct}
                      disabled={actionLoading === 'product' || !productName || !productPrice}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-noir-700 disabled:text-gray-500 text-noir-950 font-semibold rounded-lg text-sm transition-colors"
                    >
                      {actionLoading === 'product' ? 'Creating...' : 'Create Product'}
                    </button>
                  </div>
                )}

                <p className="text-gray-400 text-sm font-body">
                  Products are created on your Stripe account.{' '}
                  <a
                    href={`/connect/storefront/${selectedAccount}`}
                    className="text-amber-400 hover:text-amber-300 underline"
                  >
                    View your storefront
                  </a>
                </p>
              </div>
            )}

            {/* Subscription Section */}
            <div className="bg-noir-800 border border-noir-700 rounded-xl p-6">
              <h3 className="font-display text-lg tracking-wider text-warm-50 mb-4">
                SUBSCRIPTION
              </h3>
              {subscription ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Status</span>
                    <span className={`font-medium text-sm ${subscription.status === 'active' ? 'text-green-400' : 'text-amber-400'}`}>
                      {subscription.status.toUpperCase()}
                      {subscription.cancelAtPeriodEnd && ' (cancels at period end)'}
                    </span>
                  </div>
                  {subscription.currentPeriodEnd && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Current Period Ends</span>
                      <span className="text-warm-50 text-sm">
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleBillingPortal}
                    disabled={actionLoading === 'billing'}
                    className="w-full mt-2 px-5 py-2.5 bg-noir-700 hover:bg-noir-600 text-warm-50 font-semibold rounded-lg text-sm transition-colors"
                  >
                    {actionLoading === 'billing' ? 'Redirecting...' : 'Manage Subscription'}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-gray-400 text-sm font-body mb-4">
                    Subscribe to MiraCulture to unlock premium features.
                  </p>
                  <button
                    onClick={handleSubscribe}
                    disabled={actionLoading === 'subscribe'}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-noir-700 text-noir-950 font-semibold rounded-lg text-sm transition-colors"
                  >
                    {actionLoading === 'subscribe' ? 'Redirecting...' : 'Subscribe Now'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
