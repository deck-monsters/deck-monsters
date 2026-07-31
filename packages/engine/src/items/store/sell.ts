import chooseItems from '../helpers/choose.js';
import getClosingTime from './closing-time.js';
import { announceAndThrow } from '../../helpers/announce-and-throw.js';
import type { ShopHost } from './shop.js';

type ChooseCards = (opts: { cards: any[]; channel: any; showPrice?: boolean; priceOffset?: number }) => Promise<any[]>;

const sellItems = ({
	character,
	channel,
	host,
	chooseCards
}: {
	character: any;
	channel: any;
	host: ShopHost;
	chooseCards?: ChooseCards;
}): Promise<void> => {
	const shop = host.shop;

	const { cards, items } = character;
	const numberOfItems = items.length === 1 ? '1 item' : `${items.length} items`;
	const numberOfCards = cards.length === 1 ? '1 card' : `${cards.length} cards`;

	return Promise
		.resolve()
		.then(() => channel({
			question:
`You push open a ${shop.adjective} door and find yourself in ${shop.name}.

${getClosingTime(shop)}

You have ${numberOfItems} and ${numberOfCards}. Which would you like to sell?

1) Items
2) Cards`,
			choices: [1, 2]
		}))
		.then((answer: string | number = '') => {
			if (Number(answer) === 1) {
				if (items.length < 1) return announceAndThrow(channel, "You don't have any items.");

				return chooseItems({ items, channel });
			}

			if (cards.length < 1) return announceAndThrow(channel, "You don't have any cards.");

			if (!chooseCards) return announceAndThrow(channel, "Card selling is not available.");

			return chooseCards({ cards, channel, showPrice: true, priceOffset: shop.priceOffset });
		})
		.then((choices: any[]) => {
			const value = choices.reduce(
				(total: number, choice: any) => total + Math.round(choice.cost * shop.priceOffset),
				0
			);

			return channel({
				question:
`${shop.name} is willing to buy your pitiful trash for ${value} coins.

Would you like to sell? (yes/no)`
			})
				.then((answer: string = '') => {
					if (answer.toLowerCase() === 'yes') {
						// Re-read the shop at commit time — see the matching comment in
						// buy.ts. Building this mutation on the pre-prompt snapshot would
						// discard any purchase another room member made while this flow
						// waited on its prompts.
						const currentShop = host.shop;
						const newCards = [...currentShop.cards];
						const newItems = [...currentShop.items];

						choices.forEach((choice: any) => {
							if (choice.cardType) {
								newCards.push(choice);
								character.removeCard(choice);
							} else {
								newItems.push(choice);
								character.removeItem(choice);
							}
						});

						host.commitShop({ ...currentShop, cards: newCards, items: newItems });

						character.coins += value;

						if (value > 1) {
							return channel({
								announce:
`Here's your ${value} coins, ${character.givenName}. Pleasure doing business with you.`
							});
						} else if (value === 1) {
							return channel({
								announce:
`The proprietor of ${shop.name} flips a single coin to ${character.givenName} without really looking at ${character.pronouns.him} and promptly hangs a "Closed" sign in the window of the shop.`
							});
						}

						return channel({ announce: `More than happy to haul this junk away for you, ${character.givenName}.` });
					}

					return channel({ announce: "Good day, then. You won't find a better price anywhere these days I'm afraid." });
				})
				.then(() => channel({
					announce:
`${character.givenName} has ${character.coins} ${character.coins === 1 ? 'coin' : 'coins'}.`
				}));
		});
};

export default sellItems;
export { sellItems };
