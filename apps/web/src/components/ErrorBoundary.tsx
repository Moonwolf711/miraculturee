import { Component, type ErrorInfo, type ReactNode } from 'react';

/* ------------------------------------------------------------------
   Error Boundary — catches render errors in child component trees.
   Class component required because React does not yet support
   componentDidCatch / getDerivedStateFromError in function components.
   ------------------------------------------------------------------ */

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI. Receives the error and a reset callback. */
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
  /** Isolate label — shown in the default fallback to help users identify the broken section. */
  label?: string;
  /** Called when an error is caught. Use for logging / telemetry. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback, label } = this.props;

    if (error) {
      if (fallback) {
        return fallback({ error, reset: this.reset });
      }
      return <DefaultErrorFallback error={error} reset={this.reset} label={label} />;
    }

    return children;
  }
}

/* ------------------------------------------------------------------
   Default fallback UI — Concert Poster Noir themed
   ------------------------------------------------------------------ */
function DefaultErrorFallback({
  error,
  reset,
  label,
}: {
  error: Error;
  reset: () => void;
  label?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      {/* Icon */}
      <div className="w-14 h-14 rounded-full border-2 border-red-500/30 flex items-center justify-center mb-5">
        <svg
          className="w-7 h-7 text-red-400"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>

      <h2 className="font-display text-xl tracking-wider text-warm-50 mb-2">
        {label ? `${label} — SOMETHING WENT WRONG` : 'SOMETHING WENT WRONG'}
      </h2>

      <p className="font-body text-gray-400 text-sm max-w-md mb-2">
        An unexpected error occurred. You can try again or refresh the page.
      </p>

      {/* Error message (collapsed by default in production) */}
      <details className="mb-6 max-w-md w-full">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 transition-colors">
          Technical details
        </summary>
        <pre className="mt-2 text-xs text-red-400/80 bg-noir-900 border border-noir-800 rounded-lg p-3 overflow-x-auto text-left whitespace-pre-wrap break-words">
          {error.message}
        </pre>
      </details>

      <button
        onClick={reset}
        className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors text-sm tracking-wide uppercase"
      >
        Try Again
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------
   Full-page error fallback — used around top-level routes
   ------------------------------------------------------------------ */
export function PageErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-noir-950 flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full border-2 border-red-500/30 flex items-center justify-center mb-6 mx-auto">
          <svg
            className="w-8 h-8 text-red-400"
            aria-hidden="true"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h1 className="font-display text-3xl tracking-wider text-warm-50 mb-3">
          SOMETHING WENT WRONG
        </h1>
        <p className="font-body text-gray-400 text-sm mb-2">
          The page encountered an unexpected error and could not render.
        </p>

        <details className="mb-6" role="alert">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 transition-colors">
            Technical details
          </summary>
          <pre className="mt-2 text-xs text-red-400/80 bg-noir-900 border border-noir-800 rounded-lg p-3 overflow-x-auto text-left whitespace-pre-wrap break-words">
            {error.message}
          </pre>
        </details>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-noir-950 font-semibold rounded-lg transition-colors text-sm tracking-wide uppercase"
          >
            Try Again
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className="px-6 py-2.5 border border-noir-700 text-gray-400 hover:text-gray-300 hover:border-noir-600 font-medium rounded-lg transition-colors text-sm"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
