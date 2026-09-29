import { describe, expect, it } from 'vitest';

import { abbreviateCardName, getCardClass, isLongCardName } from '../utils/cards.js';

describe('abbreviateCardName', () => {
	it('returns short names unchanged', () => {
		expect(abbreviateCardName('Hit')).toBe('Hit');
	});

	// "Fight or Flight" once read "Fig or Fli" (10b #186).
	it('keeps whole words in long names, for the compact two-line label', () => {
		expect(abbreviateCardName('Fight or Flight')).toBe('Fight or Flight');
		expect(abbreviateCardName('Curse of Loki')).toBe('Curse of Loki');
		expect(abbreviateCardName('Adrenaline Rush')).toBe('Adrenaline Rush');
		expect(abbreviateCardName('Enchanted Faceswap')).toBe('Enchanted Faceswap');
		expect(abbreviateCardName('Battle Focus')).toBe('Battle Focus');
		// The catalogue's other three-word names.
		expect(abbreviateCardName('Fists of Villainy')).toBe('Fists of Villainy');
		expect(abbreviateCardName('Fists of Virtue')).toBe('Fists of Virtue');
		expect(abbreviateCardName('Forked Metal Rod')).toBe('Forked Metal Rod');
	});

	it('shortens only a word too long for one line', () => {
		expect(abbreviateCardName('Cloak of Invisibility')).toBe('Cloak of Invisi.');
		expect(abbreviateCardName('Unconquerable Horn')).toBe('Unconq. Horn');
	});

	it('marks names over twelve characters for the compact size', () => {
		expect(isLongCardName('Battle Focus')).toBe(false);
		expect(isLongCardName('Fight or Flight')).toBe(true);
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
		expect(getCardClass('Unconquerable Horn')).toBe('melee');
	});

	it('badges the Dragon cards by what they do', () => {
		expect(getCardClass('Fire Breath')).toBe('magic');
		expect(getCardClass('Tsunami')).toBe('magic');
		// A dodge and a dive, and a hide or a fury: moves, not attacks of their own.
		expect(getCardClass('Take Wing')).toBe('utility');
		expect(getCardClass('Mood Scales')).toBe('utility');
	});

	it('falls back to utility for unmatched names', () => {
		expect(getCardClass('Mystery Card')).toBe('utility');
	});
});
