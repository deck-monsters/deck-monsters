/**
 * One animation clock for every roster sprite on screen.
 *
 * A dozen contestants means a dozen sprites, and giving each its own
 * `requestAnimationFrame` loop (or driving them from React state) would mean a dozen
 * loops and a re-render per frame for something purely decorative. Subscribers instead
 * share one loop and draw imperatively: no React work per frame, and the loop only runs
 * while something is subscribed.
 */
export type FrameListener = (frameIndex: number, now: number) => void;

const listeners = new Set<FrameListener>();
let rafId: number | null = null;
let frameIndex = 0;
let accumulator = 0;
let lastTimestamp: number | null = null;

/** Sprite animation speed. Slow enough to read as a bob, not a flicker. */
const FPS = 8;
const FRAME_MS = 1_000 / FPS;

function tick(timestamp: number): void {
  if (lastTimestamp !== null) {
    accumulator += timestamp - lastTimestamp;
    // Accumulate elapsed time rather than advancing once per repaint, so the animation
    // runs at the same speed on a 120Hz display as on a 60Hz one.
    while (accumulator >= FRAME_MS) {
      frameIndex += 1;
      accumulator -= FRAME_MS;
    }
  }
  lastTimestamp = timestamp;
  listeners.forEach((listener) => listener(frameIndex, timestamp));
  rafId = requestAnimationFrame(tick);
}

export function subscribeToFrames(listener: FrameListener): () => void {
  listeners.add(listener);
  if (rafId === null) {
    lastTimestamp = null;
    accumulator = 0;
    rafId = requestAnimationFrame(tick);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      lastTimestamp = null;
    }
  };
}

/** Test seam: the loop is module state, so a suite must be able to reset it. */
export function resetFrameTicker(): void {
  if (rafId !== null) cancelAnimationFrame(rafId);
  listeners.clear();
  rafId = null;
  frameIndex = 0;
  accumulator = 0;
  lastTimestamp = null;
}
