import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/* ------------------------------------------------------------------
   InfoTooltip — accessible inline guidance bubble.

   A small "?" trigger that reveals help content on hover, keyboard
   focus, or tap (touch). Follows WCAG 1.4.13: content is dismissible
   (Escape), hoverable (bubble stays open while hovered), and
   persistent (stays until dismissed). Styled for Concert Poster Noir.
   ------------------------------------------------------------------ */

interface InfoTooltipProps {
  /** Accessible name for the trigger button, e.g. "How Impact points work" */
  label: string;
  /** Tooltip body content */
  children: ReactNode;
  /** Horizontal alignment of the bubble relative to the trigger */
  align?: 'center' | 'left' | 'right';
}

export default function InfoTooltip({ label, children, align = 'center' }: InfoTooltipProps) {
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  const open = hovered || focused || pinned;

  // Escape dismisses (WCAG 1.4.13); outside click unpins after a tap.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHovered(false);
        setFocused(false);
        setPinned(false);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setPinned(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const alignClass =
    align === 'right' ? 'right-0' : align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2';

  return (
    <span
      ref={rootRef}
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={() => setPinned((p) => !p)}
        className="w-5 h-5 rounded-full border border-noir-600 text-gray-500 hover:text-amber-400 hover:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-colors flex items-center justify-center flex-shrink-0"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
        </svg>
      </button>
      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute bottom-full mb-2 ${alignClass} z-50 w-64 bg-noir-800 border border-noir-600 rounded-lg px-4 py-3 shadow-xl shadow-black/40 text-left animate-fade-in`}
        >
          <div className="text-xs text-gray-300 leading-relaxed">{children}</div>
        </div>
      )}
    </span>
  );
}
