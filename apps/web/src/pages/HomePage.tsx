import { Link } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { useInView } from '../hooks/useInView.js';
import { useCountUp } from '../hooks/useCountUp.js';
import SEO, { getOrganizationSchema } from '../components/SEO.js';

/* -------------------------------------------------------
   Mock Data (replace with API calls later)
   ------------------------------------------------------- */
const TICKER_EVENTS = [
  { text: 'Kendrick Lamar — Los Angeles, CA', status: 'sold-out' },
  { text: 'Tame Impala — Brooklyn, NY — 12 spots left', status: 'active' },
  { text: 'Billie Eilish — London, UK', status: 'open' },
  { text: 'Tyler, the Creator — Chicago, IL — 3 days left', status: 'active' },
  { text: 'SZA — Toronto, ON', status: 'new' },
  { text: 'Bad Bunny — Miami, FL', status: 'sold-out' },
  { text: 'Dua Lipa — Berlin, DE', status: 'open' },
  { text: 'Frank Ocean — Tokyo, JP', status: 'upcoming' },
] as const;

const STATUS_CONFIG = {
  'sold-out': { color: 'bg-red-500', label: 'SOLD OUT' },
  open: { color: 'bg-emerald-500', label: 'RAFFLE OPEN' },
  active: { color: 'bg-amber-500', label: 'ACTIVE' },
  new: { color: 'bg-sky-500', label: 'JUST ANNOUNCED' },
  upcoming: { color: 'bg-gray-500', label: 'COMING SOON' },
} as const;

const STATS = [
  { value: '12,400+', label: 'Fans Served' },
  { value: '$2.1M', label: 'To Artists' },
  { value: '340+', label: 'Shows' },
  { value: '100%', label: 'Fair' },
];

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

const FEATURED_EVENTS = [
  {
    artist: 'Kendrick Lamar',
    venue: 'The Forum, Los Angeles',
    date: 'Mar 15, 2026',
    genre: 'Hip-Hop',
    price: '$85',
    progress: 100,
    gradient: 'from-amber-900/60 to-noir-900',
    soldOut: true,
    supporters: 214,
    daysUntil: 0,
  },
  {
    artist: 'Tame Impala',
    venue: 'Brooklyn Steel, NY',
    date: 'Apr 2, 2026',
    genre: 'Psych-Rock',
    price: '$65',
    progress: 54,
    gradient: 'from-purple-900/60 to-noir-900',
    soldOut: false,
    supporters: 89,
    daysUntil: 53,
  },
  {
    artist: 'Billie Eilish',
    venue: 'O2 Arena, London',
    date: 'Apr 18, 2026',
    genre: 'Pop',
    price: '$95',
    progress: 32,
    gradient: 'from-emerald-900/60 to-noir-900',
    soldOut: false,
    supporters: 156,
    daysUntil: 69,
  },
];

const PRESS_LOGOS = [
  'Pitchfork', 'Rolling Stone', 'NME', 'Complex', 'Stereogum', 'FADER',
];

const TESTIMONIALS = [
  {
    quote: 'I supported an artist I love in Tokyo from my couch in Ohio. Two weeks later, a fan there got to see the show for $5. That\'s how music should work.',
    name: 'Marcus T.',
    role: 'Supporter',
    location: 'Columbus, OH',
    initials: 'MT',
    color: 'bg-amber-500/20 text-amber-400',
  },
  {
    quote: 'I won tickets to see SZA for five dollars. Five. I literally cried. No bots, no scalpers — just luck and a fair system.',
    name: 'Priya K.',
    role: 'Raffle Winner',
    location: 'Toronto, ON',
    initials: 'PK',
    color: 'bg-emerald-500/20 text-emerald-400',
  },
  {
    quote: 'My fans buy tickets because they believe in the music, not because they want to flip them. MiraCulture gave me that connection back.',
    name: 'Jordan Wells',
    role: 'Independent Artist',
    location: 'Atlanta, GA',
    initials: 'JW',
    color: 'bg-purple-500/20 text-purple-400',
  },
];

const FAQ_ITEMS = [
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
  return (
    <div>
      <h3>
        <button
          className="faq-trigger"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <span>{q}</span>
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={undefined}
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
   Animated Stat Number
   ------------------------------------------------------- */
function StatValue({ raw, inView }: { raw: string; inView: boolean }) {
  // Parse the numeric part and preserve prefix/suffix
  const match = raw.match(/^([^0-9]*)([0-9,]+)(.*)$/);
  if (!match) return <>{raw}</>;

  const prefix = match[1];
  const numStr = match[2].replace(/,/g, '');
  const suffix = match[3];
  const num = parseInt(numStr, 10);
  const animated = useCountUp(num, inView);

  // Format with commas
  const formatted = animated.toLocaleString();

  return (
    <>
      {prefix}
      {formatted}
      {suffix}
    </>
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
  return (
    <section
      ref={ref}
      id={id}
      className={`transition-all duration-700 ease-out ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
    >
      {children}
    </section>
  );
}

/* -------------------------------------------------------
   Ticker Item with status dot
   ------------------------------------------------------- */
function TickerItem({ text, status }: { text: string; status: keyof typeof STATUS_CONFIG }) {
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
   Animated Progress Bar — width animates on scroll
   ------------------------------------------------------- */
function AnimatedBar({ progress, soldOut }: { progress: number; soldOut: boolean }) {
  const { ref, inView } = useInView(0.5);
  return (
    <div ref={ref} className="h-1.5 bg-noir-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-1000 ease-out ${
          soldOut ? 'bg-red-500/60' : 'bg-amber-500'
        }`}
        style={{ width: inView ? `${progress}%` : '0%' }}
      />
    </div>
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
   Stats Bar — animated counters triggered on scroll
   ------------------------------------------------------- */
function StatsBar() {
  const { ref, inView } = useInView(0.3);
  return (
    <section
      ref={ref}
      className={`bg-noir-900 border-y border-noir-800/40 transition-all duration-700 ease-out ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label} className="group">
              <div className="font-display text-3xl md:text-4xl text-amber-500 mb-1 glow-text transition-all duration-300 group-hover:scale-105">
                <StatValue raw={s.value} inView={inView} />
              </div>
              <div className="font-body text-xs tracking-widest uppercase text-gray-400">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------
   HomePage
   ------------------------------------------------------- */
export default function HomePage() {
  const { offset } = useMouseParallax(0.015);

  return (
    <div className="bg-noir-950 min-h-screen">
      <SEO
        description="Fans worldwide buy tickets at face value to support artists. Local fans win those tickets through fair, cryptographic raffles for just $5. No scalpers. No bots."
        jsonLd={getOrganizationSchema()}
      />
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

        {/* Event ticker — decorative, hidden from screen readers */}
        <div className="relative z-10 border-b border-noir-800/30 bg-noir-950/50 backdrop-blur-sm" aria-hidden="true">
          <div className="ticker-strip py-2.5 text-xs tracking-widest uppercase font-body text-gray-500">
            <div className="ticker-strip-inner">
              {/* First copy */}
              {TICKER_EVENTS.map((ev, i) => (
                <TickerItem key={i} text={ev.text} status={ev.status} />
              ))}
              {/* Duplicate for seamless loop */}
              {TICKER_EVENTS.map((ev, i) => (
                <TickerItem key={`dup-${i}`} text={ev.text} status={ev.status} />
              ))}
            </div>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Label */}
            <p
              className="font-display text-sm sm:text-base tracking-[0.4em] text-amber-500/70 mb-5 animate-fade-in-up"
              style={{ animationDelay: '0ms' }}
            >
              MIRACULTUREE
            </p>

            {/* Main tagline */}
            <h1
              className="font-display text-4xl sm:text-5xl md:text-7xl lg:text-8xl tracking-[0.08em] sm:tracking-[0.12em] md:tracking-[0.2em] text-warm-50 mb-6 animate-fade-in-up"
              style={{
                animationDelay: '150ms',
                textShadow:
                  '0 0 40px rgba(245, 158, 11, 0.15), 0 0 80px rgba(245, 158, 11, 0.05)',
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
                className="btn-amber inline-flex items-center justify-center px-8 py-3.5 text-base rounded-sm group"
              >
                <span>FIND YOUR SHOW</span>
                <svg className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <a
                href="#how-it-works"
                className="btn-ghost inline-flex items-center justify-center px-8 py-3.5 text-base rounded-sm"
              >
                HOW IT WORKS
              </a>
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

      {/* ===== 2. SOCIAL PROOF STATS BAR ===== */}
      <StatsBar />

      <hr className="section-divider" />

      {/* ===== 3. HOW IT WORKS ===== */}
      <Section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
              THE PROCESS
            </p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-widest text-warm-50">
              HOW IT WORKS
            </h2>
            <div className="mt-6 flex items-center justify-center gap-3" aria-hidden="true">
              <div className="h-px w-12 bg-amber-500/30" />
              <div className="w-1 h-1 rotate-45 bg-amber-500/50" />
              <div className="h-px w-12 bg-amber-500/30" />
            </div>
          </div>

          {/* Steps */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
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
                className="card-hover relative bg-noir-900 border border-noir-800 rounded-xl p-6 group animate-fade-in-up"
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

      {/* ===== 4. FEATURED EVENTS ===== */}
      <Section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-14 gap-4">
            <div>
              <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
                LIVE NOW
              </p>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-widest text-warm-50">
                FEATURED EVENTS
              </h2>
            </div>
            <Link
              to="/events"
              className="hidden md:inline-flex items-center gap-2 text-sm font-body text-gray-400 hover:text-amber-500 transition-colors duration-200"
              aria-label="View all events"
            >
              View all
              <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>

          <div className="flex gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 snap-x snap-mandatory -mx-6 px-6 md:mx-0 md:px-0 hide-scrollbar">
            {FEATURED_EVENTS.map((ev) => (
              <div
                key={ev.artist}
                className="card-hover ticket-tear flex-shrink-0 w-[280px] md:w-auto bg-noir-900 border border-noir-800 rounded-lg overflow-hidden group snap-center"
              >
                {/* Artwork placeholder */}
                <div
                  className={`relative h-44 bg-gradient-to-br ${ev.gradient} flex items-end p-4`}
                >
                  {/* Shimmer effect */}
                  <div className="shimmer-overlay" aria-hidden="true" />

                  {/* Sold out overlay */}
                  {ev.soldOut && (
                    <div className="sold-out-overlay rounded-t-lg">
                      <span className="font-display text-2xl tracking-widest text-red-400/80 rotate-[-12deg]">
                        SOLD OUT
                      </span>
                    </div>
                  )}

                  {/* Hover CTA */}
                  {!ev.soldOut && (
                    <div className="event-card-cta rounded-t-lg">
                      <Link
                        to="/events"
                        className="btn-amber px-6 py-2.5 text-xs inline-flex items-center gap-2"
                      >
                        <span>ENTER RAFFLE</span>
                        <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </Link>
                    </div>
                  )}

                  <div className="relative z-20 flex items-center gap-2">
                    <span className="text-xs font-body tracking-widest uppercase px-2 py-1 bg-noir-950/70 rounded text-amber-400 border border-amber-500/20">
                      {ev.genre}
                    </span>
                  </div>

                  {/* Supporter count badge */}
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-noir-950/70 rounded-full px-2.5 py-1 border border-noir-800/50">
                    <svg className="w-3 h-3 text-amber-500" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="text-[10px] font-body text-gray-400" aria-label={`${ev.supporters} supporters`}>{ev.supporters}</span>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="font-body font-semibold text-warm-50 text-lg mb-1 group-hover:text-amber-400 transition-colors duration-300">
                    {ev.artist}
                  </h3>
                  <p className="font-body text-gray-400 text-sm mb-1 truncate">
                    {ev.venue}
                  </p>
                  <div className="flex items-center gap-2 mb-4">
                    <p className="font-body text-gray-400 text-xs">
                      {ev.date}
                    </p>
                    {ev.daysUntil > 0 && (
                      <span className="text-[10px] font-body tracking-wide text-amber-500/70 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        in {ev.daysUntil}d
                      </span>
                    )}
                  </div>

                  {/* Animated progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs font-body mb-1.5">
                      <span className="text-gray-400">
                        {ev.soldOut ? 'Raffle closed' : 'Raffle progress'}
                      </span>
                      <span className={ev.soldOut ? 'text-red-400' : 'text-amber-500'}>
                        {ev.progress}%
                      </span>
                    </div>
                    <AnimatedBar progress={ev.progress} soldOut={ev.soldOut} />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="font-body text-warm-50 font-semibold text-lg">
                      {ev.price}
                    </span>
                    <span className="text-xs text-gray-400 font-body tracking-wide uppercase">
                      face value
                    </span>
                  </div>

                  {/* Mobile tap-friendly CTA (touch devices) */}
                  {!ev.soldOut && (
                    <Link
                      to="/events"
                      className="mt-3 btn-amber w-full text-center py-2.5 text-xs md:hidden inline-flex items-center justify-center gap-1.5"
                    >
                      ENTER RAFFLE
                      <svg className="w-3 h-3" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10 md:hidden">
            <Link to="/events" className="btn-ghost">
              VIEW ALL EVENTS
            </Link>
          </div>
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
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-widest text-warm-50 mb-6">
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

            {/* Verification receipt */}
            <div className="card-hover bg-noir-950 border border-noir-800 rounded-lg overflow-hidden">
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
                  <span className="text-gray-300">"mc-2026-0315-LA"</span>,
                </p>
                <p className="text-gray-500 pl-4">
                  <span className="text-amber-500">"event"</span>:{' '}
                  <span className="text-gray-300">"Kendrick Lamar @ The Forum"</span>,
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
                  <span className="text-sky-400">847</span>,
                </p>
                <p className="text-gray-500 pl-4">
                  <span className="text-amber-500">"winners"</span>:{' '}
                  <span className="text-sky-400">12</span>,
                </p>
                <p className="text-gray-500 pl-4">
                  <span className="text-amber-500">"revealed_seed"</span>:{' '}
                  <span className="text-gray-400">"7b2ef0...4a1f041"</span>,
                </p>
                <p className="text-gray-500 pl-4">
                  <span className="text-amber-500">"timestamp"</span>:{' '}
                  <span className="text-gray-400">"2026-03-15T22:00:00Z"</span>,
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

      {/* ===== 6. TESTIMONIALS ===== */}
      <Section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
              THE COMMUNITY
            </p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-widest text-warm-50">
              WHAT FANS SAY
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className="card-hover bg-noir-900 border border-noir-800 rounded-lg p-6 flex flex-col animate-fade-in-up"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                {/* Quote mark */}
                <span className="font-display text-5xl text-amber-500/20 leading-none select-none" aria-hidden="true">
                  &ldquo;
                </span>
                <p className="font-body text-gray-300 text-sm italic leading-relaxed mb-6 -mt-4 flex-1">
                  {t.quote}
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t border-noir-800/40">
                  <div className={`avatar-circle ${t.color}`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-body text-warm-50 text-sm font-semibold">
                      {t.name}
                    </p>
                    <p className="font-body text-amber-500/70 text-xs">
                      {t.role} &middot; {t.location}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <hr className="section-divider" />

      {/* ===== 6b. FAQ ===== */}
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
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-widest text-warm-50 mb-4">
              YOUR FANS ARE EVERYWHERE
            </h2>
            <p className="font-body text-gray-400 text-base max-w-2xl mx-auto leading-relaxed">
              List your events on MiraCulture and let fans across the world
              support your music directly — while ensuring local fans get in
              fairly.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[
              {
                title: 'DIRECT REVENUE',
                desc: 'Every support ticket purchase goes straight to you. No middlemen taking 40% cuts.',
                stat: '100%',
                statLabel: 'to artist',
                icon: (
                  <svg className="w-7 h-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                title: 'GLOBAL FANBASE',
                desc: 'Fans from 40+ countries can support your show — even from the other side of the planet.',
                stat: '40+',
                statLabel: 'countries',
                icon: (
                  <svg className="w-7 h-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                ),
              },
              {
                title: 'FAIR DISTRIBUTION',
                desc: 'Your real fans get in — not resellers, not bots. Every seat goes to someone who wants to be there.',
                stat: '0%',
                statLabel: 'scalper rate',
                icon: (
                  <svg className="w-7 h-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                ),
              },
            ].map((card, i) => (
              <div
                key={card.title}
                className="card-hover bg-noir-950 border border-noir-800 rounded-lg p-6 group animate-fade-in-up"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-amber-500/60 group-hover:text-amber-500 transition-colors duration-300">
                    {card.icon}
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl text-amber-500/40 group-hover:text-amber-500/60 transition-colors duration-300">
                      {card.stat}
                    </div>
                    <div className="font-body text-[10px] tracking-widest uppercase text-gray-400">
                      {card.statLabel}
                    </div>
                  </div>
                </div>
                <h3 className="font-body font-semibold text-warm-50 text-base mb-2">
                  {card.title}
                </h3>
                <p className="font-body text-gray-400 text-sm leading-relaxed">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              to="/register?role=artist"
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
              <div key={badge.label} className="flex flex-col items-center gap-2.5 group cursor-default">
                <div className="text-gray-500 group-hover:text-amber-500/70 transition-all duration-300 group-hover:-translate-y-1">
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

      {/* ===== 8b. AS SEEN IN ===== */}
      <Section className="py-10 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-body text-[10px] tracking-[0.3em] uppercase text-gray-400 mb-6">
            As Featured In
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-8 md:gap-x-10 gap-y-3">
            {PRESS_LOGOS.map((name) => (
              <span
                key={name}
                className="font-display text-base sm:text-lg md:text-xl tracking-widest uppercase text-gray-700/50 hover:text-gray-500 transition-colors duration-300 cursor-default select-none"
              >
                {name}
              </span>
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
            className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-wider text-warm-50 mb-6 glow-text"
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
          <div className="mt-14 max-w-md mx-auto">
            <p className="font-body text-gray-400 text-xs tracking-widest uppercase mb-3">
              Stay in the loop
            </p>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="email"
                placeholder="your@email.com"
                aria-label="Email address"
                className="flex-1 px-4 py-2.5 bg-noir-900 border border-noir-700 rounded-sm text-sm font-body text-gray-200 placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none transition-colors duration-200"
              />
              <button
                type="submit"
                className="btn-amber px-5 py-2.5 text-sm whitespace-nowrap"
              >
                Notify Me
              </button>
            </form>
            <p className="font-body text-gray-500 text-xs mt-2">
              No spam. Unsubscribe anytime.
            </p>
          </div>

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
