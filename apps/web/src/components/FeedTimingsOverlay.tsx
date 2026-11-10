import { useEffect, useState } from 'react';
import { feedTimings, type FeedTimingsSnapshot } from '../lib/feed-timings.js';

/**
 * Developer overlay for the feed timing recorder (lib/feed-timings.ts). Mounted by Terminal
 * only behind `?feedTimings=1` / `localStorage['dm:feedTimings']`; not player-facing.
 */
export default function FeedTimingsOverlay() {
  const [snap, setSnap] = useState<FeedTimingsSnapshot>(() => feedTimings.snapshot());
  useEffect(() => {
    setSnap(feedTimings.snapshot());
    return feedTimings.subscribe(() => setSnap(feedTimings.snapshot()));
  }, []);

  const counters = Object.entries(snap.counters).sort(([a], [b]) => a.localeCompare(b));
  const durations = Object.entries(snap.durations).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="feed-timings-overlay" aria-hidden="true">
      {counters.map(([name, value]) => (
        <div key={`c:${name}`}>
          {name} {value}
        </div>
      ))}
      {durations.map(([name, d]) => (
        <div key={`d:${name}`}>
          {name} last {d.last.toFixed(0)}ms max {d.max.toFixed(0)}ms n{d.count}
        </div>
      ))}
    </div>
  );
}
