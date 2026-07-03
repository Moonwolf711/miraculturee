import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { UpcomingTicket } from './types.js';
import { formatDate, getCountdown } from './types.js';

interface UpcomingTicketsProps {
  tickets: UpcomingTicket[];
  loading: boolean;
}

export default function UpcomingTickets({ tickets, loading }: UpcomingTicketsProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-warm-50 mb-4">Upcoming Events</h2>
      {loading ? (
        <LoadingList />
      ) : tickets.length > 0 ? (
        <div className="space-y-3">
          {tickets.map((t) => (
            <ContextualEventCard key={t.id} ticket={t} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          }
          message="No upcoming tickets yet."
          hint="Win a raffle or buy a ticket and it will show up here with a countdown and day-of-show reminders."
          ctaText="Browse Events"
          ctaLink="/events"
        />
      )}
    </div>
  );
}

// --- Contextual Event Card (pre-event / day-of / post-event) ---

export function ContextualEventCard({ ticket }: { ticket: UpcomingTicket }) {
  const [countdown, setCountdown] = useState(getCountdown(ticket.eventDate));

  useEffect(() => {
    const timer = setInterval(() => setCountdown(getCountdown(ticket.eventDate)), 60000);
    return () => clearInterval(timer);
  }, [ticket.eventDate]);

  const eventDate = new Date(ticket.eventDate);
  const now = new Date();
  const hoursUntil = (eventDate.getTime() - now.getTime()) / 3600000;
  const isDayOf = hoursUntil >= 0 && hoursUntil <= 24;
  const isPast = hoursUntil < 0;
  const isUrgent = hoursUntil > 0 && hoursUntil <= 24;

  // Day-of state
  if (isDayOf) {
    return (
      <Link
        to={`/events/${ticket.eventId}`}
        className="block bg-gradient-to-r from-amber-500/10 to-noir-900 border border-amber-500/30 rounded-xl p-4 shadow-lg shadow-amber-500/5 transition-all hover:border-amber-500/50"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Today's Show</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-warm-50 font-semibold truncate">{ticket.eventTitle}</p>
            <p className="text-gray-400 text-sm">{ticket.venueName} &middot; {ticket.venueCity}</p>
            <p className="text-amber-400 text-xs mt-1 font-medium">
              {eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              ticket.type === 'raffle' ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'
            }`}>
              {ticket.type === 'raffle' ? 'Raffle Win' : 'Purchased'}
            </span>
            {!countdown.past && (
              <span className="text-amber-400 font-mono text-sm font-bold animate-pulse">
                {countdown.hours}h {countdown.mins}m
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Post-event state
  if (isPast) {
    return (
      <Link
        to={`/events/${ticket.eventId}`}
        className="block bg-noir-900 border border-noir-800 rounded-xl p-4 hover:border-noir-700 transition-colors opacity-80"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-warm-50 font-medium truncate">{ticket.eventTitle}</p>
            <p className="text-gray-500 text-sm">{ticket.venueName} &middot; {ticket.venueCity}</p>
            <p className="text-gray-500 text-xs mt-1">{formatDate(ticket.eventDate)}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-noir-800 text-gray-500 uppercase tracking-wider">
              {ticket.status === 'REDEEMED' ? 'Attended' : 'Past Event'}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  // Pre-event state (default — with urgency glow for <1 day)
  return (
    <Link
      to={`/events/${ticket.eventId}`}
      className={`block bg-noir-900 border rounded-xl p-4 hover:border-noir-600 transition-all ${
        isUrgent ? 'border-amber-500/40 shadow-lg shadow-amber-500/5' : 'border-noir-800'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-warm-50 font-medium truncate">{ticket.eventTitle}</p>
          <p className="text-gray-500 text-sm">{ticket.venueName} &middot; {ticket.venueCity}</p>
          <p className="text-gray-500 text-xs mt-1">{formatDate(ticket.eventDate)}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            ticket.type === 'raffle' ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'
          }`}>
            {ticket.type === 'raffle' ? 'Raffle Win' : 'Purchased'}
          </span>
          <div className={isUrgent ? 'animate-pulse' : ''}>
            <span className={`text-xs font-mono font-medium ${isUrgent ? 'text-amber-400' : 'text-gray-400'}`}>
              {countdown.days > 0 ? `${countdown.days}d ` : ''}{countdown.hours}h {countdown.mins}m
            </span>
            <span className="text-[9px] text-gray-600 block text-right">until show</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// --- Shared Sub-components ---

export function EmptyState({ message, hint, icon, ctaText, ctaLink }: {
  message: string;
  hint?: string;
  icon?: React.ReactNode;
  ctaText?: string;
  ctaLink?: string;
}) {
  return (
    <div className="bg-noir-900 border border-noir-800 rounded-xl px-6 py-10 text-center">
      {icon && (
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-noir-800 border border-noir-700 flex items-center justify-center text-gray-500" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-gray-300 text-sm font-medium">{message}</p>
      {hint && (
        <p className="text-gray-500 text-xs mt-2 max-w-sm mx-auto leading-relaxed">{hint}</p>
      )}
      {ctaText && ctaLink && (
        <Link
          to={ctaLink}
          className="inline-block mt-5 px-5 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/20 hover:border-amber-500/50 transition-all"
        >
          {ctaText}
        </Link>
      )}
    </div>
  );
}

export function LoadingList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-noir-900 border border-noir-800 rounded-xl p-4 animate-pulse">
          <div className="h-4 bg-noir-700 rounded w-48 mb-2" />
          <div className="h-3 bg-noir-700 rounded w-32" />
        </div>
      ))}
    </div>
  );
}

export function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-noir-900 border border-noir-800 rounded-xl p-8 animate-pulse flex justify-center">
        <div className="w-28 h-28 bg-noir-700 rounded-full" />
      </div>
      <div className="md:col-span-2 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-noir-900 border border-noir-800 rounded-xl p-4 animate-pulse">
            <div className="h-3 bg-noir-700 rounded w-16 mb-3" />
            <div className="h-7 bg-noir-700 rounded w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
