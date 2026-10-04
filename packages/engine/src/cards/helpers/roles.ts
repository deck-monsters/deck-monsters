/**
 * What a card is for, as a player would sort their deck: exactly one role per card.
 * The guide groups by it, the Workshop labels slots with it and the Console lists by it.
 * It is separate from `cardClass`, which is an engine tag (the Ancient Dragon reads it,
 * and a card can carry several) and only loosely matches. Roadmap 44 has the rules.
 *
 * Browser-safe on purpose: strings only, no card imports. A test (`roles.test.ts`) fails
 * naming any card in `cards/helpers/all.ts` that has no entry here, and any entry that
 * names no card, so a new card cannot ship without a role.
 *
 * Keyed by the card's static `cardType`, not the class name: `cardType` is the name players
 * see, it is what saves, signatures (`SIGNATURE_CARD_TYPES`) and lookups already use, and
 * it survives minification. A class name does not (and two classes here do not match their
 * card: `CurseCard` is Soften, `BoostCard` is Harden).
 *
 * Destroy, Immobilize and Revive are not in `all.ts`, so no deck can hold them (a saved
 * copy hydrates to an UnknownCard) and they have no role.
 */
export type CardRole = 'attack' | 'area' | 'heal' | 'guard' | 'trick';

export const CARD_ROLES: readonly CardRole[] = ['attack', 'area', 'heal', 'guard', 'trick'];

export const CARD_ROLE_LABELS: Readonly<Record<CardRole, string>> = {
	attack: 'Attacks',
	area: 'Area attacks',
	heal: 'Healing',
	guard: 'Boosts and defence',
	trick: 'Tricks and curses',
};

/**
 * Rules (the plan's table), applied to what the card does:
 * - attack: damages one opponent, or only boosts the next hit. A hit with a minor rider
 *   (a chance to immobilize, a heal when badly hurt) is still an attack.
 * - area: strikes every opponent, or several at once.
 * - heal: gives hit points back.
 * - guard: raises the player's own defence or stats, hides it, or lets it escape.
 * - trick: holds, curses, poisons, confuses, steals or reorders rather than simply damaging.
 */
export const CARD_ROLE_BY_TYPE: Readonly<Record<string, CardRole>> = {
	'Adrenaline Rush': 'guard',
	// The donkey kicks one target; Boost is only its engine tag.
	'Asinine Companion': 'attack',
	'Bad Batch': 'trick',
	'Basic Shield': 'guard',
	'Battle Focus': 'attack',
	'Berserk': 'attack',
	'Blast': 'area',
	'Blast II': 'area',
	// Takes the target out of the fight and drains it later; not a plain hit.
	'Blink': 'trick',
	'Harden': 'guard',
	// A hit whose point is the xp curse.
	'Brain Drain': 'trick',
	'Calisthenics': 'guard',
	'Camouflage Vest': 'guard',
	'Cloak of Invisibility': 'guard',
	// Coil and Constrict: the hold is guaranteed and is the point; the hit is the fallback.
	// (Horn Gore and the forked weapons only have a chance to hold, so they stay attacks.)
	'Coil': 'trick',
	// A hit whose point is the int curse.
	'Concussion': 'trick',
	'Constrict': 'trick',
	// A hit whose point is the ac curse.
	'Soften': 'trick',
	'Delayed Hit': 'attack',
	'Dissonant Voice': 'trick',
	// Turns the next card played at the caster back on its player.
	'Enchanted Faceswap': 'trick',
	// Holds every opponent with no damage of its own (Mesmerize too); Entrance holds and hits.
	'Enthrall': 'trick',
	'Entrance': 'area',
	'Ecdysis': 'guard',
	'Feline Companion': 'guard',
	'Fight or Flight': 'attack',
	'Fire Breath': 'area',
	'Fists of Villainy': 'attack',
	'Fists of Virtue': 'attack',
	// Escape, which the rules put under guard.
	'Flee': 'guard',
	'Forked Metal Rod': 'attack',
	'Forked Stick': 'attack',
	'Gloaming Rest': 'heal',
	'Heal': 'heal',
	// Every opponent loses cards; no damage.
	'Helm of Awe': 'trick',
	'Hit': 'attack',
	'Hit Harder': 'attack',
	'Horn Gore': 'attack',
	// Heals 5 hp and clears a harm and wards one; the healing is the headline.
	'Horn of Proof': 'heal',
	'Horn Swipe': 'attack',
	// Hit, or a heal when badly hurt: the hit is the headline (same for Survival Knife, Turkey Thigh).
	'Iocane': 'attack',
	'The Kalevala': 'attack',
	'Lucky Strike': 'attack',
	'Mesmerize': 'trick',
	'Molasses': 'trick',
	// Hides the dragon when calm; the furious half only boosts its next hit.
	'Mood Scales': 'guard',
	'Pick Pocket': 'trick',
	'Pound': 'attack',
	// A round of milkshakes for everyone, with a chance to kill each: it reaches several at once.
	'1993-09-7202 18:58': 'area',
	'Random Play': 'trick',
	'Rehit': 'attack',
	'Sandstorm': 'area',
	'Scotch': 'heal',
	'Sticketh': 'attack',
	'Survival Knife': 'attack',
	'Tail Lash': 'attack',
	// Up out of reach: the first melee or area attack against the dragon misses.
	'Take Wing': 'guard',
	'Thick Skin': 'guard',
	'Tsunami': 'area',
	'Turkey Thigh': 'attack',
	'Unconquerable Horn': 'attack',
	'Vengeful Rampage': 'attack',
	'Whiskey Shot': 'heal',
	'Wooden Spear': 'attack',
};

/** Anything with a card's name: the name itself, a card class, or an instance. */
export type CardRef = string | { cardType?: string; itemType?: string };

/**
 * The card's stable name. For an instance this reads the class's static `cardType`, not the
 * instance getter: The Kalevala's getter appends its dice ("The Kalevala (1d4)") and changes
 * as it levels, so the getter would miss the table and the card would look role-less.
 */
export const cardTypeOf = (card: CardRef): string | undefined => {
	if (typeof card === 'string') return card;
	const staticType = (card as { constructor?: { cardType?: unknown } }).constructor?.cardType;
	if (typeof staticType === 'string') return staticType;
	return card.cardType ?? card.itemType;
};

/** The role of a card, or undefined for a card the table does not know (never one in a deck). */
export const roleOf = (card: CardRef): CardRole | undefined => {
	const type = cardTypeOf(card);
	// hasOwn: `Object.prototype` keys such as `constructor` are not cards.
	return type !== undefined && Object.hasOwn(CARD_ROLE_BY_TYPE, type) ? CARD_ROLE_BY_TYPE[type] : undefined;
};
