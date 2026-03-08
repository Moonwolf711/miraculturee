import { Link } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { useInView } from '../hooks/useInView.js';
import SEO, { getOrganizationSchema } from '../components/SEO.js';
import { api } from '../lib/api.js';
import type { EventSummary, PaginatedResponse } from '@miraculturee/shared';

/* -------------------------------------------------------
   Reduced Motion Hook — respects prefers-reduced-motion
   (UX Guideline #9, #99)
   ------------------------------------------------------- */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/* -------------------------------------------------------
   Animated Counter — counts up to target for social proof
   ------------------------------------------------------- */
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const { ref, inView } = useInView();
  const [count, setCount] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!inView) return;
    if (reduced) { setCount(target); return; }
    let frame: number;
    const duration = 1500;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, target, reduced]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* -------------------------------------------------------
   Ticker Status Config
   ------------------------------------------------------- */
const STATUS_CONFIG = {
  'sold-out': { color: 'bg-red-500', label: 'SOLD OUT' },
  open: { color: 'bg-emerald-500', label: 'RAFFLE OPEN' },
  active: { color: 'bg-amber-500', label: 'ACTIVE' },
  new: { color: 'bg-sky-500', label: 'JUST ANNOUNCED' },
  upcoming: { color: 'bg-gray-500', label: 'COMING SOON' },
} as const;

type TickerStatus = keyof typeof STATUS_CONFIG;

/** Derive a ticker status from an event's data */
function deriveTickerStatus(ev: EventSummary): TickerStatus {
  if (ev.supportedTickets >= ev.totalTickets) return 'sold-out';
  const spotsLeft = ev.totalTickets - ev.supportedTickets;
  if (spotsLeft <= 20 && spotsLeft > 0) return 'active';
  const eventDate = new Date(ev.date);
  const now = new Date();
  const daysUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntil <= 3) return 'open';
  if (daysUntil <= 7) return 'new';
  return 'upcoming';
}

/** Build ticker text from an event */
function buildTickerText(ev: EventSummary): string {
  const spotsLeft = ev.totalTickets - ev.supportedTickets;
  const status = deriveTickerStatus(ev);
  let text = `${ev.artistName} — ${ev.venueCity}`;
  if (status === 'active' && spotsLeft > 0 && spotsLeft <= 20) {
    text += ` — ${spotsLeft} spots left`;
  }
  return text;
}

/** Estimated show duration in ms — used to filter out ended events */
const SHOW_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Check if an event has ended (start + 6h < now) */
function hasEventEnded(ev: EventSummary): boolean {
  return new Date(ev.date).getTime() + SHOW_DURATION_MS < Date.now();
}

/** Fetch live events for the ticker, refresh every 60s */
function useTickerEvents() {
  const [events, setEvents] = useState<{ text: string; status: TickerStatus }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      // dateFrom = 6h ago so the API still returns in-progress shows
      const sixHoursAgo = new Date(Date.now() - SHOW_DURATION_MS).toISOString();
      const res = await api.get<PaginatedResponse<EventSummary>>(
        `/events?page=1&limit=12&sort=popular,date&dateFrom=${sixHoursAgo}`,
      );
      setEvents(
        res.data
          .filter((ev) => !hasEventEnded(ev))
          .map((ev) => ({
            text: buildTickerText(ev),
            status: deriveTickerStatus(ev),
          })),
      );
    } catch {
      // Silently fail — ticker is decorative
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 60_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return { events, loading };
}


const STEPS = [
  {
    num: 1,
    title: 'DISCOVER',
    desc: 'Browse live shows near you or across the globe. Every event is artist-approved and priced at face value.',
    icon: (
      <svg className="w-7 h-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    num: 2,
    title: 'SUPPORT',
    desc: 'Buy a ticket to back your favorite artist — even if you can\'t attend. 100% of your purchase goes directly to them.',
    icon: (
      <svg className="w-7 h-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  {
    num: 3,
    title: 'ENTER',
    desc: 'Local fans enter a $5 raffle. Geo-verification ensures only people who can actually attend are eligible.',
    icon: (
      <svg className="w-7 h-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    ),
  },
  {
    num: 4,
    title: 'WIN',
    desc: 'Winners are picked by a cryptographically fair algorithm — publicly verifiable, tamper-proof, zero bias.',
    icon: (
      <svg className="w-7 h-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
];



const CAMPAIGN_STEPS = [
  {
    num: 1,
    title: 'LAUNCH A CAMPAIGN',
    desc: 'Pick an upcoming show and set a goal. The goal is simple: 10 tickets \u00d7 the face value. That\u2019s the donation target your fans need to hit.',
  },
  {
    num: 2,
    title: 'FANS DONATE',
    desc: 'Fans from anywhere in the world donate to your campaign \u2014 even fans who can\u2019t attend. 100% of donations go directly to you. Share your campaign link on social media to build momentum.',
  },
  {
    num: 3,
    title: 'TICKETS UNLOCK',
    desc: 'When donations hit your goal, 10 tickets unlock at just $5\u2013$10 each. Only fans verified as local to your venue can purchase them. No bots, no scalpers, no VPNs.',
  },
  {
    num: 4,
    title: 'SURPLUS GROWS',
    desc: 'Donations don\u2019t stop at the goal. Every extra dollar keeps coming in until the day before the show. If it\u2019s not sold out, surplus buys more raffle tickets. If it is \u2014 the surplus is your bonus.',
  },
  {
    num: 5,
    title: 'SHOW DAY',
    desc: 'If the goal wasn\u2019t fully reached in time, whatever was funded gets raffled to subscribers. Either way, you earned every dollar directly. No middlemen. No 40% cuts.',
  },
];

const FAQ_ITEMS = [
  {
    q: 'How do artist campaigns work?',
    a: 'Artists launch a campaign tied to an upcoming show. The goal equals 10 tickets multiplied by the face value. Fans from anywhere donate to reach that goal \u2014 and 100% goes to the artist. Once the goal is hit, 10 tickets unlock at $5\u2013$10 for verified local fans only. Any surplus beyond the goal either buys extra raffle tickets or becomes a direct artist bonus if the show is sold out.',
  },
  {
    q: 'How does the $5 raffle work?',
    a: 'Local fans enter a $5 raffle for tickets purchased by supporters worldwide. Winners are selected by a cryptographically fair algorithm that anyone can verify. If you don\'t win, your $5 is refunded — you never lose money.',
  },
  {
    q: 'What happens if I buy a support ticket but can\'t attend?',
    a: 'That\'s the whole idea! Support tickets are purchased by fans who want to back an artist financially. Your ticket enters the local raffle pool so a nearby fan can experience the show live. You get the satisfaction of supporting the music you love.',
  },
  {
    q: 'How do you prevent bots and scalpers?',
    a: 'We use geo-verification to ensure raffle entries come from real people in the event\'s area. Combined with our $5 entry fee and cryptographic draw, there\'s no economic incentive for bots or scalpers to participate.',
  },
  {
    q: 'Is the draw really fair?',
    a: 'Yes — provably so. We publish a hashed commitment before entries close, then reveal the seed afterward. Anyone can run the algorithm themselves to verify the result. It\'s the same concept used in blockchain and online gaming fairness proofs.',
  },
  {
    q: 'How do artists get paid?',
    a: '100% of support ticket revenue goes directly to the artist via Stripe. MiraCulture takes a small service fee from the $5 raffle entries only. Artists set their own face-value prices and control their event listings.',
  },
];

/* -------------------------------------------------------
   FAQ Accordion Item
   ------------------------------------------------------- */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerId = useId();
  return (
    <div>
      <h3>
        <button
          id={triggerId}
          className="faq-trigger"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <span>{q}</span>
          <svg
            aria-hidden="true"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        className="faq-panel"
        style={{ maxHeight: open ? '500px' : '0', opacity: open ? 1 : 0 }}
        hidden={!open}
      >
        <p className="font-body text-gray-400 text-sm leading-relaxed py-4 pr-8">
          {a}
        </p>
      </div>
    </div>
  );
}


/* -------------------------------------------------------
   Reusable Section Wrapper with scroll-in animation
   ------------------------------------------------------- */
function Section({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const { ref, inView } = useInView();
  const reduced = usePrefersReducedMotion();
  return (
    <section
      ref={ref}
      id={id}
      className={`${
        reduced
          ? ''
          : `transition-all duration-700 ease-out ${
              inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`
      } ${className}`}
    >
      {children}
    </section>
  );
}

/* -------------------------------------------------------
   Ticker Item with status dot
   ------------------------------------------------------- */
function TickerItem({ text, status }: { text: string; status: TickerStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-2 px-5">
      <span className={`live-dot ${cfg.color}`} />
      <span>{text}</span>
      <span className="text-gray-500 text-[10px]">{cfg.label}</span>
    </span>
  );
}


/* -------------------------------------------------------
   Mouse Parallax — subtle depth on hero glow orbs
   ------------------------------------------------------- */
function useMouseParallax(factor = 0.02) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLElement>(null);

  const onMove = useCallback(
    (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      setOffset({
        x: (e.clientX - cx) * factor,
        y: (e.clientY - cy) * factor,
      });
    },
    [factor],
  );

  useEffect(() => {
    // Respect reduced motion preference — disable parallax
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // No parallax on touch devices — mouse-based effect has no touch equivalent
    if (window.matchMedia('(pointer: coarse)').matches) return;

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [onMove]);

  return { ref, offset };
}

/* -------------------------------------------------------
   Back-to-Top Button
   ------------------------------------------------------- */
function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`back-to-top transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      aria-label="Back to top"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      </svg>
    </button>
  );
}


/* -------------------------------------------------------
   Newsletter Signup (wired to POST /newsletter/subscribe)
   ------------------------------------------------------- */
function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      await api.post('/newsletter/subscribe', { email: email.trim() });
      setStatus('success');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return (
    <div className="mt-14 max-w-md mx-auto">
      <p className="font-body text-gray-400 text-xs tracking-widest uppercase mb-3">
        Stay in the loop
      </p>
      {status === 'success' ? (
        <p className="text-emerald-400 text-sm font-body">You're on the list! We'll keep you posted.</p>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              aria-label="Email address"
              required
              className="flex-1 px-4 py-2.5 bg-noir-900 border border-noir-700 rounded-sm text-sm font-body text-gray-200 placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none transition-colors duration-200"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="btn-amber px-5 py-2.5 text-sm whitespace-nowrap disabled:opacity-50"
            >
              {status === 'loading' ? 'Signing up...' : 'Notify Me'}
            </button>
          </form>
          {status === 'error' && (
            <p className="font-body text-red-400 text-xs mt-2">{errorMsg}</p>
          )}
        </>
      )}
      <p className="font-body text-gray-500 text-xs mt-2">
        No spam. Unsubscribe anytime.
      </p>
    </div>
  );
}

/* -------------------------------------------------------
   HomePage
   ------------------------------------------------------- */
export default function HomePage() {
  const { offset } = useMouseParallax(0.015);
  const { events: tickerEvents, loading: tickerLoading } = useTickerEvents();

  return (
    <div className="bg-noir-950 min-h-screen">
      <SEO
        description="Fans worldwide buy tickets at face value to support artists. Local fans win those tickets through fair, cryptographic raffles for just $5. No scalpers. No bots."
        jsonLd={getOrganizationSchema()}
      />

      {/* Skip to main content — accessibility (UX #45) */}
      <a
        href="#how-it-works"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-noir-950 focus:font-body focus:text-sm focus:rounded-sm"
      >
        Skip to main content
      </a>

      {/* ===== 1. HERO SECTION ===== */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Radial gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(217, 119, 6, 0.08) 0%, rgba(15, 15, 15, 0.6) 40%, #0a0a0a 70%)',
          }}
        />

        {/* Ambient glow orbs — mouse parallax */}
        <div
          className="glow-orb w-[280px] sm:w-[400px] md:w-[500px] h-[280px] sm:h-[400px] md:h-[500px] bg-amber-500 top-1/4 left-1/4 animate-float"
          aria-hidden="true"
          style={{
            animationDelay: '0s',
            transform: `translate(${offset.x * 1.5}px, ${offset.y * 1.5}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        />
        <div
          className="glow-orb w-[220px] sm:w-[320px] md:w-[400px] h-[220px] sm:h-[320px] md:h-[400px] bg-amber-600 bottom-1/3 right-1/4 animate-float"
          aria-hidden="true"
          style={{
            animationDelay: '3s',
            transform: `translate(${offset.x * -1}px, ${offset.y * -1}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        />

        {/* Film grain */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
            backgroundRepeat: 'repeat',
          }}
        />

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(10,10,10,0.6) 0%, transparent 20%, transparent 80%, rgba(10,10,10,0.8) 100%)',
          }}
        />

        {/* Event ticker — live events, auto-refreshes every 60s (UX #10, #19) */}
        {(tickerLoading || tickerEvents.length > 0) && (
          <div className="relative z-10 border-b border-noir-800/30 bg-noir-950/50 backdrop-blur-sm" aria-hidden="true">
            {tickerLoading ? (
              <div className="py-2.5 flex items-center justify-center gap-6 px-6">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-noir-700 animate-pulse" />
                    <div className="h-3 w-24 sm:w-32 bg-noir-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="ticker-strip py-2.5 text-xs tracking-widest uppercase font-body text-gray-500">
                <div className="ticker-strip-inner">
                  {tickerEvents.map((ev, i) => (
                    <TickerItem key={i} text={ev.text} status={ev.status} />
                  ))}
                  {tickerEvents.map((ev, i) => (
                    <TickerItem key={`dup-${i}`} text={ev.text} status={ev.status} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Label */}
            <p
              className="font-display text-sm sm:text-base tracking-[0.4em] text-amber-500/70 mb-5 animate-fade-in-up"
              style={{ animationDelay: '0ms' }}
            >
              M☝️RACULTURE
            </p>

            {/* Main tagline — 3D extruded text with glow pulse */}
            <h1
              className="font-display text-4xl sm:text-5xl md:text-7xl lg:text-8xl tracking-[0.08em] sm:tracking-[0.12em] md:tracking-[0.2em] text-warm-50 mb-6 animate-fade-in-up text-3d animate-pulse-glow"
              style={{
                animationDelay: '150ms',
              }}
            >
              WHERE FANS POWER THE SHOW
            </h1>

            {/* Divider */}
            <div
              className="flex items-center justify-center gap-4 mb-6 animate-fade-in-up"
              style={{ animationDelay: '300ms' }}
              aria-hidden="true"
            >
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-500/40" />
              <div className="w-1.5 h-1.5 rotate-45 bg-amber-500/60 animate-pulse-dot" />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-500/40" />
            </div>

            {/* Description */}
            <p
              className="font-body text-gray-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-10 animate-fade-in-up"
              style={{ animationDelay: '450ms' }}
            >
              Fans worldwide buy tickets at face value to support artists they
              love. Local fans win those tickets through fair, cryptographic
              raffles for just $5. No scalpers. No bots. No algorithms deciding
              who gets in.
            </p>

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up"
              style={{ animationDelay: '600ms' }}
            >
              <Link
                to="/events"
                className="btn-amber inline-flex items-center justify-center px-8 py-3.5 min-h-[44px] text-base rounded-sm group"
              >
                <span>FIND YOUR SHOW</span>
                <svg className="w-4 h-4 ml-2 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <Link
                to="/register"
                className="btn-ghost inline-flex items-center justify-center px-8 py-3.5 min-h-[44px] text-base rounded-sm"
              >
                SIGN UP
              </Link>
            </div>

            {/* Bouncing chevrons (double) — decorative */}
            <div className="mt-16 flex flex-col items-center gap-0 animate-bounce-subtle" aria-hidden="true">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
              <svg className="w-5 h-5 text-gray-700 -mt-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 2. SOCIAL PROOF STATS ===== */}
      <Section className="py-16 px-6 border-y border-noir-800/30 bg-noir-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { target: 2000, suffix: '+', label: 'Fans Registered' },
              { target: 100, suffix: '%', label: 'Direct to Artists' },
              { target: 0, suffix: '%', label: 'Scalper Rate' },
              { target: 5, suffix: '', label: 'Dollar Raffle Entry' },
            ].map((stat) => (
              <div key={stat.label} className="group">
                <p className="font-display text-3xl sm:text-4xl md:text-5xl text-amber-500 mb-2 tabular-nums">
                  {stat.target === 5 && '$'}
                  <AnimatedCounter target={stat.target} suffix={stat.suffix} />
                </p>
                <p className="font-body text-xs tracking-widest uppercase text-gray-500 group-hover:text-gray-400 transition-colors duration-200">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <hr className="section-divider" />

      {/* ===== 2b. MISSION STATEMENT ===== */}
      <Section id="our-mission" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-14">
            <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
              WHY WE EXIST
            </p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-widest text-warm-50 text-3d">
              OUR MISSION
            </h2>
            <div className="mt-6 flex items-center justify-center gap-3" aria-hidden="true">
              <div className="h-px w-12 bg-amber-500/30" />
              <div className="w-1 h-1 rotate-45 bg-amber-500/50" />
              <div className="h-px w-12 bg-amber-500/30" />
            </div>
          </div>

          {/* Mission content */}
          <div className="space-y-10">
            {/* Our Belief */}
            <div>
              <h3 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
                OUR BELIEF
              </h3>
              <p className="font-body text-gray-300 text-base leading-relaxed">
                The opportunity to experience an artist performing their creation is
                something every person should have — regardless of their financial
                ability. Music doesn't care about your race, sexuality, or political
                stance. It brings all walks of life into the same room, sharing the
                same moment.
              </p>
              <p className="font-body text-gray-400 text-base leading-relaxed mt-4">
                An artist has the power to bring someone from the far right and someone
                from the far left into the same venue — and in that space, they share
                an experience and form bonds that can last a lifetime.
              </p>
            </div>

            {/* The Problem */}
            <div>
              <h3 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
                THE PROBLEM
              </h3>
              <p className="font-body text-gray-300 text-base leading-relaxed">
                In today's economy, tickets to the shows and festivals that sell out fastest
                get scalped — often by the very platforms selling them, operating under
                different entities or legal structures. We've watched this happen time
                after time. The people with money buy up access, mark it up, and lock
                out the fans who need it most.
              </p>
              <p className="font-body text-gray-400 text-base leading-relaxed mt-4">
                The climbing cost of simply <em className="text-gray-300 not-italic">experiencing</em> live
                music — an experience that can genuinely change someone's life — has gone
                unchecked for too long.
              </p>
            </div>

            {/* Our Answer */}
            <div>
              <h3 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
                OUR ANSWER
              </h3>
              <p className="font-body text-gray-300 text-base leading-relaxed">
                That's all about to change. If you believe in an artist's vision, their
                goals, their values, their character — and you have the financial ability
                to support their project — then let us help you level the playing field.
              </p>
              <p className="font-body text-gray-400 text-base leading-relaxed mt-4">
                MiraCulture is a real Robin Hood act: we call on every altruistically aligned
                individual to not only stop scalping from happening, but to reverse its damage
                entirely. Supporters fund tickets so that fans who otherwise couldn't attend
                can get in for just $5–$10 — not face value, not marked up, just a small
                processing fee. No bots. No scalpers. No middlemen profiting off scarcity.
              </p>
            </div>

            {/* Our Standard */}
            <div>
              <h3 className="font-display text-lg tracking-widest text-amber-500/80 mb-4">
                OUR STANDARD
              </h3>
              <p className="font-body text-gray-300 text-base leading-relaxed">
                Artists carry a major responsibility to deliver these experiences with love
                and integrity at the forefront — always. Every show and festival on our
                platform must align with those principles. We don't just redistribute
                tickets. We protect the culture.
              </p>
            </div>

            {/* Pull quote — glass card */}
            <div className="relative glass-card rounded-lg border-l-2 border-amber-500/40 pl-6 pr-6 py-6 mt-6">
              <p className="font-display text-xl sm:text-2xl tracking-wide text-warm-50 leading-relaxed relative z-10">
                To ensure that live music remains what it was always meant to be — a shared
                human experience, accessible to everyone, powered by the generosity of the
                community that believes in it.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <hr className="section-divider" />

      {/* ===== 3. HOW IT WORKS ===== */}
      <Section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
              THE PROCESS
            </p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-widest text-warm-50 text-3d">
              HOW IT WORKS
            </h2>
            <div className="mt-6 flex items-center justify-center gap-3" aria-hidden="true">
              <div className="h-px w-12 bg-amber-500/30" />
              <div className="w-1 h-1 rotate-45 bg-amber-500/50" />
              <div className="h-px w-12 bg-amber-500/30" />
            </div>
          </div>

          {/* Steps */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative perspective-container">
            {/* Dotted connector with dots at junctions (desktop) */}
            <div
              className="hidden lg:block absolute top-[3.5rem] left-[12.5%] right-[12.5%] h-px border-t-2 border-dashed border-noir-700"
              aria-hidden="true"
            />
            {/* Amber pulse dots at connector junctions */}
            {[1, 2].map((n) => (
              <div
                key={n}
                className="hidden lg:block absolute top-[3.25rem] w-2 h-2 rounded-full bg-amber-500/40 animate-pulse-dot"
                style={{
                  left: `${25 * n + 12.5}%`,
                  transform: 'translateX(-50%)',
                  animationDelay: `${n * 0.5}s`,
                }}
                aria-hidden="true"
              />
            ))}

            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="card-3d glass-card glass-shimmer fresnel-border ambient-glow relative rounded-xl p-6 group animate-fade-in-up"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                {/* Numbered circle */}
                <div className="w-12 h-12 rounded-full border-2 border-amber-500/40 flex items-center justify-center mb-5 mx-auto sm:mx-0 relative z-10 bg-noir-900 group-hover:border-amber-500 group-hover:bg-amber-500/10 transition-all duration-300">
                  <span className="font-display text-lg text-amber-500">
                    {step.num}
                  </span>
                </div>

                {/* Icon */}
                <div className="text-amber-500/60 mb-3 flex justify-center sm:justify-start group-hover:text-amber-500 transition-colors duration-300">
                  {step.icon}
                </div>

                <h3 className="font-body font-semibold text-warm-50 text-base mb-2 text-center sm:text-left">
                  {step.title}
                </h3>
                <p className="font-body text-gray-400 text-sm leading-relaxed text-center sm:text-left">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <hr className="section-divider" />

      {/* ===== 4. BROWSE EVENTS CTA ===== */}
      <Section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
            LIVE EVENTS
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-widest text-warm-50 mb-6 text-3d">
            SEE WHO&rsquo;S PLAYING
          </h2>
          <p className="font-body text-gray-400 text-base max-w-xl mx-auto leading-relaxed mb-10">
            Browse real shows from real artists. Support the ones you love, enter
            raffles for the ones near you, and help make live music accessible to
            everyone.
          </p>
          <Link
            to="/events"
            className="btn-amber inline-flex items-center justify-center px-8 py-3.5 text-base rounded-sm group"
          >
            <span>BROWSE EVENTS</span>
            <svg className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </Section>

      <hr className="section-divider" />

      {/* ===== 5. FAIRNESS PROMISE ===== */}
      <Section className="py-24 px-6 bg-noir-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Copy */}
            <div>
              <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
                OUR PROMISE
              </p>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-widest text-warm-50 mb-6 text-3d">
                PROVABLY FAIR
              </h2>
              <p className="font-body text-gray-400 text-base leading-relaxed mb-8">
                Every raffle draw uses a cryptographic commitment scheme. We
                publish a hashed seed before entries close. After the draw, we
                reveal the seed so anyone can independently verify the outcome.
                The result can't be rigged — mathematically.
              </p>

              <ul className="space-y-4">
                {[
                  'Hashed seed published before entries close',
                  'Draw algorithm is open-source and auditable',
                  'Every result can be independently verified',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 group">
                    <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-amber-500/20 transition-colors duration-200">
                      <svg
                        className="w-3 h-3 text-amber-500"
                        aria-hidden="true"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    </div>
                    <span className="font-body text-gray-300 text-sm">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Verification receipt — glass refraction */}
            <div className="glass-refract card-3d rounded-lg overflow-hidden">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-noir-800/60 bg-noir-950" aria-hidden="true">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="ml-2 text-gray-600 text-xs font-body">
                  verification-receipt.json
                </span>
              </div>

              <div className="p-5 font-mono text-xs space-y-1 overflow-x-auto">
                <p className="text-gray-500">
                  {'{'} <span className="text-amber-500">"draw_id"</span>:{' '}
                  <span className="text-gray-400">"mc-YYYY-MMDD-XX"</span>,
                </p>
                <p className="text-gray-500 pl-4">
                  <span className="text-amber-500">"event"</span>:{' '}
                  <span className="text-gray-400">"Artist @ Venue"</span>,
                </p>
                <p className="text-gray-500 pl-4">
                  <span className="text-amber-500">"seed_hash"</span>:{' '}
                  <span className="text-gray-400">"a3f8c1...7e9c912"</span>,
                </p>
                <p className="text-gray-500 pl-4">
                  <span className="text-amber-500">"algorithm"</span>:{' '}
                  <span className="text-gray-300">"SHA-256 + HMAC"</span>,
                </p>
                <p className="text-gray-500 pl-4">
                  <span className="text-amber-500">"entries"</span>:{' '}
                  <span className="text-gray-400">"&lt;total_entries&gt;"</span>,
                </p>
                <p className="text-gray-500 pl-4">
                  <span className="text-amber-500">"winners"</span>:{' '}
                  <span className="text-gray-400">"&lt;winner_count&gt;"</span>,
                </p>
                <p className="text-gray-500 pl-4">
                  <span className="text-amber-500">"revealed_seed"</span>:{' '}
                  <span className="text-gray-400">"7b2ef0...4a1f041"</span>,
                </p>
                <p className="text-gray-500 pl-4">
                  <span className="text-amber-500">"timestamp"</span>:{' '}
                  <span className="text-gray-400">"&lt;draw_timestamp&gt;"</span>,
                </p>
                <p className="text-gray-500 pl-4">
                  <span className="text-amber-500">"status"</span>:{' '}
                  <span className="text-emerald-400 font-semibold">
                    "VERIFIED"
                  </span>{' '}
                  <span className="text-emerald-600">&#10003;</span>
                </p>
                <p className="text-gray-500">
                  {'}'}<span className="animate-blink text-amber-500">|</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <hr className="section-divider" />

      {/* ===== 6. FAQ ===== */}
      <Section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
              QUESTIONS
            </p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-widest text-warm-50">
              FAQ
            </h2>
          </div>

          <div>
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </Section>

      <hr className="section-divider" />

      {/* ===== 7. FOR ARTISTS ===== */}
      <Section id="for-artists" className="py-24 px-6 bg-noir-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
              FOR ARTISTS
            </p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-widest text-warm-50 mb-4 text-3d">
              HOW CAMPAIGNS WORK
            </h2>
            <p className="font-body text-gray-400 text-base max-w-2xl mx-auto leading-relaxed">
              Launch a campaign for your upcoming show. Fans worldwide donate to
              unlock affordable tickets for local fans &mdash; and every dollar
              goes directly to you.
            </p>
          </div>

          {/* Campaign lifecycle steps */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10 perspective-container">
            {CAMPAIGN_STEPS.slice(0, 3).map((step, i) => (
              <div
                key={step.num}
                className="glass-card glass-shimmer fresnel-border card-3d ambient-glow relative rounded-xl p-6 group animate-fade-in-up"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="w-12 h-12 rounded-full border-2 border-amber-500/40 flex items-center justify-center mb-5 relative z-10 bg-noir-900 group-hover:border-amber-500 group-hover:bg-amber-500/10 transition-all duration-300">
                  <span className="font-display text-lg text-amber-500">{step.num}</span>
                </div>
                <h3 className="font-body font-semibold text-warm-50 text-base mb-2">
                  {step.title}
                </h3>
                <p className="font-body text-gray-400 text-sm leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto mb-10">
            {CAMPAIGN_STEPS.slice(3).map((step, i) => (
              <div
                key={step.num}
                className="glass-card glass-shimmer fresnel-border card-3d ambient-glow relative rounded-xl p-6 group animate-fade-in-up"
                style={{ animationDelay: `${(i + 3) * 120}ms` }}
              >
                <div className="w-12 h-12 rounded-full border-2 border-amber-500/40 flex items-center justify-center mb-5 relative z-10 bg-noir-900 group-hover:border-amber-500 group-hover:bg-amber-500/10 transition-all duration-300">
                  <span className="font-display text-lg text-amber-500">{step.num}</span>
                </div>
                <h3 className="font-body font-semibold text-warm-50 text-base mb-2">
                  {step.title}
                </h3>
                <p className="font-body text-gray-400 text-sm leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Compact stat badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
            {[
              { stat: '100%', label: 'to artist' },
              { stat: '40+', label: 'countries' },
              { stat: '0%', label: 'scalper rate' },
            ].map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-noir-700 bg-noir-800/50"
              >
                <span className="font-display text-lg text-amber-500">{b.stat}</span>
                <span className="font-body text-xs tracking-wider uppercase text-gray-400">{b.label}</span>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              to="/artist/verify"
              className="btn-amber px-8 py-3.5 text-base inline-flex items-center gap-2 group"
            >
              <span>LIST YOUR EVENT</span>
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </Section>

      {/* ===== 7b. FOR PROMOTER AGENTS ===== */}
      <Section id="for-agents" className="py-20 px-6 bg-noir-950">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card fresnel-border rounded-2xl p-8 md:p-12 relative overflow-hidden">
            {/* Subtle accent glow */}
            <div
              className="absolute -top-20 -right-20 w-64 h-64 bg-amber-500 rounded-full pointer-events-none"
              style={{ opacity: 0.03, filter: 'blur(80px)' }}
              aria-hidden="true"
            />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div className="flex-1">
                <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
                  FOR PROMOTERS
                </p>
                <h2 className="font-display text-2xl sm:text-3xl tracking-widest text-warm-50 mb-4 text-3d">
                  BECOME A PROMOTER AGENT
                </h2>
                <p className="font-body text-gray-400 text-sm leading-relaxed max-w-lg mb-4">
                  Know your local scene? Have venue connections? Earn 50% of campaign
                  proceeds by helping artists run MiraCulture campaigns in your city.
                  Get verified, get matched with artists, and get paid.
                </p>
                <div className="flex flex-wrap gap-4 text-xs font-body">
                  {[
                    { stat: '50%', label: 'revenue share' },
                    { stat: 'Verified', label: 'profiles' },
                    { stat: 'Direct', label: 'artist payment' },
                  ].map((b) => (
                    <div
                      key={b.label}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-noir-700 bg-noir-800/50"
                    >
                      <span className="font-display text-sm text-amber-500">{b.stat}</span>
                      <span className="tracking-wider uppercase text-gray-400">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 shrink-0">
                <Link
                  to="/agents/register"
                  className="btn-amber px-8 py-3.5 text-sm inline-flex items-center gap-2 group text-center justify-center"
                >
                  <span>APPLY NOW</span>
                  <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link
                  to="/agents"
                  className="btn-ghost px-8 py-3.5 text-sm text-center"
                >
                  BROWSE AGENTS
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <hr className="section-divider" />

      {/* ===== 8. TRUST BADGES ===== */}
      <Section className="border-y border-noir-800/40 py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              {
                label: 'Stripe Secured',
                icon: (
                  <svg className="w-6 h-6 mx-auto" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                ),
              },
              {
                label: 'End-to-End Encryption',
                icon: (
                  <svg className="w-6 h-6 mx-auto" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                ),
              },
              {
                label: 'Open-Source',
                icon: (
                  <svg className="w-6 h-6 mx-auto" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                ),
              },
              {
                label: '40+ Countries',
                icon: (
                  <svg className="w-6 h-6 mx-auto" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                ),
              },
            ].map((badge) => (
              <div key={badge.label} className="depth-pop flex flex-col items-center gap-2.5 group cursor-default">
                <div className="text-gray-500 group-hover:text-amber-500/70 transition-all duration-300">
                  {badge.icon}
                </div>
                <span className="font-body text-xs tracking-widest uppercase text-gray-500 group-hover:text-gray-400 transition-colors duration-300">
                  {badge.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ===== 8b. TESTIMONIALS / SOCIAL PROOF ===== */}
      <Section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
              FROM THE COMMUNITY
            </p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-widest text-warm-50 text-3d">
              VOICES
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "I never thought I'd see my favorite DJ live — the tickets were always $200+ resale. MiraCulture got me in for $5. I literally cried.",
                name: 'Jordan M.',
                role: 'Fan, Atlanta',
              },
              {
                quote: "As an artist, knowing that 100% of the support goes directly to me changes everything. No middleman taking 40%. Just me and my fans.",
                name: 'DJ Solstice',
                role: 'Artist, Denver',
              },
              {
                quote: "The cryptographic fairness proof is genius. I verified my draw result myself. There's no way to rig this — and that's exactly the point.",
                name: 'Marcus T.',
                role: 'Fan & Developer, Austin',
              },
            ].map((t) => (
              <blockquote
                key={t.name}
                className="glass-card fresnel-border rounded-xl p-6 flex flex-col"
              >
                <svg className="w-8 h-8 text-amber-500/30 mb-4 shrink-0" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <p className="font-body text-gray-300 text-sm leading-relaxed flex-1 mb-5">
                  {t.quote}
                </p>
                <footer className="border-t border-noir-800/60 pt-4">
                  <p className="font-body text-warm-50 text-sm font-semibold">{t.name}</p>
                  <p className="font-body text-gray-500 text-xs">{t.role}</p>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </Section>

      <hr className="section-divider" />

      {/* ===== 9. BOTTOM CTA ===== */}
      <Section className="relative py-28 px-6 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, #0f0f0f, rgba(217, 119, 6, 0.06) 50%, #0a0a0a)',
          }}
        />
        {/* Subtle horizontal lines for texture */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(245, 158, 11, 0.3) 40px, rgba(245, 158, 11, 0.3) 41px)',
          }}
        />

        {/* Ambient glow */}
        <div
          className="glow-orb w-[300px] sm:w-[450px] md:w-[600px] h-[300px] sm:h-[450px] md:h-[600px] bg-amber-500 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
          style={{ opacity: 0.04 }}
        />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <p className="font-display text-sm tracking-[0.4em] text-amber-500/50 mb-4">
            JOIN THE MOVEMENT
          </p>
          <h2
            className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-wider text-warm-50 mb-6 text-3d"
          >
            THE NEXT SHOW IS WAITING
          </h2>

          <p className="font-body text-gray-400 text-base md:text-lg max-w-lg mx-auto leading-relaxed mb-10">
            Behind every seat filled is a fan who believed in the music and
            another who got to experience it live.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link
              to="/events"
              className="btn-amber inline-flex items-center justify-center px-10 py-4 text-base group"
            >
              <span>FIND YOUR SHOW</span>
              <svg className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              to="/register"
              className="btn-ghost inline-flex items-center justify-center px-10 py-4 text-base"
            >
              CREATE AN ACCOUNT
            </Link>
          </div>

          <p className="font-body text-gray-400 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-amber-500 hover:text-amber-400 transition-colors duration-200 underline underline-offset-2">
              Log in
            </Link>
          </p>

          {/* Newsletter capture */}
          <NewsletterForm />

          {/* Decorative bottom element */}
          <div className="mt-16 flex items-center justify-center gap-3" aria-hidden="true">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-amber-500/20" />
            <div className="w-1.5 h-1.5 rotate-45 border border-amber-500/30 animate-pulse-dot" />
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-amber-500/20" />
          </div>
        </div>
      </Section>

      {/* Back-to-top button */}
      <BackToTop />
    </div>
  );
}
