/**
 * The `ringFeed` connection's timing rules, as pure functions so they can be tested as
 * tables. `hooks/useRingFeed.tsx` owns the timers and the state; it only asks this file
 * "what do we do now?". Background: docs/reference/feed-stability-baseline.md (C1 to C6).
 */

/**
 * The server sends a keep-alive `heartbeat` this often (`ringFeed` in `trpc/router.ts`, and
 * the lab transport's `heartbeatMs`). 20 s let a silent stall go unnoticed for 31 to 49 s
 * (baseline C1); 8 s keeps the keep-alive well inside every load balancer's idle timeout.
 */
export const HEARTBEAT_INTERVAL_MS = 8_000;

/**
 * How long to wait for *any* frame before treating the connection as dead: 2.5x the
 * heartbeat interval, so one late heartbeat does not read as a dead connection.
 */
export const HEARTBEAT_TIMEOUT_MS = 20_000;

/**
 * After the page becomes visible (or the network comes back) frames that arrived while the
 * page was frozen are dispatched as tasks once it thaws. A check that runs first judges a
 * healthy socket dead, which is what bug 127 was. This is how long they get to land.
 */
export const RESUME_GRACE_MS = 2_000;

/** Slack added to one heartbeat interval before a silent connection counts as stale. */
export const STALE_MARGIN_MS = 2_000;

export type ResumeCheck = {
  /** `Date.now()` when the check runs (the end of the grace period). */
  now: number;
  /** `Date.now()` of the last inbound frame, or null if none has ever arrived. */
  lastFrameAt: number | null;
  /** `Date.now()` when the page became visible / the network came back. */
  resumedAt: number;
  /** The browser reported `offline` after the last frame. */
  offlineSinceLastFrame: boolean;
};

export type ResumeDecision =
  /** Nothing to judge, or a frame has arrived since the resume: the normal watchdog is armed. */
  | { action: 'none' }
  /** No sign of life and the last frame is too old (or the network went away): resubscribe now. */
  | { action: 'lost' }
  /** Recent enough: arm the ordinary watchdog for what remains of the timeout. */
  | { action: 'watch'; remainingMs: number };

/**
 * Decide what to do once the resume grace has passed.
 *
 * Re-arming a fresh full timeout on every resume (the original fix for bug 127) made a phone
 * unlocked with a dead socket wait a further full timeout (baseline C2). Instead the resume is
 * the cheap moment to *test* the connection: no frame in the grace period and a last frame
 * older than one heartbeat interval plus a margin means the server's heartbeat was due and
 * did not come.
 *
 * `offlineSinceLastFrame` makes any silence stale: the browser told us the network went away,
 * and a socket that lived through it still gets a frame inside the grace period (the server
 * keeps heartbeating), so a false positive costs only a harmless replay.
 */
export function decideAfterResume(check: ResumeCheck): ResumeDecision {
  const { now, lastFrameAt, resumedAt, offlineSinceLastFrame } = check;
  if (lastFrameAt === null) return { action: 'none' };
  if (lastFrameAt >= resumedAt) return { action: 'none' };
  const age = Math.max(0, now - lastFrameAt);
  if (offlineSinceLastFrame || age > HEARTBEAT_INTERVAL_MS + STALE_MARGIN_MS) return { action: 'lost' };
  return { action: 'watch', remainingMs: Math.max(0, HEARTBEAT_TIMEOUT_MS - age) };
}

const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 8_000;
const BACKOFF_JITTER = 0.2;

/**
 * Delay before the next resubscribe, by how many have already failed since the last
 * handshake: 0 ms for the first, then 500 ms, 1 s, 2 s, 4 s, capped at 8 s, each from the
 * second on spread by plus or minus 20% so a room full of clients dropped by one server
 * restart does not come back in lockstep. Before this a failed resubscribe was retried at
 * once: 101 attempts in a 5 s outage (baseline C6).
 */
export function reconnectDelayMs(failuresSoFar: number, random: () => number = Math.random): number {
  if (failuresSoFar <= 0) return 0;
  const base = Math.min(BACKOFF_BASE_MS * 2 ** (failuresSoFar - 1), BACKOFF_CAP_MS);
  const spread = (random() * 2 - 1) * BACKOFF_JITTER;
  return Math.round(base * (1 + spread));
}
