import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useScrollSpy } from '../hooks/useScrollSpy.js';
import ConnectionStatus from './ConnectionStatus.js';
import NotificationBell from './NotificationBell.js';
import EmailVerifyBanner from './EmailVerifyBanner.js';
import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';

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

const NAV_SECTIONS = ['how-it-works', 'for-artists'];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isHome = location.pathname === '/';
  const sectionIds = useMemo(() => (isHome ? NAV_SECTIONS : []), [isHome]);
  const activeSection = useScrollSpy(sectionIds);

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

  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Escape key closes mobile menu
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  // Focus trap inside mobile menu
  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !mobileMenuRef.current) return;
    const focusable = mobileMenuRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Skip-to-content accessibility link */}
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>

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

          {/* Connection status indicator — subtle dot for live updates */}
          <ConnectionStatus />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-body" aria-label="Main navigation">
            <Link to="/events" className="nav-link">
              Shows
            </Link>
            <Link to="/events?type=FESTIVAL" className="nav-link">
              Festivals
            </Link>
            <a href="/#how-it-works" className={`nav-link ${activeSection === 'how-it-works' ? 'nav-link-active' : ''}`}>
              How It Works
            </a>
            <a href="/#for-artists" className={`nav-link ${activeSection === 'for-artists' ? 'nav-link-active' : ''}`}>
              For Artists
            </a>
            {user && (
              <Link to="/dashboard" className="nav-link">
                My Dashboard
              </Link>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <NotificationBell />
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
            ref={hamburgerRef}
            className="md:hidden p-2 -mr-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
          >
            <HamburgerIcon open={mobileMenuOpen} />
          </button>
        </div>

        {/* Mobile menu */}
        <nav
          id="mobile-nav-menu"
          ref={mobileMenuRef}
          role="navigation"
          aria-label="Mobile navigation"
          className={`md:hidden overflow-hidden transition-all duration-300 ease-out-expo ${
            mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
          onKeyDown={handleMenuKeyDown}
        >
          <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-noir-800/40 flex flex-col gap-1">
            <Link
              to="/events"
              onClick={closeMobile}
              className="py-3 text-gray-400 hover:text-amber-500 transition-colors duration-200 text-sm tracking-wide uppercase font-body"
            >
              Shows
            </Link>
            <Link
              to="/events?type=FESTIVAL"
              onClick={closeMobile}
              className="py-3 text-gray-400 hover:text-amber-500 transition-colors duration-200 text-sm tracking-wide uppercase font-body"
            >
              Festivals
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
            {user && (
              <Link
                to="/dashboard"
                onClick={closeMobile}
                className="py-3 text-gray-400 hover:text-amber-500 transition-colors duration-200 text-sm tracking-wide uppercase font-body"
              >
                My Dashboard
              </Link>
            )}
            {user ? (
              <>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-gray-500 text-xs tracking-wide uppercase">{user.name}</span>
                  <NotificationBell />
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
        </nav>
      </header>

      {/* Mobile backdrop overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-backdrop md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Email verification banner */}
      <EmailVerifyBanner />

      {/* Main content */}
      <main id="main-content" className="flex-1">{children}</main>

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
              <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
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
                    Browse Shows
                  </Link>
                </li>
                <li>
                  <Link to="/events?type=FESTIVAL" className="text-gray-500 hover:text-amber-500 text-sm transition-colors duration-200">
                    Festivals
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
                  <Link to="/privacy" className="text-gray-500 hover:text-amber-500 text-sm transition-colors duration-200">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-gray-500 hover:text-amber-500 text-sm transition-colors duration-200">
                    Terms of Service
                  </Link>
                </li>
              </ul>
              <div className="flex items-center gap-3" role="list" aria-label="Social media links">
                {/* Social placeholders */}
                {([
                  { abbr: 'X', label: 'X (Twitter)' },
                  { abbr: 'IG', label: 'Instagram' },
                  { abbr: 'TT', label: 'TikTok' },
                ] as const).map((s) => (
                  <a
                    key={s.abbr}
                    href="#"
                    role="listitem"
                    aria-label={s.label}
                    className="w-8 h-8 rounded-full border border-noir-700 flex items-center justify-center text-gray-400 text-xs transition-all duration-300 hover:border-amber-500/50 hover:text-amber-500 hover:-translate-y-0.5"
                  >
                    {s.abbr}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-noir-800/30 text-center">
            <p className="text-gray-500 text-xs tracking-wide">
              &copy; {new Date().getFullYear()} MiraCulture. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
