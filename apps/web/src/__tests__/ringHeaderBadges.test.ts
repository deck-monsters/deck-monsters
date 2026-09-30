import { describe, expect, it } from 'vitest';
import { headerBadgesVisible, summonsLeftLabel } from '../components/ringHeaderBadges.js';

describe('ringHeaderBadges', () => {
  it('reads summons as what is left', () => {
    expect(summonsLeftLabel(3)).toBe('3 summons left');
    expect(summonsLeftLabel(2)).toBe('2 summons left');
    expect(summonsLeftLabel(1)).toBe('1 summon left');
    expect(summonsLeftLabel(0)).toBe('No summons left today');
  });

  it('hides the countdown and summons while a fight is on', () => {
    expect(headerBadgesVisible(true)).toBe(false);
    expect(headerBadgesVisible(false)).toBe(true);
    expect(headerBadgesVisible(undefined)).toBe(true);
  });
});
