import { sortCardsAlphabetically } from './sort.js';
import all from './all.js';
import { isMatchingCard } from './is-matching.js';
import { UnknownCard } from './unknown-card.js';

export interface CardObj {
	name?: string;
	options?: Record<string, unknown>;
}

export const hydrateCard = (
	cardObj: CardObj,
	_monster?: any,
	deck: any[] = []
): any => {
	if (cardObj?.name) {
		const existingCard = deck.find(card =>
			isMatchingCard(card, cardObj as { name: string })
		);
		if (existingCard) return existingCard;

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
