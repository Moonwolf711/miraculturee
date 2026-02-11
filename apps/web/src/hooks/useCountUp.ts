import { useEffect, useState } from 'react';

/**
 * Animates a number from 0 to `end` over `duration` ms,
 * triggered when `enabled` becomes true (e.g. on scroll into view).
 */
export function useCountUp(end: number, enabled: boolean, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let raf: number;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * end));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, end, duration]);

  return value;
}
