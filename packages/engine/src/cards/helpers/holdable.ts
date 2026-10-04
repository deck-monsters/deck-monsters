import allMonsters from '../../monsters/helpers/all.js';
import all from './all.js';
import { cardFacts, type CardFacts } from './card-facts.js';
import { cardHoldVerdict, type HoldingMonster } from './hold-verdict.js';

export interface HoldableLevel {
	level: number;
	/** Alphabetical. */
	cards: CardFacts[];
}

/**
 * A monster type, or a monster, to the fields the hold rule reads. A type name resolves through
 * `allMonsters` (each class carries a static `class` and `creatureType`); an unknown name holds
 * nothing rather than throwing, so a stale web request gets an empty answer.
 */
const holderOf = (typeOrMonster: string | HoldingMonster): HoldingMonster | undefined => {
	// Copy the two fields by name: a monster's `class` and `creatureType` are prototype
	// getters, which `{ ...monster }` would silently drop, leaving it unable to hold anything.
	if (typeof typeOrMonster !== 'string') {
		return { class: typeOrMonster.class, creatureType: typeOrMonster.creatureType };
	}
	const Monster = allMonsters.find(M => (M as any).creatureType === typeOrMonster) as any;
	return Monster ? { class: Monster.class, creatureType: Monster.creatureType } : undefined;
};

/**
 * Every card a monster type (by name) or a monster can hold, grouped by the level it opens at.
 * The player-facing question "what can mine use, and when" for the guide, the Workshop and the
 * Console. Cards its type or class may never hold are left out; bosses' `noBosses` is
 * irrelevant, since these are player monsters. A card with no level opens at 0.
 */
export const holdableByLevel = (typeOrMonster: string | HoldingMonster): HoldableLevel[] => {
	const holder = holderOf(typeOrMonster);
	if (!holder) return [];

	const byLevel = new Map<number, CardFacts[]>();
	for (const Card of all) {
		// Infinity level: ask the type question only; the level is what we are grouping by.
		if (!cardHoldVerdict(Card as any, { ...holder, level: Infinity }).ok) continue;
		const facts = cardFacts(Card);
		byLevel.set(facts.level, [...(byLevel.get(facts.level) ?? []), facts]);
	}

	return [...byLevel.entries()]
		.sort(([a], [b]) => a - b)
		.map(([level, cards]) => ({
			level,
			cards: cards.sort((a, b) => a.name.localeCompare(b.name)),
		}));
};
