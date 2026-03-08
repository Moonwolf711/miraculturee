import type { PaginatedNotifications } from './types.js';
import { formatDateTime } from './types.js';
import { EmptyState, LoadingList } from './UpcomingTickets.js';

interface NotificationsPanelProps {
  notifications: PaginatedNotifications | null;
  loading: boolean;
  filter: 'all' | 'unread';
  page: number;
  onFilterChange: (filter: 'all' | 'unread') => void;
  onPageChange: (page: number) => void;
  onMarkRead: (id: string) => void;
}

export default function NotificationsPanel({
  notifications,
  loading,
  filter,
  page,
  onFilterChange,
  onPageChange,
  onMarkRead,
}: NotificationsPanelProps) {
  return (
    <div>
      <div className="flex gap-3 mb-4">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`text-sm px-3 py-1 rounded-full transition-colors ${
              filter === f
                ? 'bg-amber-500/10 text-amber-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {f === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingList />
      ) : notifications && notifications.data.length > 0 ? (
        <>
          <div className="space-y-2">
            {notifications.data.map((n) => (
              <div
                key={n.id}
                className={`bg-noir-900 border border-noir-800 rounded-xl p-4 ${
                  !n.read ? 'border-l-2 border-l-amber-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-warm-50 font-medium text-sm">{n.title}</p>
                    <p className="text-gray-400 text-sm mt-0.5">{n.body}</p>
                    <p className="text-gray-500 text-xs mt-1">{formatDateTime(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => onMarkRead(n.id)}
                      className="text-xs text-amber-400 hover:text-amber-300 flex-shrink-0 transition-colors"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {notifications.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="text-sm text-gray-400 hover:text-amber-400 disabled:opacity-30 transition-colors">Previous</button>
              <span className="text-xs text-gray-500">{page} / {notifications.totalPages}</span>
              <button disabled={page >= notifications.totalPages} onClick={() => onPageChange(page + 1)} className="text-sm text-gray-400 hover:text-amber-400 disabled:opacity-30 transition-colors">Next</button>
            </div>
          )}
        </>
      ) : (
        <EmptyState message="No notifications." />
      )}
    </div>
  );
}
