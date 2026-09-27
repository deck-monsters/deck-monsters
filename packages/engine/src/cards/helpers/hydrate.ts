import { sortCardsAlphabetically } from './sort.js';
import all from './all.js';
import { UnknownCard } from './unknown-card.js';

export interface CardObj {
	name?: string;
	options?: Record<string, unknown>;
}

/**
 * Always a fresh instance. This used to return a matching card from a `deck` argument
 * instead, from when a monster's hand was a subset of the character's deck. Since #91
 * the deck is the *unequipped* pool, so reusing its cards aliased a restored hand to
 * unequipped cards, several hand cards to one object, and every identity-based move
 * (equip, unequip, move, sell) then lost or duplicated cards: a partial equip after a
 * restart dropped the monster's whole previous hand (10b #191).
 */
export const hydrateCard = (
	cardObj: CardObj,
	_monster?: any
): any => {
	if (cardObj?.name) {
		const Card = all.find(({ name }) => name === cardObj.name);
		if (Card) return new (Card as any)(cardObj.options);
	}

	// Never silently replace missing classes with a random draw — keep identity for repair.
	// Malformed payloads without a name also stay as an inert UnknownCard.
	return new UnknownCard(cardObj ?? {});
};

export const hydrateDeck = (
	deckJSON: CardObj[] | string = [],
	monster?: any
): any[] => {
	let deck: CardObj[] =
		typeof deckJSON === 'string' ? JSON.parse(deckJSON) : deckJSON;
	let hydratedDeck = deck.map(cardObj => hydrateCard(cardObj, monster));
	hydratedDeck = sortCardsAlphabetically(hydratedDeck as any) as any;

	return hydratedDeck;
};
