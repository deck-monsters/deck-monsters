import { describe, expect, it } from 'vitest';

import {
	CARD_ROLE_SLOT_LABEL,
	abbreviateCardName,
	getCardEmoji,
	getCardRole,
	isLongCardName,
	stableCardName,
	verdictLine,
} from '../utils/cards.js';

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

describe('card roles in the Workshop', () => {
	it('reads the slot role from the engine table, not from the name', () => {
		expect(getCardRole('Hit')).toBe('attack');
		expect(getCardRole('Blink')).toBe('trick');
		expect(getCardRole('Whiskey Shot')).toBe('heal');
		expect(getCardRole('Fire Breath')).toBe('area');
		// Names the old keyword guess filed as "utility" or "magic".
		expect(getCardRole('Take Wing')).toBe('guard');
	});

	it('finds the role of a card whose display name carries its dice', () => {
		expect(stableCardName('The Kalevala (1d4)')).toBe('The Kalevala');
		expect(stableCardName('Hit')).toBe('Hit');
		expect(getCardRole('The Kalevala (2d6)')).toBe('attack');
	});

	it('has no role for a name that is not a card', () => {
		expect(getCardRole('Mystery Card')).toBeUndefined();
		expect(getCardEmoji('Mystery Card')).toBe('◇');
	});

	it('labels the five roles for a slot', () => {
		expect(CARD_ROLE_SLOT_LABEL).toEqual({
			attack: 'ATTACK',
			area: 'AREA',
			heal: 'HEAL',
			guard: 'DEFENCE',
			trick: 'TRICK',
		});
	});
});

describe('verdictLine', () => {
	const facts = { name: 'Gore', role: 'attack' as const, roleLabel: 'Attacks', description: '', stats: '', level: 2, usedBy: ['Minotaur'], price: 5 };

	it('says the monster can use a card it can', () => {
		expect(verdictLine({ ...facts, level: 0 }, { name: 'Rex', type: 'Minotaur', level: 0 })).toBe('Rex can use this.');
	});

	it('names who can when the type is wrong, even if the level is too low as well', () => {
		expect(verdictLine(facts, { name: 'Mira', type: 'Jinn', monsterClass: 'Mage', level: 0 })).toBe("Mira can't use this. Only Minotaur can.");
	});

	it('names the level when only the level is short', () => {
		expect(verdictLine(facts, { name: 'Rex', type: 'Minotaur', level: 1 })).toBe('Rex can use this from level 2. Rex is level 1 now.');
	});
});
