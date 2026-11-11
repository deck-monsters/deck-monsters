import { describe, expect, it } from 'vitest';

import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  RESUME_GRACE_MS,
  STALE_MARGIN_MS,
  decideAfterResume,
  reconnectDelayMs,
} from '../utils/ring-feed-connection.js';

describe('ring feed connection constants', () => {
  it('keeps the timeout at 2.5 heartbeat intervals and the grace shorter than one interval', () => {
    expect(HEARTBEAT_TIMEOUT_MS).toBe(HEARTBEAT_INTERVAL_MS * 2.5);
    expect(RESUME_GRACE_MS).toBeLessThan(HEARTBEAT_INTERVAL_MS);
  });
});

describe('decideAfterResume', () => {
  const now = 1_000_000;
  const resumedAt = now - RESUME_GRACE_MS;
  const stale = HEARTBEAT_INTERVAL_MS + STALE_MARGIN_MS;

  const cases: Array<{
    name: string;
    lastFrameAt: number | null;
    offline?: boolean;
    expected: ReturnType<typeof decideAfterResume>;
  }> = [
    { name: 'no frame ever: nothing to judge', lastFrameAt: null, expected: { action: 'none' } },
    { name: 'a frame arrived after the resume', lastFrameAt: resumedAt + 1, expected: { action: 'none' } },
    { name: 'a frame arrived exactly at the resume', lastFrameAt: resumedAt, expected: { action: 'none' } },
    {
      name: 'last frame just before the resume, fresh',
      lastFrameAt: resumedAt - 1_000,
      expected: { action: 'watch', remainingMs: HEARTBEAT_TIMEOUT_MS - (RESUME_GRACE_MS + 1_000) },
    },
    {
      name: 'last frame exactly at the stale threshold is still fresh',
      lastFrameAt: now - stale,
      expected: { action: 'watch', remainingMs: HEARTBEAT_TIMEOUT_MS - stale },
    },
    { name: 'last frame one ms past the stale threshold', lastFrameAt: now - stale - 1, expected: { action: 'lost' } },
    { name: 'a phone locked for 5 minutes, nothing queued', lastFrameAt: now - 300_000, expected: { action: 'lost' } },
    {
      name: 'offline since the last frame makes even a fresh frame stale',
      lastFrameAt: resumedAt - 1_000,
      offline: true,
      expected: { action: 'lost' },
    },
    {
      name: 'offline does not matter once a frame has arrived since',
      lastFrameAt: resumedAt + 10,
      offline: true,
      expected: { action: 'none' },
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(
        decideAfterResume({ now, lastFrameAt: c.lastFrameAt, resumedAt, offlineSinceLastFrame: c.offline ?? false })
      ).toEqual(c.expected);
    });
  }
});

describe('reconnectDelayMs', () => {
  const noJitter = () => 0.5;

  it('is 0, 500 ms, 1 s, 2 s, 4 s, then capped at 8 s', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 20].map((n) => reconnectDelayMs(n, noJitter))).toEqual([
      0, 500, 1_000, 2_000, 4_000, 8_000, 8_000, 8_000,
    ]);
  });

  it('never delays the first retry, jitter or not', () => {
    expect(reconnectDelayMs(0, () => 0)).toBe(0);
    expect(reconnectDelayMs(0, () => 1)).toBe(0);
  });

  it('spreads every later delay by at most 20% either way', () => {
    expect(reconnectDelayMs(1, () => 0)).toBe(400);
    expect(reconnectDelayMs(1, () => 1)).toBe(600);
    expect(reconnectDelayMs(5, () => 0)).toBe(6_400);
    expect(reconnectDelayMs(5, () => 1)).toBe(9_600);
  });
});
