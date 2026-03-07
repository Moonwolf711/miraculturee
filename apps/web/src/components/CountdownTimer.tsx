import { useState, useEffect, useRef } from 'react';

interface CountdownTimerProps {
  targetDate: string;
  onComplete?: () => void;
  label?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calcTimeLeft(target: number): TimeLeft {
  const total = Math.max(0, target - Date.now());
  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
    total,
  };
}

function Digit({ value, label }: { value: number; label: string }) {
  const display = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center">
      <div className="relative overflow-hidden bg-noir-900 border border-noir-600 rounded-lg w-14 h-16 sm:w-16 sm:h-18 flex items-center justify-center">
        <span
          key={display}
          className="font-mono text-2xl sm:text-3xl font-bold text-amber-400 animate-countdown-tick"
        >
          {display}
        </span>
        <div className="absolute inset-x-0 top-1/2 h-px bg-noir-700/50" />
      </div>
      <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-1.5 font-medium">
        {label}
      </span>
    </div>
  );
}

export default function CountdownTimer({ targetDate, onComplete, label }: CountdownTimerProps) {
  const target = new Date(targetDate).getTime();
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(target));
  const completedRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const tl = calcTimeLeft(target);
      setTimeLeft(tl);
      if (tl.total <= 0 && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, onComplete]);

  if (timeLeft.total <= 0) {
    return (
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-amber-400 font-semibold text-sm uppercase tracking-wider">
            Doors Are Open!
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      {label && (
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-medium">
          {label}
        </p>
      )}
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        {timeLeft.days > 0 && (
          <>
            <Digit value={timeLeft.days} label="Days" />
            <span className="text-gray-600 text-xl font-bold pb-5">:</span>
          </>
        )}
        <Digit value={timeLeft.hours} label="Hrs" />
        <span className="text-gray-600 text-xl font-bold pb-5">:</span>
        <Digit value={timeLeft.minutes} label="Min" />
        <span className="text-gray-600 text-xl font-bold pb-5">:</span>
        <Digit value={timeLeft.seconds} label="Sec" />
      </div>
    </div>
  );
}
