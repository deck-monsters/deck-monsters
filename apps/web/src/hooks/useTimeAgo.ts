import { useEffect, useState } from 'react';
import { format } from 'timeago.js';

const DEFAULT_MS = 30_000;

/**
 * Re-computes a timeago string on an interval so "2 min ago" stays fresh.
 */
export function useTimeAgo(date: Date, refreshMs: number = DEFAULT_MS): string {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  return format(date);
}
