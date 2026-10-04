import chooseItems from '../helpers/choose.js';
import getClosingTime from './closing-time.js';
import { announceAndThrow } from '../../helpers/announce-and-throw.js';
import { getChoices, getFinalItemChoices, resolveChoiceIndex } from '../../helpers/choices.js';
import type { ShopHost } from './shop.js';
import { joinGrouped } from '../../helpers/join-list.js';
import { getItemKey } from '../helpers/counts.js';
import { isSortingHat, withSortingHat } from './stock.js';

// The menu labels are the single source of truth for both the rendered question text and
// the dispatch logic below — see resolveChoiceIndex's doc comment for why a hand-numbered
// menu that disagrees with its own dispatch is exactly the bug this replaced (Items/Cards/
// Back Room were previously off by one, and Back Room was a silent fall-through default —
// see docs/roadmap/10b-bugs-fixed.md).
const SHOP_MENU_LABELS = ['Items', 'Cards', 'Back Room'];

// Card choosing is referenced via any until cards module is ready
type ChooseCards = (opts: { cards: any[]; channel: any; showPrice?: boolean; priceOffset?: number }) => Promise<any[]>;

const ownedCountSuffix = (character: any, itemType: string): string => {
	const owned = (character.items as any[] || []).filter((i: any) => i.itemType === itemType).length;
	return owned > 0 ? ` [own ${owned}]` : '';
};

/**
 * First line of the shop's pick prompt. The wording is the contract with the web client:
 * `InlineChoices` reads "items to buy" off the question to label its confirm button
 * "Buy n items" instead of the equip wording. Discord and older clients just see the text
 * ("one or more" still marks it multi-select), so the change is additive. See
 * docs/reference/prompt-answer-contract.md.
 */
const SHOP_PICK_QUESTION = 'Choose one or more of the following items to buy:';

const addOwnershipToChoiceQuestion = (character: any, items: any[]) =>
	({ itemChoices }: { itemChoices: string }): string => {
		const lines = itemChoices.split('\n').map((line: string) => {
			const match = line.match(/^(\d+\))\s+(.+?)\s*(-\s*\d+.*)?$/);
			if (!match) return line;
			const itemType = match[2].trim();
			return line + ownedCountSuffix(character, itemType);
		});
		return `${SHOP_PICK_QUESTION}\n\n${lines.join('\n')}`;
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

${getChoices(SHOP_MENU_LABELS)}`,
			choices: SHOP_MENU_LABELS
		}))
		.then((answer: string | number = '') => {
			let priceOffset = shop.priceOffset * 2;
			const selection = resolveChoiceIndex(answer, SHOP_MENU_LABELS);

			if (selection === 0) {
				// Items
				if (items.length < 1) return announceAndThrow(channel, "We don't have any items here.");

				return chooseItems({ items, channel, showPrice: true, priceOffset, getQuestion: addOwnershipToChoiceQuestion(character, items) })
					.then((choices: any[]) => ({ choices, priceOffset }));
			}

			if (selection === 1) {
				// Cards
				if (cards.length < 1) return announceAndThrow(channel, "We don't have any cards here.");

				if (!chooseCards) return announceAndThrow(channel, "Cards are not available.");

				return chooseCards({ cards, channel, showPrice: true, priceOffset: shop.priceOffset * 2 })
					.then((choices: any[]) => ({ choices, priceOffset }));
			}

			if (selection === 2) {
				// Back Room
				if (backRoom.length < 1) return announceAndThrow(channel, "Sorry, pal. That area's closed.");

				priceOffset = shop.backRoomOffset;

				return channel({
					announce:
`The proprietor of ${shop.name} ${character.coins > 500 ? 'smiles slightly' : 'pauses for a second'}.

But of course, ${character.givenName}. We have something really special in stock right now.`
				})
					.then(() => chooseItems({ items: backRoom, channel, showPrice: true, priceOffset, getQuestion: addOwnershipToChoiceQuestion(character, backRoom) }))
					.then((choices: any[]) => ({ choices, priceOffset }));
			}

			// An unrecognised answer must never silently fall through to a valid branch —
			// that is exactly how this menu used to route "Items" clicks into the Back Room
			// (see docs/roadmap/10b-bugs-fixed.md). Dispatch explicitly on every valid
			// choice above and treat anything else as a visible refusal.
			return announceAndThrow(channel, `Sorry, I didn't understand that. Please choose one of: ${SHOP_MENU_LABELS.join(', ')}.`);
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
`${joinGrouped(choices.map(getItemKey))} from ${shop.name} for ${value} ${value === 1 ? 'coin' : 'coins'}. Buy ${choices.length === 1 ? 'it' : 'them'}? (yes/no)`
			})
				.then((answer: string = '') => {
					if (answer.toLowerCase() !== 'yes') {
						return channel({ announce: "Good day, then. You won't find a better price anywhere these days I'm afraid." });
					}

					// Re-read the shop at commit time. This flow has been awaiting user
					// prompts (potentially for minutes), and other members of the room
					// buy and sell in their own concurrency lanes meanwhile — see
					// docs/architecture/engine-concurrency-and-timing.md. Committing a mutation built
					// on the snapshot captured before those prompts would clobber their
					// purchases, resurrect already-sold stock, or overwrite a shop that
					// has since rotated past its closing time.
					const currentShop = host.shop;
					const remainingCards = [...currentShop.cards];
					const remainingItems = [...currentShop.items];
					const remainingBackRoom = [...currentShop.backRoom];

					const purchased: any[] = [];
					const soldOut: any[] = [];

					choices.forEach((chosen: any) => {
						const pool = chosen.cardType ? remainingCards : remainingItems;
						let poolIndex = pool.indexOf(chosen);
						// The hat is always restocked, so a hat bought while this player was deciding
						// has a replacement: take that one instead of calling it sold out.
						if (poolIndex < 0 && isSortingHat(chosen)) poolIndex = pool.findIndex(isSortingHat);
						const choice = poolIndex > -1 ? pool[poolIndex] : chosen;

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
						items: withSortingHat(remainingItems),
						backRoom: remainingBackRoom
					});

					// The receipt names what was bought and what is left, and says what to do next
					// (new-player walk 2, I3). It replaces the old "Sold! Thank you..." plus a
					// separate coins line. The "use or give" hint is about items, so a cards-only
					// purchase gets the receipt without it.
					const boughtItem = purchased.some((choice: any) => !choice.cardType);
					const coinsLeft = character.coins;
					return Promise.resolve(soldOutNotice).then(() => channel({
						announce:
`Sold: ${joinGrouped(purchased.map(getItemKey))}. ${character.givenName} has ${coinsLeft} ${coinsLeft === 1 ? 'coin' : 'coins'} left.${boughtItem ? ' Use an item with use, or give it to a monster with give.' : ''}`
					})).then(() => true);
				})
				.then((sold: unknown) => {
					// A purchase's receipt already says the coins left; the other endings
					// (declined, sold out, can't afford) still close with the balance.
					if (sold === true) return undefined;
					return channel({
						announce:
`${character.givenName} has ${character.coins} ${character.coins === 1 ? 'coin' : 'coins'}.`
					});
				});
		});
};

export default buyItems;
export { buyItems, SHOP_PICK_QUESTION };
