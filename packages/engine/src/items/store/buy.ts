import chooseItems from '../helpers/choose.js';
import getClosingTime from './closing-time.js';
import { announceAndThrow } from '../../helpers/announce-and-throw.js';
import { getFinalItemChoices } from '../../helpers/choices.js';
import type { ShopHost } from './shop.js';

// Card choosing is referenced via any until cards module is ready
type ChooseCards = (opts: { cards: any[]; channel: any; showPrice?: boolean; priceOffset?: number }) => Promise<any[]>;

const ownedCountSuffix = (character: any, itemType: string): string => {
	const owned = (character.items as any[] || []).filter((i: any) => i.itemType === itemType).length;
	return owned > 0 ? ` [own ${owned}]` : '';
};

const addOwnershipToChoiceQuestion = (character: any, items: any[]) =>
	({ itemChoices }: { itemChoices: string }): string => {
		const lines = itemChoices.split('\n').map((line: string) => {
			const match = line.match(/^(\d+\))\s+(.+?)\s*(-\s*\d+.*)?$/);
			if (!match) return line;
			const itemType = match[2].trim();
			return line + ownedCountSuffix(character, itemType);
		});
		return `Choose one or more of the following items:\n\n${lines.join('\n')}`;
	};

const buyItems = ({
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

	const { cards, items, backRoom } = shop;
	const numberOfItems = items.length === 1 ? '1 item' : `${items.length} items`;
	const numberOfCards = cards.length === 1 ? '1 card' : `${cards.length} cards`;

	return Promise
		.resolve()
		.then(() => channel({
			question:
`You push open a ${shop.adjective} door and find yourself in ${shop.name} with ${character.coins} ${character.coins === 1 ? 'coin' : 'coins'} in your pocket.

${getClosingTime(shop)}

We have ${numberOfItems} and ${numberOfCards}. Which would you like to see?

1) Items
2) Cards
3) Back Room`,
			choices: [1, 2, 3]
		}))
		.then((answer: string | number = '') => {
			let priceOffset = shop.priceOffset * 2;

			if (Number(answer) === 1) {
				if (items.length < 1) return announceAndThrow(channel, "We don't have any items here.");

			return chooseItems({ items, channel, showPrice: true, priceOffset, getQuestion: addOwnershipToChoiceQuestion(character, items) })
				.then((choices: any[]) => ({ choices, priceOffset }));
			} else if (Number(answer) === 2) {
				if (cards.length < 1) return announceAndThrow(channel, "We don't have any cards here.");

				if (!chooseCards) return announceAndThrow(channel, "Cards are not available.");

				return chooseCards({ cards, channel, showPrice: true, priceOffset: shop.priceOffset * 2 })
					.then((choices: any[]) => ({ choices, priceOffset }));
			}

			if (backRoom.length < 1) return announceAndThrow(channel, "Sorry, pal. That area's closed.");

			priceOffset = shop.backRoomOffset;

			return channel({
				announce:
`The proprietor of ${shop.name} ${character.coins > 500 ? 'smiles slightly' : 'pauses for a second'}.

But of course, ${character.givenName}. We have something really special in stock right now.`
			})
				.then(() => chooseItems({ items: backRoom, channel, showPrice: true, priceOffset }))
				.then((choices: any[]) => ({ choices, priceOffset }));
		})
		.then(({ choices, priceOffset }: { choices: any[]; priceOffset: number }) => {
			const value = choices.reduce(
				(total: number, choice: any) => total + Math.round(choice.cost * priceOffset),
				0
			);

			if (value > character.coins) {
				return announceAndThrow(channel,
					`The proprietor of ${shop.name} eyes ${character.givenName} disdainfully.

That'll be ${value} coins, but by the looks of things I _highly_ doubt that's in your price range.`
				);
			}

			return channel({
				question:
`These ${priceOffset > 2 ? 'exquisite' : 'fine'} items are available from ${shop.name} for a mere ${value} coins.

Would you like to buy them? (yes/no)`
			})
				.then((answer: string = '') => {
					if (answer.toLowerCase() !== 'yes') {
						return channel({ announce: "Good day, then. You won't find a better price anywhere these days I'm afraid." });
					}

					// Re-read the shop at commit time. This flow has been awaiting user
					// prompts (potentially for minutes), and other members of the room
					// buy and sell in their own concurrency lanes meanwhile — see
					// docs/engine-concurrency-and-timing.md. Committing a mutation built
					// on the snapshot captured before those prompts would clobber their
					// purchases, resurrect already-sold stock, or overwrite a shop that
					// has since rotated past its closing time.
					const currentShop = host.shop;
					const remainingCards = [...currentShop.cards];
					const remainingItems = [...currentShop.items];
					const remainingBackRoom = [...currentShop.backRoom];

					const purchased: any[] = [];
					const soldOut: any[] = [];

					choices.forEach((choice: any) => {
						const pool = choice.cardType ? remainingCards : remainingItems;
						const poolIndex = pool.indexOf(choice);

						if (poolIndex > -1) {
							pool.splice(poolIndex, 1);
							purchased.push(choice);
							return;
						}

						const backRoomIndex = remainingBackRoom.indexOf(choice);
						if (backRoomIndex > -1) {
							remainingBackRoom.splice(backRoomIndex, 1);
							purchased.push(choice);
							return;
						}

						soldOut.push(choice);
					});

					const soldOutNotice = soldOut.length > 0
						? channel({
							announce:
`Sorry — ${getFinalItemChoices(soldOut)} sold while you were deciding. ${soldOut.length === 1 ? "It's" : "They're"} no longer available.`
						})
						: Promise.resolve();

					if (purchased.length < 1) {
						return Promise.resolve(soldOutNotice).then(() =>
							channel({ announce: 'Nothing left to sell you today, I\'m afraid.' })
						);
					}

					const finalValue = purchased.reduce(
						(total: number, choice: any) => total + Math.round(choice.cost * priceOffset),
						0
					);

					if (finalValue > character.coins) {
						return Promise.resolve(soldOutNotice).then(() =>
							channel({ announce: `That'll be ${finalValue} coins — which you no longer have. Come back when you do.` })
						);
					}

					character.coins -= finalValue;

					purchased.forEach((choice: any) => {
						if (choice.cardType) {
							character.addCard(choice);
						} else {
							character.addItem(choice);
						}
					});

					host.commitShop({
						...currentShop,
						cards: remainingCards,
						items: remainingItems,
						backRoom: remainingBackRoom
					});

					return Promise.resolve(soldOutNotice).then(() => channel({
						announce:
`Sold! Thank you for your purchase, ${character.givenName}. It was a pleasure doing business with you.`
					}));
				})
				.then(() => channel({
					announce:
`${character.givenName} has ${character.coins} ${character.coins === 1 ? 'coin' : 'coins'}.`
				}));
		});
};

export default buyItems;
export { buyItems };
