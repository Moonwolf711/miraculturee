import { useState, useEffect, useRef } from 'react';
import type { DashboardStats as DashboardStatsType } from './types.js';
import { formatCents } from './types.js';

interface DashboardStatsProps {
  stats: DashboardStatsType | undefined;
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="md:col-span-2 grid grid-cols-2 gap-3">
      <AnimatedStatCard label="Raffle Entries" value={stats?.totalRaffleEntries ?? 0} />
      <AnimatedStatCard label="Raffle Wins" value={stats?.raffleWins ?? 0} highlight />
      <AnimatedStatCard label="Tickets Owned" value={stats?.ticketsOwned ?? 0} />
      <AnimatedStatCard label="Total Supported" value={formatCents(stats?.totalSupportedCents ?? 0)} prefix="$" />
    </div>
  );
}

// --- Animated Stat Card ---

function AnimatedStatCard({ label, value, highlight, prefix }: { label: string; value: number | string; highlight?: boolean; prefix?: string }) {
  const numericValue = typeof value === 'number' ? value : null;
  return (
    <div className="bg-noir-900 border border-noir-800 rounded-xl p-4 hover:border-noir-700 transition-all duration-200 group">
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${highlight ? 'text-amber-400' : 'text-warm-50'}`}>
        {numericValue !== null ? (
          <CountUpNumber value={numericValue} />
        ) : (
          value
        )}
      </p>
    </div>
  );
}

// --- Animated Count-Up Number ---

export function CountUpNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (animated.current) return;
    animated.current = true;
    const duration = 800;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(eased * value));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  return <span ref={ref} className={className}>{display.toLocaleString()}</span>;
}
