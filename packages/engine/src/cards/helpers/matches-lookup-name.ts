import { UnknownCard } from './unknown-card.js';

type LookupCard = {
	cardType?: string;
	itemType?: string;
	name?: string;
};

/**
 * Card name matching for equip/unequip/move/lookup flows.
 * Normal cards match their visible cardType (same as historical isSameCardName).
 * UnknownCard also accepts the original serialized class name as a repair alias.
 */
export function matchesCardLookupName(card: LookupCard, rawName: string): boolean {
	const wanted = String(rawName ?? '').trim().toLowerCase();
	if (!wanted) return false;

	const primary = String(card.cardType ?? card.itemType ?? card.name ?? '')
		.trim()
		.toLowerCase();
	if (primary === wanted) return true;

	if (card instanceof UnknownCard) {
		const original = String(card.name ?? '').trim().toLowerCase();
		if (original && original === wanted) return true;
	}

	return false;
}

export default matchesCardLookupName;
