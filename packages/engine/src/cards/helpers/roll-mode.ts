/*
 * Advantage and disadvantage on a card's attack rolls (roadmap 36).
 *
 * Several effects change how a card rolls to hit: Dissonant Voice's rattle gives the rattled
 * monster's next attack disadvantage, and a pin gives every attack against the pinned monster
 * advantage. As in D&D they do not stack, and one of each cancels to a single roll. Each
 * effect used to wrap `getAttackRoll` itself, so a rattled monster attacking a pinned one
 * would have got the better of two worse rolls or the worse of two better ones, depending on
 * which effect ran first. Every effect now records its mode here, and one place decides.
 *
 * Every roll is still a plain d20, so a natural 1 and a natural 20 keep their meaning (owner
 * rule, 2026-09-29): a Curse of Loki is always the worst roll and a stroke of luck the best,
 * whatever the totals.
 *
 * **The mode is decided when the die is rolled, for the creature being attacked.** A pin's
 * advantage applies only to rolls at the pinned monster, and the first version decided that in
 * a wrapper on the card's `effect`, from the target the ring handed it. Two kinds of attack
 * slipped past it (Codex review of #412):
 * - A card that picks its victims inside its own effect. Enthrall's `getTargets` names only
 *   the caster, and its repeat hold on an already-held opponent is a Hit made through the
 *   prototype's `effect`, so the wrapper never saw the real target.
 * - A roll that does not go through `getAttackRoll`: the donkey's kick, Tail Lash's tail, and
 *   the Unconquerable Horn's creature of the wood each roll their own d20.
 * So the target now comes from the roll itself: `rollWithModes` is handed it, and
 * `getAttackRoll` (which Hit calls without one) reads the target of the `hitCheck` or
 * `effect` call in progress.
 *
 * Wrappers go on the per-play clone `applyEffects` makes, so nothing leaks into the deck.
 */

export type RollMode = 'advantage' | 'disadvantage';

interface Entry {
	mode: RollMode;
	/** Only rolls at this creature, by anyone else. Unset: every attack roll the card makes. */
	against?: any;
	/** Called each time the entry applies to a roll (used for narration). */
	onApply?: () => void;
}

interface RollModes {
	entries: Entry[];
	/** The attack in progress, for rolls that are not handed their target. */
	current?: { player: any; target: any };
}

const rank = (r: any): number => (r?.curseOfLoki ? -Infinity : r?.strokeOfLuck ? Infinity : r?.result ?? 0);

/** Runs `fn` with `current` set to its (player, target), restoring the outer attack after. */
function tracking(modes: RollModes, fn: (...args: any[]) => any, isAsync: boolean): (...args: any[]) => any {
	if (isAsync) {
		return async function (this: any, player: any, target: any, ...rest: any[]) {
			const outer = modes.current;
			modes.current = { player, target };
			try {
				return await fn.call(this, player, target, ...rest);
			} finally {
				modes.current = outer;
			}
		};
	}
	return function (this: any, player: any, target: any, ...rest: any[]) {
		const outer = modes.current;
		modes.current = { player, target };
		try {
			return fn.call(this, player, target, ...rest);
		} finally {
			modes.current = outer;
		}
	};
}

function install(card: any): RollModes {
	if (card.__rollModes) return card.__rollModes;
	const modes: RollModes = { entries: [] };
	card.__rollModes = modes;

	// Cards target in series (mapSeries), so one clone never has two attacks in flight.
	if (typeof card.effect === 'function') card.effect = tracking(modes, card.effect, true);
	if (typeof card.hitCheck === 'function') card.hitCheck = tracking(modes, card.hitCheck, false);
	if (typeof card.getAttackRoll === 'function') {
		const base = card.getAttackRoll;
		card.getAttackRoll = (player: any, target?: any, ...rest: any[]) =>
			rollWithModes(card, player, target ?? modes.current?.target, () => base.call(card, player, target, ...rest));
	}
	return modes;
}

/**
 * Gives `card`'s attack rolls one more source of `mode`, and returns the undo. With `against`,
 * only rolls at that creature count it. A card whose own rules already roll twice and keep the
 * better (Lucky Strike, `static rollsTwice`) gains nothing from advantage alone, but its
 * advantage still cancels a disadvantage.
 */
export function addRollMode(
	card: any,
	mode: RollMode,
	options: { against?: any; onApply?: () => void } = {}
): () => void {
	if (!card) return () => {};
	const modes = install(card);
	const entry: Entry = { mode, ...options };
	modes.entries.push(entry);
	return () => {
		modes.entries = modes.entries.filter(e => e !== entry);
	};
}

/** True when `card` already carries `mode` against `creature`. */
export const hasRollModeAgainst = (card: any, mode: RollMode, creature: any): boolean =>
	!!card?.__rollModes?.entries.some((e: Entry) => e.mode === mode && e.against === creature);

/**
 * One attack roll by `card` from `player` at `target`, with the card's modes applied.
 * `rollOnce` makes a single plain roll. A card's extra strikes that roll their own d20 call
 * this, so they follow the same rules as its `getAttackRoll`:
 * - Tail Lash's tail is the player's own blow, so it takes every mode.
 * - A companion's blow (the donkey's kick, the creature of the wood) passes `targetOnly`. It
 *   takes the modes about its target, such as a pin, but not those about the player, such as
 *   a rattle: the companion was not rattled.
 */
export function rollWithModes(
	card: any,
	player: any,
	target: any,
	rollOnce: () => any,
	{ targetOnly = false }: { targetOnly?: boolean } = {}
): any {
	const modes: RollModes | undefined = card?.__rollModes;
	if (!modes?.entries.length) return rollOnce();

	const applied = modes.entries.filter(e =>
		e.against === undefined ? !targetOnly : e.against === target && player !== e.against
	);
	for (const e of applied) e.onApply?.();
	const rollsTwice = !!(card.constructor as { rollsTwice?: boolean })?.rollsTwice;
	const advantage = applied.some(e => e.mode === 'advantage');
	const disadvantage = applied.some(e => e.mode === 'disadvantage');

	const first = rollOnce();
	// One of each cancels, before Lucky Strike's "already advantage" is considered (Codex review
	// of #412): suppressing its advantage first left a pinned, rattled Lucky Strike rolling
	// four dice for the worse of each pair.
	if (advantage === disadvantage || (advantage && rollsTwice)) return first;
	const second = rollOnce();
	if (advantage) return rank(second) > rank(first) ? second : first;
	return rank(second) < rank(first) ? second : first;
}
