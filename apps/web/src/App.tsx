import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import Layout from './components/Layout.js';
import ErrorBoundary, { PageErrorFallback } from './components/ErrorBoundary.js';

/* -------------------------------------------------------
   Route-based code splitting with React.lazy()
   - HomePage is eagerly loaded (LCP critical path)
   - All other pages are lazy-loaded into separate chunks
   ------------------------------------------------------- */
import HomePage from './pages/HomePage.js';

const LoginPage = lazy(() => import('./pages/LoginPage.js'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.js'));
const EventsPage = lazy(() => import('./pages/EventsPage.js'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage.js'));
const ArtistDashboardPage = lazy(() => import('./pages/ArtistDashboardPage.js'));
const CreateEventPage = lazy(() => import('./pages/CreateEventPage.js'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.js'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.js'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.js'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.js'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage.js'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage.js'));

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

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <PageFallback />;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return <>{children}</>;
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
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
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
            <Route
              path="/artist/dashboard"
              element={
                <ProtectedRoute role="ARTIST">
                  <ArtistDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/artist/events/new"
              element={
                <ProtectedRoute role="ARTIST">
                  <CreateEventPage />
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
