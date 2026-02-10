import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useState, useEffect, type ReactNode } from 'react';

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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
      <header
        className={`sticky top-0 z-50 border-b border-noir-800/60 bg-noir-950/80 transition-all duration-300 ${
          scrolled ? 'backdrop-blur-2xl' : 'backdrop-blur-xl'
        }`}
      >
        <div
          className={`max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between transition-all duration-300 ${
            scrolled ? 'py-2.5' : 'py-4'
          }`}
        >
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
            <a href="/#how-it-works" className="nav-link">
              How It Works
            </a>
            <a href="/#for-artists" className="nav-link">
              For Artists
            </a>
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
            mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
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
            <a
              href="/#how-it-works"
              onClick={closeMobile}
              className="py-3 text-gray-400 hover:text-amber-500 transition-colors duration-200 text-sm tracking-wide uppercase font-body"
            >
              How It Works
            </a>
            <a
              href="/#for-artists"
              onClick={closeMobile}
              className="py-3 text-gray-400 hover:text-amber-500 transition-colors duration-200 text-sm tracking-wide uppercase font-body"
            >
              For Artists
            </a>
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

      {/* Mobile backdrop overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-backdrop md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="relative border-t border-noir-800/40">
        <div
          className="absolute inset-0 bg-noise opacity-[0.02] pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            {/* Brand column */}
            <div>
              <div className="font-display text-lg tracking-ultra-wide uppercase text-gray-400 mb-3">
                <span className="text-amber-500/70">M</span>iraCulture
              </div>
              <p className="text-gray-600 text-sm leading-relaxed max-w-xs">
                Fan-powered ticket redistribution. No scalpers, no bots — just
                real fans supporting real music.
              </p>
            </div>

            {/* Nav column */}
            <div>
              <h4 className="font-body text-xs tracking-widest uppercase text-gray-500 mb-4 font-semibold">
                Navigate
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/events" className="text-gray-500 hover:text-amber-500 text-sm transition-colors duration-200">
                    Browse Events
                  </Link>
                </li>
                <li>
                  <a href="/#how-it-works" className="text-gray-500 hover:text-amber-500 text-sm transition-colors duration-200">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="/#for-artists" className="text-gray-500 hover:text-amber-500 text-sm transition-colors duration-200">
                    For Artists
                  </a>
                </li>
                <li>
                  <Link to="/register" className="text-gray-500 hover:text-amber-500 text-sm transition-colors duration-200">
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal + social column */}
            <div>
              <h4 className="font-body text-xs tracking-widest uppercase text-gray-500 mb-4 font-semibold">
                Legal
              </h4>
              <ul className="space-y-2 mb-6">
                <li>
                  <span className="text-gray-600 text-sm">Privacy Policy</span>
                </li>
                <li>
                  <span className="text-gray-600 text-sm">Terms of Service</span>
                </li>
              </ul>
              <div className="flex items-center gap-3">
                {/* Social placeholders */}
                {['X', 'IG', 'TT'].map((s) => (
                  <span
                    key={s}
                    className="w-8 h-8 rounded-full border border-noir-700 flex items-center justify-center text-gray-600 text-xs cursor-pointer transition-all duration-300 hover:border-amber-500/50 hover:text-amber-500 hover:-translate-y-0.5"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-noir-800/30 text-center">
            <p className="text-gray-700 text-xs tracking-wide">
              {new Date().getFullYear()} MiraCulture. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
