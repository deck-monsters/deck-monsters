/* eslint-disable max-len */

const chooseCards = require('../../cards/helpers/choose');
const chooseItems = require('../helpers/choose');

const getShop = require('./shop');

module.exports = ({
	character,
	channel
}) => {
	const shop = getShop();

	const { cards, items } = shop;
	const numberOfItems = items.length === 1 ? '1 item' : `${items.length} items`;
	const numberOfCards = cards.length === 1 ? '1 card' : `${cards.length} cards`;

	return Promise
		.resolve()
		.then(() => channel({
			question:
`You push open a ${shop.adjective} door and find yourself in ${shop.name} with ${character.coins} ${character.coins === 1 ? 'coin' : 'coins'} in your pocket.

We have ${numberOfItems} and ${numberOfCards}. Which would you like to see?

1) Items
2) Cards`,
			choices: [1, 2]
		}))
		.then((answer = '') => {
			if (answer - 0 === 1) {
				if (items.length < 1) return Promise.reject(channel({ announce: "We don't have any items here." }));

				return chooseItems({ items, channel });
			}

			if (cards.length < 1) return Promise.reject(channel({ announce: "We don't have any cards here." }));

			return chooseCards({ cards, channel, showPrice: true, priceOffset: shop.priceOffset * 2 });
		})
		.then((choices) => {
			const value = choices.reduce((total, choice) => total + Math.round(choice.cost * (shop.priceOffset * 2)), 0);

			if (value > character.coins) {
				return Promise.reject(channel({
					announce:
`The proprietor of ${shop.name} eyes ${character.givenName} disdainfully.

That'll be ${value} coins, but by the looks of things I _highly_ doubt that's in your price range.`
				}));
			}

			return channel({
				question:
	`These fine items are available from ${shop.name} for a mere ${value} coins.

	Would you like to buy them? (yes/no)`
			})
				.then((answer = '') => {
					if (answer.toLowerCase() === 'yes') {
						character.coins -= value;

						choices.forEach((choice) => {
							if (choice.cardType) {
								shop.cards.splice(shop.cards.indexOf(choice), 1);
								character.addCard(choice);
							} else {
								shop.items.splice(shop.items.indexOf(choice), 1);
								character.addItem(choice);
							}
						});

						return channel({
							announce:
`Sold! Thank you for your purchase, ${character.givenName}. It was a pleasure doing business with you.`
						});
					}

					return channel({ announce: "Good day, then. You won't find a better price anywhere these days I'm afraid." });
				})
				.then(() => channel({
					announce:
`${character.givenName} has ${character.coins} ${character.coins === 1 ? 'coin' : 'coins'}.`
				}));
		});
};
