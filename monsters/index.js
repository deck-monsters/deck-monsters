const { getCardCounts, hydrateCard, sortCards } = require('../cards');
const {
	getChoices, getCardChoices, getCreatureTypeChoices, getFinalCardChoices
} = require('../helpers/choices');
const PRONOUNS = require('../helpers/pronouns');

const Basilisk = require('./basilisk');
const Gladiator = require('./gladiator');
const Minotaur = require('./minotaur');
const WeepingAngel = require('./weeping-angel');

const genders = Object.keys(PRONOUNS);

const all = [
	Basilisk,
	Gladiator,
	Minotaur,
	WeepingAngel
];

// Channel should be a function that takes a question and an optional array of
// choices and returns an answer to the question (or a Promise that resolves to
// an answer to the question), or that takes a statement to announce.
const spawn = (channel, {
	type, name, color, gender, cards, game, xp
} = {}) => {
	const options = {};

	if (cards && cards.length > 0) {
		options.cards = cards;
	}

	if (xp && xp > 0) {
		options.xp = xp;
	}

	let monsterNames = [];
	if (game) {
		monsterNames = Object.keys(game.getAllMonstersLookup());
	}

	const askForCreatureType = () => Promise
		.resolve()
		.then(() => {
			if (type !== undefined) {
				return type;
			}

			return channel({
				question:
`Which type of monster would you like to spawn?

${getCreatureTypeChoices(all)}`,
				choices: Object.keys(all)
			});
		})
		.then((answer) => {
			const Monster = all[answer];

			return Monster;
		});

	const askForName = (Monster, alreadyTaken) => Promise
		.resolve()
		.then(() => {
			if (name !== undefined && !alreadyTaken) {
				return name;
			}

			let question = '';
			if (alreadyTaken) question += 'That name is already taken, please choose a different name. ';

			question += `What would you like to name your new ${Monster.creatureType.toLowerCase()}?`;

			return channel({
				question
			});
		})
		.then((answer) => {
			if (monsterNames.includes(answer.toLowerCase())) {
				return askForName(Monster, true);
			}

			options.name = answer;
			return options;
		});

	const askForColor = () => Promise
		.resolve()
		.then(() => {
			if (color !== undefined) {
				return color;
			}

			return channel({
				question: `What color should ${options.name} be?`
			});
		})
		.then((answer) => {
			options.color = answer.toLowerCase();
			return options;
		});

	const askForGender = Monster => Promise
		.resolve()
		.then(() => {
			if (gender !== undefined) {
				return gender;
			}

			return channel({
				question:
`What gender is ${options.name} the ${options.color} ${Monster.creatureType.toLowerCase()}?

${getChoices(genders)}`,
				choices: Object.keys(genders)
			});
		})
		.then((answer) => {
			options.gender = genders[answer].toLowerCase();
			return options;
		});

	let Monster;
	return Promise
		.resolve()
		.then(askForCreatureType)
		.then((Type) => {
			Monster = Type;

			return Monster;
		})
		.then(() => askForName(Monster))
		.then(askForColor)
		.then(() => askForGender(Monster))
		.then(() => new Monster(options));
};

const equip = (deck, monster, cardSelection, channel) => {
	const cards = [];
	const { cardSlots } = monster;

	const addCard = ({ remainingSlots, remainingCards }) => {
		if (monster.inEncounter) {
			return Promise.reject(channel({
				announce: `You cannot equip ${monster.options.name} while they are fighting!`
			}));
		}

		const possibleCards = getCardCounts(remainingCards);

		return Promise
			.resolve()
			.then(() => channel({
				question:
`You have ${remainingSlots} of ${cardSlots} slots remaining, and the following cards:

${getCardChoices(possibleCards)}

Which card would you like to equip in slot ${(cardSlots - remainingSlots) + 1}?`,
				choices: Object.keys(Object.keys(possibleCards))
			}))
			.then((answer) => {
				const nowRemainingSlots = remainingSlots - 1;
				const nowRemainingCards = [...remainingCards];
				const selectedCardType = Object.keys(possibleCards)[answer];
				const cardInPool = nowRemainingCards.findIndex(card => card.cardType === selectedCardType);

				const selectedCard = nowRemainingCards.splice(cardInPool, 1)[0];
				cards.push(selectedCard);

				return channel({
					announce: `You selected a ${selectedCard.cardType.toLowerCase()} card.`
				})
					.then(() => {
						if (nowRemainingSlots <= 0) {
							return channel({
								announce:
`You've filled your slots with the following cards:

${getFinalCardChoices(cards)}`
							});
						}

						if (nowRemainingCards.length <= 0) {
							return channel({
								announce:
`You're out of cards to equip, but you've equiped the following cards:

${getFinalCardChoices(cards)}`
							});
						}

						return addCard({ remainingSlots: nowRemainingSlots, remainingCards: nowRemainingCards });
					})
					.then(() => cards);
			});
	};

	return Promise
		.resolve()
		.then(() => {
			if (cardSlots <= 0) {
				return Promise.reject(channel({
					announce: 'You have no card slots available!'
				}));
			}

			if (deck.length <= 0) {
				return Promise.reject(channel({
					announce: 'Your deck is empty!'
				}));
			}

			const nowRemainingCards = sortCards([...deck]
				.filter(card => monster.canHoldCard(card)));

			if (cardSelection) {
				cardSelection.forEach((card) => {
					if (cardSlots - cards.length > 0) {
						const cardIndex = nowRemainingCards.findIndex(potentialCard => potentialCard.cardType.toLowerCase() === card.toLowerCase()); // eslint-disable-line max-len

						if (cardIndex >= 0) {
							const selectedCard = nowRemainingCards.splice(cardIndex, 1)[0];
							cards.push(selectedCard);
						}
					}
				});
			}

			const nowRemainingSlots = cardSlots - cards.length;
			if (nowRemainingSlots <= 0) {
				return channel({
					announce:
`You've filled your slots with the following cards:

${getFinalCardChoices(cards)}`
				}).then(() => cards);
			}

			return addCard({ remainingSlots: nowRemainingSlots, remainingCards: nowRemainingCards });
		});
};

const hydrateMonster = (monsterObj) => {
	const Monster = all.find(({ name }) => name === monsterObj.name);
	const options = {
		...monsterObj.options,
		cards: []
	};

	const monster = new Monster(options);

	if (monsterObj.options.cards) {
		monster.cards = monsterObj.options.cards.map(cardObj => hydrateCard(cardObj, monster));
	}

	return monster;
};

const hydrateMonsters = monstersJSON => JSON
	.parse(monstersJSON)
	.map(hydrateMonster);

module.exports = {
	all,
	spawn,
	equip,
	hydrateMonster,
	hydrateMonsters
};
