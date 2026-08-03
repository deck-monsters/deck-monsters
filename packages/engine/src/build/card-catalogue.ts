import { actionCard, itemCard } from '../helpers/card.js';
import allCards from '../cards/helpers/all.js';
import allItems from '../items/helpers/all.js';
import { eachSeries } from '../helpers/promise.js';

export type DocOutputFn = (section: string) => Promise<void> | void;

const CARD_CATALOGUE_HEADER = `
*The Card Catalogue (Player Reference):*
Name, description, and rarity for every card and item in the game.
`.trim();

export const generateCardCatalogue = async (output: DocOutputFn): Promise<void> => {
	const cardList = allCards.map((Card: { cardType?: string }) => Card.cardType ?? '').join('\n');
	const itemList = allItems.map((Item: { itemType?: string }) => Item.itemType ?? '').join('\n');

	await output(`${CARD_CATALOGUE_HEADER}\n\n${cardList}`);
	await eachSeries(allCards, Card => output(actionCard(new Card(), false)));
	await output(`\n*The Item Catalogue:*\n\n${itemList}`);
	await eachSeries(allItems, Item => output(itemCard(new Item(), false)));
};

export default generateCardCatalogue;
