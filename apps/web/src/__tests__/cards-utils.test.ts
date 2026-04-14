import { describe, expect, it } from 'vitest';

import { abbreviateCardName } from '../utils/cards.js';

describe('abbreviateCardName', () => {
	it('returns short names unchanged', () => {
		expect(abbreviateCardName('Hit')).toBe('Hit');
	});

	it('shortens multi-word card names', () => {
		expect(abbreviateCardName('Adrenaline Rush')).toBe('AdrR');
		expect(abbreviateCardName('Battle Focus')).toBe('BatF');
	});
});
