import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-brand-600">
            MiraCulture
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/events" className="text-gray-600 hover:text-gray-900">
              Events
            </Link>
            {user?.role === 'ARTIST' && (
              <Link to="/artist/dashboard" className="text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-gray-500">{user.name}</span>
                <button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="text-gray-500 hover:text-gray-900"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-gray-600 hover:text-gray-900"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                >
                  Sign up
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-400">
        MiraCulture — Fan-powered ticket redistribution
      </footer>
    </div>
  );
}
