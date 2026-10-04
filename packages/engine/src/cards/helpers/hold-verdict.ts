/**
 * Whether a monster may hold a card, and if not, which rule said no.
 *
 * `BaseMonster.canHold` only returns a boolean, so a refusal could not say whether the kind
 * of monster or the monster's level was the reason (new-player walk 2: "that kind of monster
 * can't use it"). This is the same rule with the reason, and a test checks it agrees with
 * `canHold` for every card, type and level, so the two cannot drift.
 *
 * Wrong type wins over level: a level-3 card for another type will never open up by levelling,
 * so telling the player to wait would mislead.
 *
 * Pure and browser-safe: it reads only the card's `level` / `permittedClassesAndTypes` and the
 * monster's `level` / `class` / `creatureType`, so it takes a card class or an instance.
 */
export type CardHoldVerdict =
	| { ok: true }
	/** `allowed`: the classes and types that can hold it, as they are shown to players. */
	| { ok: false; reason: 'type'; allowed: string[] }
	/** `level`: the level the monster needs. */
	| { ok: false; reason: 'level'; level: number };

export interface HoldableCard {
	level?: number;
	permittedClassesAndTypes?: string[];
}

export interface HoldingMonster {
	level?: number;
	class?: string;
	creatureType?: string;
}

export const cardHoldVerdict = (card: HoldableCard, monster: HoldingMonster): CardHoldVerdict => {
	const permitted = card.permittedClassesAndTypes;
	if (
		permitted &&
		!permitted.includes(monster.class as string) &&
		!permitted.includes(monster.creatureType as string)
	) {
		return { ok: false, reason: 'type', allowed: [...permitted] };
	}

	// Same test as canHold: a card with no level (0 or missing) is open to everyone.
	// Written as `!(a <= b)` to match canHold's `a <= b` exactly, even for a missing level.
	if (card.level && !(card.level <= (monster.level as number))) {
		return { ok: false, reason: 'level', level: card.level };
	}

	return { ok: true };
};
