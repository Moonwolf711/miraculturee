import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import Layout from './components/Layout.js';
import ErrorBoundary, { PageErrorFallback } from './components/ErrorBoundary.js';

/* -------------------------------------------------------
   Route-based code splitting with React.lazy()
   - HomePage is eagerly loaded (LCP critical path)
   - All other pages are lazy-loaded into separate chunks
   - lazyRetry auto-reloads on stale chunk errors after deploy
   ------------------------------------------------------- */
import HomePage from './pages/HomePage.js';

function lazyRetry<T extends React.ComponentType>(
  loader: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    loader().catch(() => {
      window.location.reload();
      return new Promise<never>(() => {});
    }),
  );
}

const LoginPage = lazyRetry(() => import('./pages/LoginPage.js'));
const RegisterPage = lazyRetry(() => import('./pages/RegisterPage.js'));
const EventsPage = lazyRetry(() => import('./pages/EventsPage.js'));
const EventDetailPage = lazyRetry(() => import('./pages/EventDetailPage.js'));
const ArtistDashboardPage = lazyRetry(() => import('./pages/ArtistDashboardPage.js'));
const DashboardPage = lazyRetry(() => import('./pages/DashboardPage.js'));
const ForgotPasswordPage = lazyRetry(() => import('./pages/ForgotPasswordPage.js'));
const ResetPasswordPage = lazyRetry(() => import('./pages/ResetPasswordPage.js'));
const VerifyEmailPage = lazyRetry(() => import('./pages/VerifyEmailPage.js'));
const NotFoundPage = lazyRetry(() => import('./pages/NotFoundPage.js'));
const PrivacyPolicyPage = lazyRetry(() => import('./pages/PrivacyPolicyPage.js'));
const TermsOfServicePage = lazyRetry(() => import('./pages/TermsOfServicePage.js'));
const CreateCampaignPage = lazyRetry(() => import('./pages/CreateCampaignPage.js'));
const ConnectDashboardPage = lazyRetry(() => import('./pages/ConnectDashboardPage.js'));
const StorefrontPage = lazyRetry(() => import('./pages/StorefrontPage.js'));
const AdminPage = lazyRetry(() => import('./pages/AdminPage.js'));
const ArtistRegisterPage = lazyRetry(() => import('./pages/ArtistRegisterPage.js'));
const ArtistVerifyPage = lazyRetry(() => import('./pages/ArtistVerifyPage.js'));
const InviteRedirectPage = lazyRetry(() => import('./pages/InviteRedirectPage.js'));
const ArtistEarningsPage = lazyRetry(() => import('./pages/ArtistEarningsPage.js'));
const DevInviteAcceptPage = lazyRetry(() => import('./pages/DevInviteAcceptPage.js'));
const AgentMarketplacePage = lazyRetry(() => import('./pages/AgentMarketplacePage.js'));
const AgentRegisterPage = lazyRetry(() => import('./pages/AgentRegisterPage.js'));
const AgentDashboardPage = lazyRetry(() => import('./pages/AgentDashboardPage.js'));
const ManagerAcceptPage = lazyRetry(() => import('./pages/ManagerAcceptPage.js'));
const ManagerDashboardPage = lazyRetry(() => import('./pages/ManagerDashboardPage.js'));
const LocalArtistRegisterPage = lazyRetry(() => import('./pages/LocalArtistRegisterPage.js'));
const LocalArtistDashboardPage = lazyRetry(() => import('./pages/LocalArtistDashboardPage.js'));
const LocalArtistMarketplacePage = lazyRetry(() => import('./pages/LocalArtistMarketplacePage.js'));
const AccountPage = lazyRetry(() => import('./pages/AccountPage.js'));
const ArtistProfilePage = lazyRetry(() => import('./pages/ArtistProfilePage.js'));
const OutreachDashboardPage = lazyRetry(() => import('./pages/OutreachDashboardPage.js'));

/**
 * Minimal loading fallback that reserves vertical space to prevent CLS.
 * Matches the min-height of page containers so layout does not shift.
 */
function PageFallback() {
  return (
    <div
      className="min-h-screen bg-noir-950 flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
          style={{ animationDelay: '0ms' }}
        />
        <div
          className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
          style={{ animationDelay: '200ms' }}
        />
        <div
          className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
          style={{ animationDelay: '400ms' }}
        />
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageFallback />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageFallback />;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'ADMIN' && user.role !== 'DEVELOPER') return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function OAuthCallback() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (code) {
      // Exchange the short-lived code for tokens via POST (tokens never in URL)
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      fetch(`${apiBase}/auth/exchange-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Code exchange failed');
          return res.json();
        })
        .then((tokens: { accessToken: string; refreshToken: string }) => {
          localStorage.setItem('accessToken', tokens.accessToken);
          localStorage.setItem('refreshToken', tokens.refreshToken);
          return refreshUser();
        })
        .then(() => navigate('/events', { replace: true }))
        .catch(() => {
          navigate('/login', { replace: true, state: { oauthError: 'Login failed. Please try again.' } });
        });
    } else {
      const errorMessages: Record<string, string> = {
        google_denied: 'Google login was cancelled.',
        google_failed: 'Google login failed. Please try again.',
        facebook_denied: 'Facebook login was cancelled.',
        facebook_failed: 'Facebook login failed. Please try again.',
        facebook_no_email: 'Facebook did not provide an email address.',
        apple_denied: 'Apple login was cancelled.',
        apple_failed: 'Apple login failed. Please try again.',
        apple_no_email: 'Apple did not provide an email address.',
        microsoft_denied: 'Microsoft login was cancelled.',
        microsoft_failed: 'Microsoft login failed. Please try again.',
        microsoft_no_email: 'Microsoft did not provide an email address.',
        invalid_state: 'Login session expired. Please try again.',
      };
      const msg = error ? errorMessages[error] || `Login failed: ${error}` : 'Login failed. Please try again.';
      navigate('/login', { replace: true, state: { oauthError: msg } });
    }
  }, [navigate, refreshUser]);
  return <PageFallback />;
}

export default function App() {
  return (
    <Layout>
      {/* Top-level error boundary catches crashes in any page */}
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <PageErrorFallback error={error} reset={reset} />
        )}
      >
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/artist/register" element={<ArtistRegisterPage />} />
            <Route
              path="/artist/verify"
              element={
                <ProtectedRoute>
                  <ArtistVerifyPage />
                </ProtectedRoute>
              }
            />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/invite/:token" element={<InviteRedirectPage />} />
            <Route path="/dev-invite/:token" element={<DevInviteAcceptPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route
              path="/artist/dashboard"
              element={
                <ProtectedRoute>
                  <ArtistDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artist/earnings"
              element={
                <ProtectedRoute>
                  <ArtistEarningsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artist/campaigns/new"
              element={
                <AdminRoute>
                  <CreateCampaignPage />
                </AdminRoute>
              }
            />
            <Route
              path="/connect/dashboard"
              element={
                <ProtectedRoute>
                  <ConnectDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="/connect/storefront/:accountId" element={<StorefrontPage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
            <Route path="/agents" element={<AgentMarketplacePage />} />
            <Route
              path="/agents/register"
              element={
                <ProtectedRoute>
                  <AgentRegisterPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agents/dashboard"
              element={
                <ProtectedRoute>
                  <AgentDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="/manager/accept/:token" element={<ManagerAcceptPage />} />
            <Route
              path="/manager/dashboard"
              element={
                <ProtectedRoute>
                  <ManagerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="/local-artists" element={<LocalArtistMarketplacePage />} />
            <Route
              path="/local-artists/register"
              element={
                <ProtectedRoute>
                  <LocalArtistRegisterPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/local-artists/dashboard"
              element={
                <ProtectedRoute>
                  <LocalArtistDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="/artists/:id" element={<ArtistProfilePage />} />
            <Route
              path="/admin/outreach"
              element={
                <AdminRoute>
                  <OutreachDashboardPage />
                </AdminRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />
            {/* Catch-all 404 route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
}
