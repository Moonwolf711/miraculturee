import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ActivityFeedItem, ArtistRelationship, SupportedCampaign } from './types.js';
import { formatCents, formatDate, timeAgo } from './types.js';

// --- Activity Feed ---

interface ActivityFeedProps {
  items: ActivityFeedItem[];
}

const FEED_ICONS: Record<ActivityFeedItem['type'], { icon: string; color: string }> = {
  support: { icon: '\u2665', color: 'text-pink-400 bg-pink-500/10' },
  raffle_entry: { icon: '\uD83C\uDFB2', color: 'text-amber-400 bg-amber-500/10' },
  raffle_win: { icon: '\uD83C\uDFC6', color: 'text-green-400 bg-green-500/10' },
  ticket_purchase: { icon: '\uD83C\uDF9F', color: 'text-cyan-400 bg-cyan-500/10' },
};

export default function ActivityFeed({ items }: ActivityFeedProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);

  return (
    <div className="bg-noir-900 border border-noir-800 rounded-xl overflow-hidden">
      <div className="divide-y divide-noir-800">
        {visible.map((item) => {
          const style = FEED_ICONS[item.type];
          return (
            <Link
              key={item.id}
              to={`/events/${item.eventId}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-noir-800/50 transition-colors"
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${style.color}`}>
                {style.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-gray-300 text-sm truncate">{item.message}</p>
                <p className="text-gray-600 text-xs">{timeAgo(item.createdAt)}</p>
              </div>
              {item.amountCents !== null && (
                <span className="text-gray-500 text-xs font-medium flex-shrink-0">
                  {formatCents(item.amountCents)}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      {items.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2.5 text-xs text-gray-500 hover:text-amber-400 border-t border-noir-800 transition-colors"
        >
          {expanded ? 'Show less' : `Show ${items.length - 5} more`}
        </button>
      )}
    </div>
  );
}

// --- Artist Relationship Card ---

const FAN_LEVEL_COLORS: Record<string, { badge: string; accent: string }> = {
  PLATINUM: { badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30', accent: 'text-purple-400' },
  GOLD: { badge: 'bg-amber-500/15 text-amber-300 border-amber-400/30', accent: 'text-amber-400' },
  SILVER: { badge: 'bg-gray-400/15 text-gray-300 border-gray-400/30', accent: 'text-gray-300' },
  BRONZE: { badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', accent: 'text-orange-400' },
};

export function ArtistRelationshipCard({ data }: { data: ArtistRelationship }) {
  const levelStyle = FAN_LEVEL_COLORS[data.fanLevel] ?? FAN_LEVEL_COLORS.BRONZE;
  const totalCents = data.totalSupportedCents + data.totalTicketCents;

  return (
    <div className="bg-noir-900 border border-noir-800 rounded-xl p-4 hover:border-noir-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* Artist initial avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${levelStyle.badge}`}>
              {data.stageName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-warm-50 font-medium text-sm truncate">{data.stageName}</p>
              {data.genre && <p className="text-gray-600 text-[10px] uppercase tracking-wider">{data.genre}</p>}
            </div>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-semibold border ${levelStyle.badge}`}>
          {data.fanLevelLabel}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className={`text-lg font-semibold ${levelStyle.accent}`}>{data.totalInteractions}</p>
          <p className="text-gray-600 text-[9px] uppercase tracking-wider">Interactions</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-warm-50">{data.uniqueEvents}</p>
          <p className="text-gray-600 text-[9px] uppercase tracking-wider">Events</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-warm-50">${(totalCents / 100).toFixed(0)}</p>
          <p className="text-gray-600 text-[9px] uppercase tracking-wider">Total</p>
        </div>
      </div>

      {/* Level progress bar */}
      <div className="mt-3">
        <ArtistLevelProgress level={data.fanLevel} interactions={data.totalInteractions} />
      </div>
    </div>
  );
}

function ArtistLevelProgress({ level, interactions }: { level: string; interactions: number }) {
  const thresholds = [
    { level: 'BRONZE', min: 1, next: 3 },
    { level: 'SILVER', min: 3, next: 5 },
    { level: 'GOLD', min: 5, next: 10 },
    { level: 'PLATINUM', min: 10, next: 10 },
  ];
  const current = thresholds.find((t) => t.level === level) ?? thresholds[0];
  const progress = level === 'PLATINUM' ? 1 : Math.min(1, (interactions - current.min) / (current.next - current.min));
  const nextLabel = level === 'PLATINUM' ? null : thresholds[thresholds.indexOf(current) + 1]?.level.toLowerCase();

  return (
    <div>
      <div className="w-full h-1 bg-noir-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-700"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {nextLabel && (
        <p className="text-gray-600 text-[9px] mt-1 text-right">
          {current.next - interactions} more to {nextLabel}
        </p>
      )}
    </div>
  );
}

// --- Supported Campaign Card with Ticket Visualization ---

export function SupportedCampaignCard({ data }: { data: SupportedCampaign }) {
  const c = data.campaign;
  const ticketsFunded = c && c.goalCents > 0 ? Math.min(10, Math.round((c.fundedCents / c.goalCents) * 10)) : 0;

  return (
    <Link
      to={`/events/${data.event.id}`}
      className="block bg-noir-900 border border-noir-800 rounded-xl p-4 hover:border-noir-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-warm-50 font-medium text-sm truncate">{data.event.title}</p>
          <p className="text-gray-500 text-xs">{data.event.venueName} &middot; {formatDate(data.event.date)}</p>
        </div>
        <span className="text-amber-400 text-sm font-medium flex-shrink-0">
          {formatCents(data.amountCents)}
        </span>
      </div>

      {c && c.goalCents > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] mb-2">
            <span className="text-gray-500">
              {ticketsFunded} of 10 tickets funded
            </span>
            {c.goalReached ? (
              <span className="text-green-400 font-semibold">Goal Reached!</span>
            ) : (
              <span className="text-gray-500">${(c.fundedCents / 100).toFixed(0)} / ${(c.goalCents / 100).toFixed(0)}</span>
            )}
          </div>
          {/* Ticket icon visualization */}
          <div className="flex gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-6 rounded transition-all duration-500 flex items-center justify-center ${
                  i < ticketsFunded
                    ? c.goalReached ? 'bg-green-500/20 border border-green-500/40' : 'bg-amber-500/20 border border-amber-500/40'
                    : 'bg-noir-800 border border-noir-700'
                }`}
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <svg className={`w-3 h-3 ${
                  i < ticketsFunded
                    ? c.goalReached ? 'text-green-400' : 'text-amber-400'
                    : 'text-noir-700'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
            ))}
          </div>
          {c.bonusCents > 0 && (
            <p className="text-amber-400/70 text-[10px] mt-2">
              Artist bonus: ${(c.bonusCents / 100).toFixed(2)}
            </p>
          )}
        </div>
      )}
    </Link>
  );
}
