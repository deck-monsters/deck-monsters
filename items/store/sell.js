const chooseCards = require('../../cards/helpers/choose');
const chooseItems = require('../helpers/choose');

const getShop = require('./shop');

module.exports = ({
	character,
	channel
}) => {
	const shop = getShop();

	const { cards, items } = character;
	const numberOfItems = items.length === 1 ? '1 item' : `${items.length} items`;
	const numberOfCards = cards.length === 1 ? '1 card' : `${cards.length} cards`;

	return Promise
		.resolve()
		.then(() => channel({
			question:
`You push open a ${shop.adjective} door and find yourself in ${shop.name}.

You have ${numberOfItems} and ${numberOfCards}. Which would you like to sell?

1) Items
2) Cards`,
			choices: [1, 2]
		}))
		.then((answer = '') => {
			if (answer - 0 === 1) {
				if (items.length < 1) return Promise.reject(channel({ announce: "You don't have any items." }));

				return chooseItems({ items, channel });
			}

			if (cards.length < 1) return Promise.reject(channel({ announce: "You don't have any cards." }));

			return chooseCards({ cards, channel, showPrice: true, priceOffset: shop.priceOffset });
		})
		.then((choices) => {
			const value = choices.reduce((total, choice) => total + Math.round(choice.cost * shop.priceOffset), 0);

			return channel({
				question:
`${shop.name} is willing to buy your pitiful trash for ${value} coins.

Would you like to sell? (yes/no)`
			})
				.then((answer = '') => {
					if (answer.toLowerCase() === 'yes') {
						choices.forEach((choice) => {
							if (choice.cardType) {
								shop.cards.push(choice);
								character.removeCard(choice);
							} else {
								shop.items.push(choice);
								character.removeItem(choice);
							}
						});

						character.coins += value;

						if (value > 1) {
							return channel({
								announce:
`Here's your ${value} coins, ${character.givenName}. Pleasure doing business with you.`
							});
						} else if (value === 1) {
							return channel({
								announce:
`The proprietor of ${shop.name} flips a single coin to ${character.givenName} without really looking at ${character.pronouns[1]} and promptly hangs a "Closed" sign in the window of the shop.` // eslint-disable-line max-len
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
