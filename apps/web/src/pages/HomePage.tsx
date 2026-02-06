import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="bg-noir-950 min-h-screen">
      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Radial gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(217, 119, 6, 0.08) 0%, rgba(15, 15, 15, 0.6) 40%, #0a0a0a 70%)',
          }}
        />

        {/* Film grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
            backgroundRepeat: 'repeat',
          }}
        />

        {/* Subtle top/bottom vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(10,10,10,0.6) 0%, transparent 20%, transparent 80%, rgba(10,10,10,0.8) 100%)',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* Main title */}
          <h1
            className="font-display text-6xl sm:text-7xl md:text-8xl lg:text-9xl tracking-[0.3em] text-warm-50 mb-6 animate-fadeInUp"
            style={{
              animationDelay: '0ms',
              animationFillMode: 'both',
              textShadow:
                '0 0 40px rgba(245, 158, 11, 0.15), 0 0 80px rgba(245, 158, 11, 0.05)',
            }}
          >
            MIRACULTUREE
          </h1>

          {/* Subheading */}
          <p
            className="font-display text-lg sm:text-xl md:text-2xl tracking-widest text-amber-400 mb-8 animate-fadeInUp"
            style={{
              animationDelay: '200ms',
              animationFillMode: 'both',
            }}
          >
            FAN-POWERED TICKET REDISTRIBUTION
          </p>

          {/* Decorative divider */}
          <div
            className="flex items-center justify-center gap-4 mb-8 animate-fadeInUp"
            style={{
              animationDelay: '350ms',
              animationFillMode: 'both',
            }}
          >
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-500/40" />
            <div className="w-1.5 h-1.5 rotate-45 bg-amber-500/60" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-500/40" />
          </div>

          {/* Description */}
          <p
            className="font-body text-gray-400 text-base md:text-lg max-w-xl mx-auto leading-relaxed mb-12 animate-fadeInUp"
            style={{
              animationDelay: '500ms',
              animationFillMode: 'both',
            }}
          >
            Fans worldwide buy tickets to support artists they love. Local fans
            win those tickets through fair, cryptographic raffles for just $5.
            No scalpers. No bots. Just real fans supporting real music.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center animate-fadeInUp"
            style={{
              animationDelay: '700ms',
              animationFillMode: 'both',
            }}
          >
            <Link
              to="/events"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold font-body rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20"
            >
              Browse Events
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-gray-600 text-gray-300 font-semibold font-body rounded-lg transition-all duration-300 hover:border-amber-500 hover:text-amber-400"
            >
              Sign Up Free
            </Link>
          </div>

          {/* Scroll hint */}
          <div
            className="mt-20 animate-fadeInUp"
            style={{
              animationDelay: '1000ms',
              animationFillMode: 'both',
            }}
          >
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <span className="font-body text-xs tracking-widest uppercase">
                Scroll
              </span>
              <div className="w-px h-8 bg-gradient-to-b from-gray-600 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS SECTION ===== */}
      <section className="bg-noir-900 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Section title */}
          <div className="text-center mb-16">
            <p className="font-display text-sm tracking-[0.4em] text-amber-500/60 mb-3">
              THE PROCESS
            </p>
            <h2 className="font-display text-4xl md:text-5xl tracking-widest text-warm-50">
              HOW IT WORKS
            </h2>
            <div className="mt-6 flex items-center justify-center gap-3">
              <div className="h-px w-12 bg-amber-500/30" />
              <div className="w-1 h-1 rotate-45 bg-amber-500/50" />
              <div className="h-px w-12 bg-amber-500/30" />
            </div>
          </div>

          {/* Steps grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-noir-800 rounded-xl p-6 border-l-2 border-amber-500/30 relative group transition-all duration-300 hover:border-amber-500/60">
              <span className="font-display text-6xl text-amber-500/20 absolute top-4 right-6 leading-none select-none">
                1
              </span>
              <div className="relative z-10">
                <h3 className="font-body font-semibold text-warm-50 text-lg mb-3 mt-2">
                  FANS SUPPORT ARTISTS
                </h3>
                <p className="font-body text-gray-500 text-sm leading-relaxed">
                  Fans worldwide purchase tickets at face value to support their
                  favorite artists, knowing they won't attend the show. Every
                  ticket sold fuels the artist's career directly.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-noir-800 rounded-xl p-6 border-l-2 border-amber-500/30 relative group transition-all duration-300 hover:border-amber-500/60">
              <span className="font-display text-6xl text-amber-500/20 absolute top-4 right-6 leading-none select-none">
                2
              </span>
              <div className="relative z-10">
                <h3 className="font-body font-semibold text-warm-50 text-lg mb-3 mt-2">
                  LOCAL FANS ENTER RAFFLE
                </h3>
                <p className="font-body text-gray-500 text-sm leading-relaxed">
                  Fans near the venue enter a fair raffle for just $5. Our
                  geo-verification ensures only local fans who can actually
                  attend the show are eligible to participate.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-noir-800 rounded-xl p-6 border-l-2 border-amber-500/30 relative group transition-all duration-300 hover:border-amber-500/60">
              <span className="font-display text-6xl text-amber-500/20 absolute top-4 right-6 leading-none select-none">
                3
              </span>
              <div className="relative z-10">
                <h3 className="font-body font-semibold text-warm-50 text-lg mb-3 mt-2">
                  FAIR CRYPTOGRAPHIC DRAW
                </h3>
                <p className="font-body text-gray-500 text-sm leading-relaxed">
                  Winners are selected using a cryptographically fair algorithm
                  that's publicly verifiable. Win a ticket and enjoy the show
                  knowing the system is truly fair.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== BOTTOM CTA SECTION ===== */}
      <section
        className="relative py-24 px-6 overflow-hidden"
        style={{
          background:
            'linear-gradient(to bottom, #0f0f0f, rgba(217, 119, 6, 0.04) 50%, #0a0a0a)',
        }}
      >
        {/* Subtle horizontal lines for texture */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(245, 158, 11, 0.3) 40px, rgba(245, 158, 11, 0.3) 41px)',
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2
            className="font-display text-3xl sm:text-4xl md:text-5xl tracking-wider text-warm-50 mb-6"
            style={{
              textShadow: '0 0 30px rgba(245, 158, 11, 0.1)',
            }}
          >
            EVERY TICKET TELLS A STORY
          </h2>

          <p className="font-body text-gray-400 text-base md:text-lg max-w-lg mx-auto leading-relaxed mb-10">
            Behind every seat filled is a fan who believed in the music and
            another who got to experience it live. Join the movement
            rewriting how tickets reach the people who deserve them most.
          </p>

          <Link
            to="/events"
            className="inline-flex items-center justify-center px-10 py-4 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold font-body text-lg rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20"
          >
            EXPLORE EVENTS
          </Link>

          {/* Decorative bottom element */}
          <div className="mt-16 flex items-center justify-center gap-3">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-amber-500/20" />
            <div className="w-1.5 h-1.5 rotate-45 border border-amber-500/30" />
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-amber-500/20" />
          </div>
        </div>
      </section>
    </div>
  );
}
