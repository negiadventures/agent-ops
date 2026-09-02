"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `value`.
 *
 * Deliberately not MagicUI's NumberTicker: that one seeds the DOM with
 * `startValue`, then corrects it imperatively from a spring subscription
 * gated on useInView. When that chain does not fire (it silently did not in
 * a production build) the page shows 0 forever, which for a count of breaking
 * changes is a correctness bug, not a missing flourish.
 *
 * Here the rendered number is React state that always settles on `value`:
 * no observer, no subscription, and reduced-motion skips straight to it.
 */
export default function CountUp({
  value,
  duration = 650,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      value === 0
    ) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    setDisplay(0);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(eased * value));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      // Whatever happens, land on the true value.
      setDisplay(value);
    };
  }, [value, duration]);

  return (
    <span className={className} suppressHydrationWarning>
      {display}
    </span>
  );
}
