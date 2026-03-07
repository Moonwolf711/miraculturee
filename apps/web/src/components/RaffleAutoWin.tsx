import { useState, useEffect, useRef } from 'react';
import CountdownTimer from './CountdownTimer.js';

interface RaffleAutoWinProps {
  eventDate: string;
  uniqueEntrants: number;
  totalEntries: number;
  poolStatus: string;
  userEntered: boolean;
  onClaim?: () => void;
  claiming?: boolean;
}

function Confetti() {
  const colors = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#3b82f6', '#ef4444'];
  const particles = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      color: colors[i % colors.length],
      size: 4 + Math.random() * 6,
      drift: (Math.random() - 0.5) * 60,
    })),
  ).current;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          <div
            className="rounded-sm animate-confetti-spin"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              transform: `translateX(${p.drift}px)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function TickerCount({ target, label }: { target: number; label: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target <= 0) return;
    const step = Math.max(1, Math.floor(target / 30));
    const id = setInterval(() => {
      setCount((prev) => {
        const next = prev + step;
        if (next >= target) {
          clearInterval(id);
          return target;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="text-center">
      <div className="font-mono text-4xl sm:text-5xl font-bold text-amber-400 tabular-nums">
        {count}
      </div>
      <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}

export default function RaffleAutoWin({
  eventDate,
  uniqueEntrants,
  totalEntries,
  poolStatus,
  userEntered,
  onClaim,
  claiming,
}: RaffleAutoWinProps) {
  const [phase, setPhase] = useState<'countdown' | 'reveal' | 'claim'>('countdown');
  const isShowDay = new Date(eventDate).setHours(0, 0, 0, 0) <= Date.now();
  const everyoneWins = uniqueEntrants > 0 && uniqueEntrants <= 10;
  const drawComplete = poolStatus === 'COMPLETED';

  useEffect(() => {
    if (drawComplete || (isShowDay && everyoneWins)) {
      setPhase('reveal');
      const timer = setTimeout(() => setPhase('claim'), 3000);
      return () => clearTimeout(timer);
    }
  }, [drawComplete, isShowDay, everyoneWins]);

  // Pre-show: countdown
  if (phase === 'countdown' && !isShowDay) {
    return (
      <div className="bg-gradient-to-b from-noir-800 to-noir-900 border border-noir-600 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-emerald-500/5" />
        <div className="relative">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-display text-xs tracking-widest text-emerald-400 uppercase">
              Raffle Drawing In
            </span>
          </div>
          <CountdownTimer
            targetDate={eventDate}
            onComplete={() => setPhase('reveal')}
          />
          <div className="flex items-center justify-center gap-6 mt-5 pt-4 border-t border-noir-700">
            <div className="text-center">
              <span className="text-2xl font-bold text-amber-400 font-mono">{uniqueEntrants}</span>
              <span className="block text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                {uniqueEntrants === 1 ? 'Entrant' : 'Entrants'}
              </span>
            </div>
            <div className="w-px h-8 bg-noir-700" />
            <div className="text-center">
              <span className="text-2xl font-bold text-gray-300 font-mono">{totalEntries}</span>
              <span className="block text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                Total Entries
              </span>
            </div>
            {everyoneWins && (
              <>
                <div className="w-px h-8 bg-noir-700" />
                <div className="text-center">
                  <span className="text-sm font-bold text-emerald-400">EVERYONE WINS</span>
                  <span className="block text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                    {'\u2264'}10 entrants
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Reveal phase: tickers counting up + confetti
  if (phase === 'reveal') {
    return (
      <div className="bg-gradient-to-b from-noir-800 to-noir-900 border border-emerald-500/30 rounded-xl p-8 relative overflow-hidden">
        <Confetti />
        <div className="relative text-center">
          <div className="mb-6">
            <span className="inline-block text-5xl mb-2 animate-bounce">
              {everyoneWins ? '\uD83C\uDF89' : '\uD83C\uDFB0'}
            </span>
            <h3 className="font-display text-xl tracking-wider text-emerald-400 uppercase animate-fade-in">
              {everyoneWins ? 'Everyone Gets a Ticket!' : 'Raffle Drawing...'}
            </h3>
            <p className="text-gray-400 text-sm mt-2 animate-fade-in">
              {everyoneWins
                ? `Only ${uniqueEntrants} ${uniqueEntrants === 1 ? 'person' : 'people'} entered — no draw needed!`
                : 'The cryptographic draw is being processed...'}
            </p>
          </div>
          <div className="flex justify-center gap-8">
            <TickerCount target={uniqueEntrants} label="Winners" />
            <TickerCount target={uniqueEntrants} label="Tickets" />
          </div>
        </div>
      </div>
    );
  }

  // Claim phase: the button
  return (
    <div className="bg-gradient-to-b from-noir-800 to-noir-900 border border-emerald-500/30 rounded-xl p-8 relative overflow-hidden">
      {everyoneWins && <Confetti />}
      <div className="relative text-center">
        <span className="inline-block text-4xl mb-3">{everyoneWins ? '\uD83C\uDF9F\uFE0F' : '\uD83C\uDFC6'}</span>
        <h3 className="font-display text-lg tracking-wider text-emerald-400 uppercase mb-2">
          {everyoneWins ? 'Your Free Ticket Awaits!' : 'Draw Complete!'}
        </h3>
        <p className="text-gray-400 text-sm mb-6">
          {everyoneWins
            ? `All ${uniqueEntrants} fans get a ticket. Claim yours below!`
            : 'Check if you won below.'}
        </p>

        {userEntered && everyoneWins && onClaim && (
          <button
            onClick={onClaim}
            disabled={claiming}
            className="group relative px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-noir-950 font-bold rounded-xl text-lg transition-all duration-300 disabled:opacity-50 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/40 hover:scale-105 active:scale-95 animate-fade-in-up"
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
              </svg>
              {claiming ? 'Claiming...' : 'CLAIM YOUR FREE TICKET'}
            </span>
            <span className="absolute inset-0 rounded-xl border-2 border-emerald-300/0 group-hover:border-emerald-300/50 transition-colors" />
          </button>
        )}

        {!userEntered && (
          <p className="text-amber-400 text-sm">
            You didn't enter this raffle. Enter daily for your chance!
          </p>
        )}
      </div>
    </div>
  );
}
