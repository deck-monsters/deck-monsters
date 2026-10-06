import { describe, expect, it } from 'vitest';
import { chatTimeOfDay } from '../components/ChatPanel';

describe('chatTimeOfDay', () => {
  it('formats a message time as a time of day', () => {
    expect(chatTimeOfDay('2026-10-01T16:41:00Z')).toMatch(/\d{1,2}:41/);
  });

  // An unparsable or missing timestamp is omitted, never shown as "Invalid Date".
  it('returns an empty string for a missing or bad timestamp', () => {
    expect(chatTimeOfDay(undefined)).toBe('');
    expect(chatTimeOfDay('')).toBe('');
    expect(chatTimeOfDay('not a date')).toBe('');
  });
});
