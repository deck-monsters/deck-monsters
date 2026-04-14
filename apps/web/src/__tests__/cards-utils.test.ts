import { describe, expect, it } from 'vitest';

import { abbreviateCardName, getCardClass } from '../utils/cards.js';

describe('abbreviateCardName', () => {
	it('returns short names unchanged', () => {
		expect(abbreviateCardName('Hit')).toBe('Hit');
	});

	it('shortens multi-word card names', () => {
		expect(abbreviateCardName('Adrenaline Rush')).toBe('AdrR');
		expect(abbreviateCardName('Battle Focus')).toBe('BatF');
	});
});

describe('getCardClass', () => {
	it('matches keyword groups case-insensitively', () => {
		expect(getCardClass('Whiskey Shot')).toBe('heal');
		expect(getCardClass('HIT')).toBe('melee');
		expect(getCardClass('Blink')).toBe('magic');
	});

	it('falls back to utility for unmatched names', () => {
		expect(getCardClass('Mystery Card')).toBe('utility');
	});
});
