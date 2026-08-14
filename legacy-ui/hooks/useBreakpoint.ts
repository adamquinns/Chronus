import { useEffect, useState } from 'react';

// Returns true when viewport width is at least the given breakpoint (default 1024).
export function useMinWidth(px: number = 1024): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(`(min-width: ${px}px)`).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [px]);
  return matches;
}
