import { MAX_CARD_COPIES_IN_HAND } from '../../constants/card-management.js';

/**
 * Why a card cannot go on a monster, and the sentences that say so. One home for the
 * Workshop, the server's private announcements and the engine's own announce, so the three
 * cannot drift (roadmap 39 B5: they all used to say "Equipped X: 1/1", a count of cards moved
 * in one call rather than anything about the deck, with no reason for a skipped card).
 *
 * The first four codes are what `Beastmaster.equipCards` / `loadPreset` return for a skipped
 * card (`EquipSkipReason`); `fighting` is known from the monster's `inEncounter` flag.
 * Pure, no Node imports: `browser.ts` re-exports it for the web app.
 */
export type CardRefusalReason =
	| 'cannot_hold'
	| 'deck_full'
	| 'max_copies'
	| 'not_in_inventory'
	| 'fighting';

/**
 * One reason per code, written without pronouns: the sentence already names the monster,
 * whose pronouns this code does not know. Each ends without a full stop.
 */
export const CARD_REFUSAL_REASON_TEXT: Record<CardRefusalReason, string> = {
	cannot_hold: "that kind of monster can't use it",
	deck_full: 'every card slot is taken',
	max_copies: "that's already the most copies one monster can hold",
	not_in_inventory: 'no copy of it is left in your inventory',
	fighting: 'cards are locked until the fight ends',
};

export const isCardRefusalReason = (value: string): value is CardRefusalReason =>
	Object.prototype.hasOwnProperty.call(CARD_REFUSAL_REASON_TEXT, value);

/** `{Card} can't go on {Monster}: {reason}.` */
export function cardRefusalSentence(cardName: string, monsterName: string, reason: string): string {
	const text = isCardRefusalReason(reason) ? CARD_REFUSAL_REASON_TEXT[reason] : CARD_REFUSAL_REASON_TEXT.cannot_hold;
	return `${cardName} can't go on ${monsterName}: ${text}.`;
}

/**
 * The first reason a card cannot be added to this monster right now, or null when it can.
 * Mirrors `Beastmaster.equipCards` exactly: a fight locks everything (it throws before any
 * card is looked at), then per card: no free slot, then the monster cannot hold it, then it
 * already holds the most copies. `cardSlots` of 0 is the server's fallback for an unreadable
 * record, so it means "unknown", not "full".
 */
export function cardRefusalReason(params: {
	cardName: string;
	monster: { cards: string[]; cardSlots: number; inEncounter?: boolean };
	compatible: boolean;
}): CardRefusalReason | null {
	const { cardName, monster, compatible } = params;
	if (monster.inEncounter) return 'fighting';
	if (monster.cardSlots > 0 && monster.cards.length >= monster.cardSlots) return 'deck_full';
	if (!compatible) return 'cannot_hold';
	const copies = monster.cards.filter((name) => name === cardName).length;
	if (copies >= MAX_CARD_COPIES_IN_HAND) return 'max_copies';
	return null;
}

/**
 * The line after an equip: what went on, what did not and why, and what the deck holds now.
 * `cardNames` are the cards asked for, one entry per copy.
 */
export function equipResultMessage(params: {
	monsterName: string;
	cardNames: string[];
	result: {
		skippedCards: string[];
		skipped?: Array<{ cardName: string; reason: string }>;
		cardCount?: number | null;
		cardSlots?: number | null;
	};
}): string {
	const { monsterName, cardNames, result } = params;
	const skipped = result.skipped ?? result.skippedCards.map((cardName) => ({ cardName, reason: 'cannot_hold' }));
	// Skipped entries are per requested copy, so remove one requested name per skip.
	const remaining = [...cardNames];
	for (const { cardName } of skipped) {
		const at = remaining.indexOf(cardName);
		if (at >= 0) remaining.splice(at, 1);
	}
	const parts: string[] = [];
	if (remaining.length > 0) {
		const what = remaining.length === 1 ? remaining[0] : `${remaining.length} cards`;
		parts.push(`Equipped ${what} on ${monsterName}.`);
		if (typeof result.cardCount === 'number' && typeof result.cardSlots === 'number') {
			parts.push(`${monsterName} holds ${result.cardCount} of ${result.cardSlots} cards.`);
		}
	}
	// Four copies of one card refused for one reason read as one sentence, not four.
	const seen = new Set<string>();
	for (const { cardName, reason } of skipped) {
		const key = `${cardName}\u0000${reason}`;
		if (seen.has(key)) continue;
		seen.add(key);
		parts.push(cardRefusalSentence(cardName, monsterName, reason));
	}
	return parts.join(' ');
}
