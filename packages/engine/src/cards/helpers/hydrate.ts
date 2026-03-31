import { sortCardsAlphabetically } from './sort.js';
import all from './all.js';
import { draw } from './draw.js';
import { isMatchingCard } from './is-matching.js';

export interface CardObj {
	name: string;
	options?: Record<string, unknown>;
}

export const hydrateCard = (
	cardObj: CardObj,
	monster?: any,
	deck: any[] = []
): any => {
	const existingCard = deck.find(card => isMatchingCard(card, cardObj));
	if (existingCard) return existingCard;

	const Card = all.find(({ name }) => name === cardObj.name);
	if (Card) return new (Card as any)(cardObj.options);

	return draw({}, monster);
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
