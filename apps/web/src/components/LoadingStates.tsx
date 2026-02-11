import type { ReactNode } from 'react';

/* ------------------------------------------------------------------
   Shared loading, empty, and inline-error state components.
   All styled to match the Concert Poster Noir theme.
   ------------------------------------------------------------------ */

/* ============== Pulse Dots (reusable animated dots) ============== */
export function PulseDots() {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
        style={{ animationDelay: '0ms' }}
      />
      <div
        className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
        style={{ animationDelay: '200ms' }}
      />
      <div
        className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
        style={{ animationDelay: '400ms' }}
      />
    </div>
  );
}

/* ============== Page-level loading (full min-h-screen) ============== */
export function PageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div
      className="min-h-screen bg-noir-950 flex flex-col items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <PulseDots />
      <p className="font-body text-gray-400 text-sm tracking-wide mt-4">
        {message}
      </p>
    </div>
  );
}

/* ============== Section-level loading skeleton ============== */
export function SectionLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16"
      role="status"
      aria-live="polite"
    >
      <PulseDots />
      <p className="font-body text-gray-400 text-sm tracking-wide mt-3">
        {message}
      </p>
    </div>
  );
}

/* ============== Card skeleton (shimmer placeholder) ============== */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-noir-800 border border-noir-700 rounded-xl overflow-hidden animate-pulse"
        >
          <div className="flex items-stretch">
            {/* Date badge placeholder */}
            <div className="flex-shrink-0 w-20 bg-noir-900 py-5 border-r border-noir-700">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-3 bg-noir-700 rounded" />
                <div className="w-6 h-7 bg-noir-700 rounded" />
              </div>
            </div>
            {/* Content placeholder */}
            <div className="flex-1 px-5 py-4 space-y-2">
              <div className="h-5 bg-noir-700 rounded w-3/4" />
              <div className="h-4 bg-noir-700 rounded w-1/2" />
              <div className="h-3 bg-noir-700 rounded w-1/3" />
            </div>
            {/* Price placeholder */}
            <div className="flex-shrink-0 flex flex-col items-end justify-center px-5 py-4">
              <div className="h-7 w-14 bg-noir-700 rounded" />
              <div className="h-3 w-20 bg-noir-700 rounded mt-2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============== Stats skeleton (for dashboard stats grid) ============== */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-noir-800 border border-noir-700 rounded-xl p-5">
          <div className="h-8 w-16 bg-noir-700 rounded mb-2" />
          <div className="h-3 w-24 bg-noir-700 rounded" />
        </div>
      ))}
    </div>
  );
}

/* ============== Empty state ============== */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-full border-2 border-noir-700 flex items-center justify-center mb-6">
          {icon}
        </div>
      )}
      <h2 className="font-display text-2xl tracking-wider text-gray-500 mb-2">
        {title}
      </h2>
      <p className="font-body text-gray-400 text-sm max-w-sm">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ============== Inline error with retry ============== */
export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-12 h-12 rounded-full border-2 border-red-500/30 flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-red-400"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      <p className="font-body text-gray-400 text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors text-sm tracking-wide uppercase"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/* ============== Page-level error (full min-h-screen) ============== */
export function PageError({
  message = 'Something went wrong.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4">
      <InlineError message={message} onRetry={onRetry} />
    </div>
  );
}
