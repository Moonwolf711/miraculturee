import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import Layout from './components/Layout.js';
import HomePage from './pages/HomePage.js';
import LoginPage from './pages/LoginPage.js';
import RegisterPage from './pages/RegisterPage.js';
import EventsPage from './pages/EventsPage.js';
import EventDetailPage from './pages/EventDetailPage.js';
import ArtistDashboardPage from './pages/ArtistDashboardPage.js';
import CreateEventPage from './pages/CreateEventPage.js';

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
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
      </Routes>
    </Layout>
  );
}
