import { describe, expect, it } from 'vitest';
import { shouldAdvanceEventCursor } from '../utils/ring-feed-cursor.js';

describe('shouldAdvanceEventCursor', () => {
  it('advances from empty or older epoch to newer', () => {
    expect(shouldAdvanceEventCursor('100-a', undefined)).toBe(true);
    expect(shouldAdvanceEventCursor('200-b', '100-a')).toBe(true);
  });

  it('refuses to move backwards to an older epoch', () => {
    expect(shouldAdvanceEventCursor('100-a', '200-b')).toBe(false);
  });

  it('allows equal ids and same-epoch lexicographic ties', () => {
    expect(shouldAdvanceEventCursor('100-a', '100-a')).toBe(true);
    expect(shouldAdvanceEventCursor('100-b', '100-a')).toBe(true);
    expect(shouldAdvanceEventCursor('100-a', '100-b')).toBe(false);
  });

  it('uses a safe fallback for malformed ids', () => {
    expect(shouldAdvanceEventCursor('200-ok', 'not-a-ts')).toBe(true);
    expect(shouldAdvanceEventCursor('bad', '200-ok')).toBe(false);
    expect(shouldAdvanceEventCursor('zzz', 'aaa')).toBe(true);
  });
});
