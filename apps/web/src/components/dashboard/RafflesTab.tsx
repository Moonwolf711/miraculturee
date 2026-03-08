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
    return <EmptyState message="No raffle entries yet." ctaText="Browse Events" ctaLink="/events" />;
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
