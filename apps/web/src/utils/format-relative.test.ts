import { describe, expect, it } from 'vitest';
import { formatRelativeFromNow } from './format-relative.js';

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatRelativeFromNow', () => {
  it('renders whole minutes under an hour away', () => {
    expect(formatRelativeFromNow(NOW + 12 * MINUTE, NOW)).toBe('in 12 min');
  });

  it('renders hours and minutes together', () => {
    expect(formatRelativeFromNow(NOW + 2 * HOUR + 5 * MINUTE, NOW)).toBe('in 2 h 5 min');
  });

  it('drops the minutes when the countdown lands on the hour exactly', () => {
    expect(formatRelativeFromNow(NOW + 3 * HOUR, NOW)).toBe('in 3 h');
  });

  it('keeps 59 minutes as minutes and rolls 60 minutes into one hour', () => {
    expect(formatRelativeFromNow(NOW + 59 * MINUTE, NOW)).toBe('in 59 min');
    expect(formatRelativeFromNow(NOW + HOUR, NOW)).toBe('in 1 h');
  });

  it('rolls over into days once past 24 hours', () => {
    expect(formatRelativeFromNow(NOW + DAY + HOUR, NOW)).toBe('in 1 d 1 h');
  });

  it('drops the hours when the countdown lands on the day exactly', () => {
    expect(formatRelativeFromNow(NOW + DAY, NOW)).toBe('in 1 d');
  });

  it('treats anything under a minute away as imminent', () => {
    expect(formatRelativeFromNow(NOW + 30_000, NOW)).toBe('any moment');
    expect(formatRelativeFromNow(NOW, NOW)).toBe('any moment');
  });

  it('treats the past — a revive that already fired but has not refetched — as imminent, not negative', () => {
    expect(formatRelativeFromNow(NOW - 5 * MINUTE, NOW)).toBe('any moment');
  });

  it('formats test estimates against an explicit clock', () => {
    expect(formatRelativeFromNow(NOW + 5 * MINUTE, NOW)).toBe('in 5 min');
  });
});
