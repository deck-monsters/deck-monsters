import { describe, expect, it } from 'vitest';

import { abbreviateCardName, getCardClass } from '../utils/cards.js';

describe('abbreviateCardName', () => {
	it('returns short names unchanged', () => {
		expect(abbreviateCardName('Hit')).toBe('Hit');
	});

	it('shortens multi-word card names', () => {
		expect(abbreviateCardName('Adrenaline Rush')).toBe('Adre Rush…');
		expect(abbreviateCardName('Battle Focus')).toBe('Battle Focus');
		expect(abbreviateCardName('Curse of Loki')).toBe('Cur of Lok');
	});
});

describe('getCardClass', () => {
	it('matches keyword groups case-insensitively', () => {
		expect(getCardClass('Whiskey Shot')).toBe('heal');
		expect(getCardClass('HIT')).toBe('melee');
		expect(getCardClass('Blink')).toBe('magic');
	});

	it('badges the Unicorn cards by what they do', () => {
		expect(getCardClass('Sticketh')).toBe('melee');
		expect(getCardClass('Horn of Proof')).toBe('heal');
		expect(getCardClass('Gloaming Rest')).toBe('heal');
		expect(getCardClass('Dissonant Voice')).toBe('magic');
		// A ward against holds, like the other boosts.
		expect(getCardClass('Unconquerable Horn')).toBe('utility');
	});

	it('falls back to utility for unmatched names', () => {
		expect(getCardClass('Mystery Card')).toBe('utility');
	});
});
