/**
 * Catalogue contexts (roadmap 34 task 6b, "Value beyond damage"). The first catalogue put
 * every card in a hand of Hits, which cannot see a card whose value comes from the rest of
 * its own hand (Feline Companion's INT), from what the opponent holds (Bad Batch against
 * drinks), or from a crowd. Each context here is a hand around the card, an opponent, and the
 * number of opponents; a card is valued against a Hit in the same slot of the same context.
 *
 * Hands only use cards legal from level 3, since contexts are measured at levels 3-7.
 */
export interface CardContext {
	/** The other 8 cards of the hand under test (the card goes in each slot around them). */
	hand: readonly string[];
	/** Each opponent's hand. */
	opponent: readonly string[];
	/** Opponents in the fight (1 = duel; more is a free-for-all crowd). */
	opponents: number;
	/** What the context is for. */
	about: string;
}

const HITS8 = Array(8).fill('Hit') as string[];
const FIELD = ['Hit', 'Hit', 'Delayed Hit', 'Hit', 'Heal', 'Soften', 'Hit', 'Forked Stick', 'Hit'];

export const CARD_CONTEXTS: Record<string, CardContext> = {
	caster: {
		hand: ['Blast II', 'Brain Drain', 'Heal', 'Blast II', 'Brain Drain', 'Heal', 'Blast II', 'Hit'],
		opponent: FIELD,
		opponents: 1,
		about: 'An INT hand (Blast II, Brain Drain, Heal): shows INT synergy',
	},
	brute: {
		hand: ['Hit Harder', 'Hit', 'Berserk', 'Hit', 'Hit Harder', 'Hit', 'Berserk', 'Hit'],
		opponent: FIELD,
		opponents: 1,
		about: 'A STR and DEX strike hand: shows melee synergy',
	},
	drinks: {
		hand: HITS8,
		opponent: ['Hit', 'Whiskey Shot', 'Hit', 'Whiskey Shot', 'Hit', 'Heal', 'Hit', 'Whiskey Shot', 'Hit'],
		opponents: 1,
		about: 'An opponent that drinks and heals: shows counters to healing',
	},
	holds: {
		hand: HITS8,
		opponent: ['Coil', 'Hit', 'Constrict', 'Hit', 'Entrance', 'Hit', 'Horn Gore', 'Hit', 'Hit'],
		opponents: 1,
		about: 'An opponent that holds (Coil, Constrict, Entrance, Horn Gore): shows counters to holds (roadmap 35 task 1)',
	},
	crowd: {
		hand: HITS8,
		opponent: Array(9).fill('Hit') as string[],
		opponents: 3,
		about: 'Three opponents at once: shows area, targeting, and crowd effects',
	},
};
