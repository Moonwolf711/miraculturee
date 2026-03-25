import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import type { UpcomingTicket, SupportedCampaign, Transaction } from './types.js';
import { formatCents, formatDate, getCountdown } from './types.js';
import { EmptyState, LoadingList } from './UpcomingTickets.js';

type SubFilter = 'all' | 'tickets' | 'raffles' | 'supported';

export default function MyShowsTab() {
  const [filter, setFilter] = useState<SubFilter>('all');
  const [tickets, setTickets] = useState<UpcomingTicket[]>([]);
  const [raffles, setRaffles] = useState<Transaction[]>([]);
  const [supported, setSupported] = useState<SupportedCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<{ stats: unknown; upcomingTickets: UpcomingTicket[] }>('/user/dashboard')
        .then(r => setTickets(r.upcomingTickets))
        .catch(() => {}),
      api.get<{ data: Transaction[]; total: number }>('/user/transactions?limit=50')
        .then(r => setRaffles(r.data.filter(t => t.type === 'RAFFLE_ENTRY')))
        .catch(() => {}),
      api.get<SupportedCampaign[]>('/user/supported-campaigns')
        .then(setSupported)
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingList />;

  const hasAnything = tickets.length > 0 || raffles.length > 0 || supported.length > 0;

  if (!hasAnything) {
    return <EmptyState message="No show activity yet." ctaText="Browse Events" ctaLink="/events" />;
  }

  const filters: { key: SubFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: tickets.length + raffles.length + supported.length },
    { key: 'tickets', label: 'Tickets', count: tickets.length },
    { key: 'raffles', label: 'Raffles', count: raffles.length },
    { key: 'supported', label: 'Supported', count: supported.length },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-filters */}
      <div className="flex gap-2">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f.key
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-noir-900 text-gray-500 border border-noir-800 hover:text-gray-300'
            }`}
          >
            {f.label}
            {f.count > 0 && <span className="ml-1.5 text-xs opacity-60">{f.count}</span>}
          </button>
        ))}
      </div>

      {/* Tickets */}
      {(filter === 'all' || filter === 'tickets') && tickets.length > 0 && (
        <div>
          {filter === 'all' && (
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Tickets</h3>
          )}
          <div className="space-y-3">
            {tickets.map(t => {
              const cd = getCountdown(t.eventDate);
              return (
                <Link
                  key={t.id}
                  to={`/events/${t.eventId}`}
                  className="block bg-noir-900 border border-noir-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-warm-50 font-medium">{t.eventTitle}</p>
                      <p className="text-gray-500 text-sm mt-0.5">
                        {t.venueName} &middot; {t.venueCity} &middot; {formatDate(t.eventDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        t.type === 'raffle'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-green-500/10 text-green-400 border border-green-500/20'
                      }`}>
                        {t.type === 'raffle' ? 'Raffle Win' : 'Purchased'}
                      </span>
                      {!cd.past && (
                        <p className="text-xs text-gray-600 mt-1">
                          {cd.days > 0 ? `${cd.days}d` : `${cd.hours}h`} away
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Raffles */}
      {(filter === 'all' || filter === 'raffles') && raffles.length > 0 && (
        <div>
          {filter === 'all' && (
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Raffle Entries</h3>
          )}
          <div className="space-y-3">
            {raffles.map(entry => (
              <div key={entry.id} className="bg-noir-900 border border-noir-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-warm-50 font-medium text-sm">Raffle Entry</p>
                    <p className="text-gray-500 text-xs mt-0.5">{formatDate(entry.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300">{formatCents(entry.amountCents)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      entry.status === 'completed'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {entry.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supported Campaigns */}
      {(filter === 'all' || filter === 'supported') && supported.length > 0 && (
        <div>
          {filter === 'all' && (
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Shows You've Backed</h3>
          )}
          <div className="space-y-3">
            {supported.map(sc => (
              <Link
                key={sc.supportId}
                to={`/events/${sc.event.id}`}
                className="block bg-noir-900 border border-noir-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-warm-50 font-medium">{sc.event.title}</p>
                    <p className="text-gray-500 text-sm mt-0.5">
                      {sc.event.venueName} &middot; {sc.event.venueCity} &middot; {formatDate(sc.event.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-amber-400 font-medium text-sm">{formatCents(sc.amountCents)}</span>
                    {sc.campaign && (
                      <div className="mt-1">
                        <div className="w-20 h-1.5 bg-noir-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${Math.min(100, (sc.campaign.fundedCents / sc.campaign.goalCents) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
