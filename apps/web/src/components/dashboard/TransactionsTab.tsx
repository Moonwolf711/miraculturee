import type { PaginatedTransactions } from './types.js';
import { TX_TYPE_LABELS, formatCents, formatDateTime } from './types.js';
import { EmptyState, LoadingList } from './UpcomingTickets.js';

interface TransactionsTabProps {
  transactions: PaginatedTransactions | null;
  loading: boolean;
  page: number;
  onPageChange: (page: number) => void;
}

export default function TransactionsTab({ transactions, loading, page, onPageChange }: TransactionsTabProps) {
  if (loading) return <LoadingList />;

  if (!transactions || transactions.data.length === 0) {
    return <EmptyState message="No transactions yet." />;
  }

  return (
    <>
      <div className="space-y-2">
        {transactions.data.map((tx) => (
          <div key={tx.id} className="bg-noir-900 border border-noir-800 rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-warm-50 font-medium text-sm">
                  {TX_TYPE_LABELS[tx.type] ?? tx.type}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">{formatDateTime(tx.createdAt)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-medium text-gray-300">{formatCents(tx.amountCents)}</p>
                <p className={`text-[10px] uppercase font-medium ${
                  tx.status === 'completed' ? 'text-green-400' :
                  tx.status === 'pending' ? 'text-amber-400' : 'text-gray-500'
                }`}>
                  {tx.status}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {transactions.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="text-sm text-gray-400 hover:text-amber-400 disabled:opacity-30 transition-colors">Previous</button>
          <span className="text-xs text-gray-500">{page} / {transactions.totalPages}</span>
          <button disabled={page >= transactions.totalPages} onClick={() => onPageChange(page + 1)} className="text-sm text-gray-400 hover:text-amber-400 disabled:opacity-30 transition-colors">Next</button>
        </div>
      )}
    </>
  );
}
