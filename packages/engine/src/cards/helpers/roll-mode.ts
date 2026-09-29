/*
 * Advantage and disadvantage on a card's attack rolls (roadmap 36).
 *
 * Several effects change how a card rolls to hit: Dissonant Voice's rattle gives the rattled
 * monster's next attack disadvantage, and a pin gives every attack against the pinned monster
 * advantage. As in D&D they do not stack, and one of each cancels to a single roll. Each
 * effect used to wrap `getAttackRoll` itself, so a rattled monster attacking a pinned one
 * would have got the better of two worse rolls or the worse of two better ones, depending on
 * which effect ran first. Every effect now counts its mode here, and one wrapper decides.
 *
 * Every roll is still a plain d20, so a natural 1 and a natural 20 keep their meaning (owner
 * rule, 2026-09-29): a Curse of Loki is always the worst roll and a stroke of luck the best,
 * whatever the totals.
 *
 * Wrappers go on the per-play clone `applyEffects` makes, so nothing leaks into the deck.
 */

export type RollMode = 'advantage' | 'disadvantage';

interface RollModes {
	advantage: number;
	disadvantage: number;
	base: (...args: any[]) => any;
}

const rank = (r: any): number => (r?.curseOfLoki ? -Infinity : r?.strokeOfLuck ? Infinity : r?.result ?? 0);

/**
 * Gives `card`'s attack rolls one more source of `mode`, and returns the undo. A card whose
 * own rules already roll twice and keep the better (Lucky Strike, `static rollsTwice`) gains
 * nothing from advantage.
 */
export function addRollMode(card: any, mode: RollMode): () => void {
	if (!card || typeof card.getAttackRoll !== 'function') return () => {};

	let modes: RollModes | undefined = card.__rollModes;
	if (!modes) {
		const created: RollModes = { advantage: 0, disadvantage: 0, base: card.getAttackRoll };
		modes = created;
		card.__rollModes = created;
		const rollsTwice = !!(card.constructor as { rollsTwice?: boolean })?.rollsTwice;
		card.getAttackRoll = (...args: any[]) => {
			const advantage = created.advantage > 0 && !rollsTwice;
			const disadvantage = created.disadvantage > 0;
			const first = created.base.apply(card, args);
			if (advantage === disadvantage) return first;
			const second = created.base.apply(card, args);
			if (advantage) return rank(second) > rank(first) ? second : first;
			return rank(second) < rank(first) ? second : first;
		};
	}

	const active = modes;
	active[mode] += 1;
	let undone = false;
	return () => {
		if (undone) return;
		undone = true;
		active[mode] = Math.max(0, active[mode] - 1);
	};
}
