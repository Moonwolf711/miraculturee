import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useState, type ReactNode } from 'react';

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <div className="relative w-6 h-5 flex flex-col justify-between">
      <span
        className={`block h-px w-full bg-gray-300 transition-all duration-300 origin-center ${
          open ? 'rotate-45 translate-y-[9px]' : ''
        }`}
      />
      <span
        className={`block h-px w-full bg-gray-300 transition-all duration-300 ${
          open ? 'opacity-0 scale-x-0' : ''
        }`}
      />
      <span
        className={`block h-px w-full bg-gray-300 transition-all duration-300 origin-center ${
          open ? '-rotate-45 -translate-y-[9px]' : ''
        }`}
      />
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Film grain overlay */}
      <div className="grain" aria-hidden="true" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-noir-800/60 bg-noir-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="group flex items-baseline gap-0 font-display text-2xl tracking-ultra-wide uppercase"
            onClick={closeMobile}
          >
            <span className="text-amber-500 transition-colors duration-300 group-hover:text-amber-400">
              M
            </span>
            <span className="text-gray-100 transition-colors duration-300 group-hover:text-white">
              iraCulture
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-body">
            <Link to="/events" className="nav-link">
              Events
            </Link>
            {user?.role === 'ARTIST' && (
              <Link to="/artist/dashboard" className="nav-link">
                Dashboard
              </Link>
            )}
            {user ? (
              <div className="flex items-center gap-5">
                <span className="text-gray-500 text-xs tracking-wide uppercase">
                  {user.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="nav-link cursor-pointer"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="nav-link"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="btn-amber"
                >
                  Sign up
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 -mr-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            <HamburgerIcon open={mobileMenuOpen} />
          </button>
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-out-expo ${
            mobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-noir-800/40 flex flex-col gap-1">
            <Link
              to="/events"
              onClick={closeMobile}
              className="py-3 text-gray-400 hover:text-amber-500 transition-colors duration-200 text-sm tracking-wide uppercase font-body"
            >
              Events
            </Link>
            {user?.role === 'ARTIST' && (
              <Link
                to="/artist/dashboard"
                onClick={closeMobile}
                className="py-3 text-gray-400 hover:text-amber-500 transition-colors duration-200 text-sm tracking-wide uppercase font-body"
              >
                Dashboard
              </Link>
            )}
            {user ? (
              <>
                <div className="py-3 text-gray-600 text-xs tracking-wide uppercase">
                  {user.name}
                </div>
                <button
                  onClick={handleLogout}
                  className="py-3 text-left text-gray-400 hover:text-amber-500 transition-colors duration-200 text-sm tracking-wide uppercase font-body"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={closeMobile}
                  className="py-3 text-gray-400 hover:text-amber-500 transition-colors duration-200 text-sm tracking-wide uppercase font-body"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  onClick={closeMobile}
                  className="mt-2 btn-amber text-center"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="relative border-t border-noir-800/40">
        {/* Subtle noise texture on footer */}
        <div
          className="absolute inset-0 bg-noise opacity-[0.02] pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="font-display text-lg tracking-ultra-wide uppercase text-gray-600">
              <span className="text-amber-500/60">M</span>iraCulture
            </div>
            <p className="text-gray-600 text-xs tracking-wide">
              Fan-powered ticket redistribution
            </p>
          </div>
          <div className="mt-6 pt-6 border-t border-noir-800/30 text-center">
            <p className="text-gray-700 text-xs tracking-wide">
              {new Date().getFullYear()} MiraCulture. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
