import type { ImpactData } from './types.js';
import { TIER_CONFIG } from './types.js';
import { CountUpNumber } from './DashboardStats.js';
import InfoTooltip from '../Tooltip.js';

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
    <div className={`bg-noir-900 border ${tier.border} rounded-xl p-5 flex flex-col items-center justify-center relative ${tier.glow ? `shadow-lg ${tier.glow}` : ''}`}>
      {/* Ambient glow — rounded to match card since the card can't clip (tooltip must escape) */}
      <div className="absolute inset-0 rounded-xl opacity-5 bg-gradient-to-br from-amber-500 to-transparent pointer-events-none" />

      {/* How-it-works guidance */}
      <div className="absolute top-3 right-3 z-10">
        <InfoTooltip label="How Impact points work" align="right">
          <p className="font-semibold text-warm-50 mb-1.5">Earning Impact</p>
          <ul className="space-y-0.5">
            <li>Support a show &middot; <span className="text-amber-400">+20</span></li>
            <li>Each new artist backed &middot; <span className="text-amber-400">+20</span></li>
            <li>Raffle entry &middot; <span className="text-amber-400">+3</span></li>
            <li>Raffle win &middot; <span className="text-amber-400">+100</span></li>
            <li>Ticket purchase &middot; <span className="text-amber-400">+30</span></li>
            <li>Every $1 supported &middot; <span className="text-amber-400">+1</span></li>
            <li>Each day as a member &middot; <span className="text-amber-400">+1</span></li>
          </ul>
          <p className="mt-2 pt-2 border-t border-noir-700 text-gray-500">
            Tiers: Front Row 200 &middot; VIP 500 &middot; Headliner 1,000 &middot; Legend 2,500
          </p>
        </InfoTooltip>
      </div>

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
