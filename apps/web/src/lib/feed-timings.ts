/**
 * Tiny always-on recorder for feed scroll / connection timings.
 *
 * Why it exists: players report flaky scrolling and slow reconnects, and the client used to
 * record no numbers at all. A Playwright suite reads `window.__feedTimings.snapshot()`; the
 * dev overlay (`FeedTimingsOverlay`, behind `?feedTimings=1`) subscribes to it.
 *
 * Cost when nobody reads it: a few map writes per call. Listener notification is coalesced
 * and only scheduled while at least one listener is subscribed.
 */

export type FeedTimingDetail = Record<string, number | string | boolean>;

export interface FeedTimingsSnapshot {
  counters: Record<string, number>;
  durations: Record<string, { count: number; last: number; min: number; max: number; total: number }>;
  marks: Record<string, number>;
  events: Array<{ at: number; name: string; detail?: FeedTimingDetail }>;
}

const EVENT_CAP = 200;
const NOTIFY_INTERVAL_MS = 250;

function now(): number {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
  } catch {
    // fall through
  }
  return Date.now();
}

function createFeedTimings() {
  let counters: FeedTimingsSnapshot['counters'] = {};
  let durations: FeedTimingsSnapshot['durations'] = {};
  let marks: FeedTimingsSnapshot['marks'] = {};
  let events: FeedTimingsSnapshot['events'] = [];
  const listeners = new Set<() => void>();
  let notifyTimer: ReturnType<typeof setTimeout> | null = null;

  function changed() {
    if (listeners.size === 0 || notifyTimer !== null) return;
    notifyTimer = setTimeout(() => {
      notifyTimer = null;
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch {
          // a broken overlay must never break the feed
        }
      }
    }, NOTIFY_INTERVAL_MS);
  }

  function count(name: string, by = 1) {
    counters[name] = (counters[name] ?? 0) + by;
    changed();
  }

  function mark(name: string) {
    marks[name] = now();
    changed();
  }

  function duration(name: string, ms: number) {
    const d = durations[name];
    if (d) {
      d.count += 1;
      d.last = ms;
      d.min = Math.min(d.min, ms);
      d.max = Math.max(d.max, ms);
      d.total += ms;
    } else {
      durations[name] = { count: 1, last: ms, min: ms, max: ms, total: ms };
    }
    changed();
  }

  function since(markName: string, durationName: string) {
    const at = marks[markName];
    if (at === undefined) return;
    duration(durationName, now() - at);
  }

  function event(name: string, detail?: FeedTimingDetail) {
    events.push(detail ? { at: now(), name, detail: { ...detail } } : { at: now(), name });
    if (events.length > EVENT_CAP) events.splice(0, events.length - EVENT_CAP);
    count(name);
  }

  function snapshot(): FeedTimingsSnapshot {
    return {
      counters: { ...counters },
      durations: Object.fromEntries(Object.entries(durations).map(([k, v]) => [k, { ...v }])),
      marks: { ...marks },
      events: events.map((e) => (e.detail ? { ...e, detail: { ...e.detail } } : { ...e })),
    };
  }

  function reset() {
    counters = {};
    durations = {};
    marks = {};
    events = [];
    changed();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && notifyTimer !== null) {
        clearTimeout(notifyTimer);
        notifyTimer = null;
      }
    };
  }

  return { count, mark, duration, since, event, snapshot, reset, subscribe };
}

export const feedTimings = createFeedTimings();

declare global {
  interface Window {
    __feedTimings?: typeof feedTimings;
  }
}

if (typeof window !== 'undefined') {
  window.__feedTimings = feedTimings;
}

const ENABLE_KEY = 'dm:feedTimings';
let overlayEnabled: boolean | undefined;

/**
 * Whether the dev overlay is on: `localStorage['dm:feedTimings'] === '1'`, or `?feedTimings=1`
 * in the URL (which also persists the key; `?feedTimings=0` clears it). Decided once per page
 * load so render-time callers stay cheap. Every storage access is guarded: it can throw in
 * private windows or with site data blocked.
 */
export function isFeedTimingsEnabled(): boolean {
  if (overlayEnabled !== undefined) return overlayEnabled;
  let enabled = false;
  try {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('feedTimings');
      if (param === '1') {
        try {
          window.localStorage.setItem(ENABLE_KEY, '1');
        } catch {
          // storage unavailable; the URL flag still works for this load
        }
        enabled = true;
      } else if (param === '0') {
        try {
          window.localStorage.removeItem(ENABLE_KEY);
        } catch {
          // ignore
        }
      } else {
        try {
          enabled = window.localStorage.getItem(ENABLE_KEY) === '1';
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
  overlayEnabled = enabled;
  return enabled;
}

/** Test hook: forget the cached decision. */
export function resetFeedTimingsEnabledCache(): void {
  overlayEnabled = undefined;
}
