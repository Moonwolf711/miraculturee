import type { Transaction } from './types.js';
import { formatCents, formatDateTime } from './types.js';
import { EmptyState, LoadingList } from './UpcomingTickets.js';

interface RafflesTabProps {
  raffles: Transaction[] | null;
  loading: boolean;
}

export default function RafflesTab({ raffles, loading }: RafflesTabProps) {
  if (loading) return <LoadingList />;

  if (!raffles || raffles.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
            <circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
            <circle cx="8.5" cy="15.5" r="1" fill="currentColor" />
            <circle cx="15.5" cy="15.5" r="1" fill="currentColor" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
          </svg>
        }
        message="No raffle entries yet."
        hint="Enter for $5 on any event page — winners are drawn with a provably fair, verifiable algorithm."
        ctaText="Find a Raffle"
        ctaLink="/events"
      />
    );
  }

  return (
    <div className="space-y-3">
      {raffles.map((entry) => (
        <div key={entry.id} className="bg-noir-900 border border-noir-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-warm-50 font-medium text-sm">Raffle Entry</p>
              <p className="text-gray-500 text-xs mt-0.5">{formatDateTime(entry.createdAt)}</p>
            </div>
            <span className="text-sm font-medium text-gray-300">{formatCents(entry.amountCents)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
