/* ------------------------------------------------------------------
   Subtle connection status indicator.
   Shows a small colored dot in the header area:
   - Green:  connected (fades out after 3s)
   - Amber:  reconnecting (pulses)
   - Red:    disconnected (static, shown after extended downtime)
   - Hidden: while initially connecting (no flash on page load)
   ------------------------------------------------------------------ */

import { useState, useEffect, useRef } from 'react';
import { useConnectionState } from '../hooks/useWebSocket.js';
import type { ConnectionState } from '../lib/ws.js';

const LABELS: Record<ConnectionState, string> = {
  connecting: 'Connecting to live updates...',
  connected: 'Live updates active',
  reconnecting: 'Reconnecting to live updates...',
  disconnected: 'Live updates unavailable',
};

export default function ConnectionStatus() {
  const state = useConnectionState();
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Don't show initial "connecting" — only show after first connection
    if (state === 'connecting') {
      setVisible(false);
      return;
    }

    if (state === 'connected') {
      // Briefly show "connected" then fade out
      setVisible(true);
      hideTimer.current = setTimeout(() => setVisible(false), 3000);
    } else {
      // reconnecting / disconnected — keep visible
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    }

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [state]);

  if (!visible) return null;

  const dotColor =
    state === 'connected'
      ? 'bg-emerald-400'
      : state === 'reconnecting'
        ? 'bg-amber-400 animate-pulse'
        : 'bg-red-400';

  return (
    <div
      className="flex items-center gap-1.5 transition-opacity duration-500"
      role="status"
      aria-live="polite"
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
      <span className="text-gray-500 text-[10px] tracking-wide uppercase font-body sr-only sm:not-sr-only">
        {LABELS[state]}
      </span>
    </div>
  );
}
