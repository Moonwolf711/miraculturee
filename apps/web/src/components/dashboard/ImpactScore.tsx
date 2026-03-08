import type { ImpactData } from './types.js';
import { TIER_CONFIG } from './types.js';
import { CountUpNumber } from './DashboardStats.js';

interface ImpactScoreProps {
  impact: ImpactData;
}

export default function ImpactScore({ impact }: ImpactScoreProps) {
  const tier = TIER_CONFIG[impact.tier] ?? TIER_CONFIG.OPENING_ACT;
  const nextMin = impact.nextTier?.min ?? impact.score;
  const currentTierMin = impact.nextTier
    ? [0, 200, 500, 1000, 2500].find((m) => m <= impact.score && impact.score < (impact.nextTier?.min ?? Infinity)) ?? 0
    : 2500;
  const progress = impact.nextTier
    ? Math.min(1, (impact.score - currentTierMin) / (nextMin - currentTierMin))
    : 1;

  return (
    <div className={`bg-noir-900 border ${tier.border} rounded-xl p-5 flex flex-col items-center justify-center relative overflow-hidden ${tier.glow ? `shadow-lg ${tier.glow}` : ''}`}>
      {/* Ambient glow */}
      <div className="absolute inset-0 opacity-5 bg-gradient-to-br from-amber-500 to-transparent pointer-events-none" />

      {/* SVG Ring */}
      <div className="relative w-28 h-28 mb-3">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="6" className="text-noir-800" />
          <circle
            cx="60" cy="60" r="52" fill="none" strokeWidth="6"
            strokeLinecap="round"
            className="text-amber-500 transition-all duration-1000 ease-out"
            strokeDasharray={`${progress * 326.73} 326.73`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <CountUpNumber value={impact.score} className="text-2xl font-bold text-warm-50" />
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">Impact</span>
        </div>
      </div>

      {/* Tier Badge */}
      <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold ${tier.bg} ${tier.color} border ${tier.border}`}>
        {impact.tierLabel}
      </span>

      {/* Next tier progress */}
      {impact.nextTier && (
        <p className="text-gray-500 text-[10px] mt-2 text-center">
          {impact.nextTier.min - impact.score} pts to {impact.nextTier.label}
        </p>
      )}
    </div>
  );
}
