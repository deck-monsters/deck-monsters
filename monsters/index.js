const { hydrateCard } = require('../cards');
const { getChoices, getCardChoices, getCreatureTypeChoices } = require('../helpers/choices');
const PRONOUNS = require('../helpers/pronouns');
const Basilisk = require('./basilisk');
const Minotaur = require('./minotaur');
const WeepingAngel = require('./weeping-angel');

const genders = Object.keys(PRONOUNS);

const all = [
	Basilisk,
	Minotaur,
	WeepingAngel
];

// Channel should be a function that takes a question and an optional array of
// choices and returns an answer to the question (or a Promise that resolves to
// an answer to the question), or that takes a statement to announce.
const spawn = (channel, { type, name, color, gender, cards } = {}) => {
	const options = {};

	if (cards && cards.length > 0) {
		options.cards = cards;
	}

	let Monster;
	return Promise
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
			Monster = all[answer];

			if (name !== undefined) {
				return name;
			}

			return channel({
				question: `What would you like to name your new ${Monster.creatureType.toLowerCase()}?`
			});
		})
		.then((answer) => {
			// TO-DO: Keep a master list of monsters and ensure that there are no duplicate names
			options.name = answer;

			if (color !== undefined) {
				return color;
			}

			return channel({
				question: `What color should ${options.name} be?`
			});
		})
		.then((answer) => {
			options.color = answer.toLowerCase();

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

			return new Monster(options);
		});
};

const equip = (deck, monster, channel) => {
	const cards = [];
	const cardSlots = monster.cardSlots;

	const addCard = ({ remainingSlots, remainingCards }) => Promise
		.resolve()
		.then(() => channel({
			question:
`You have ${remainingSlots} of ${cardSlots} slots remaining, and the following cards:

${getCardChoices(remainingCards)}

Which card would you like to equip in slot ${(cardSlots - remainingSlots) + 1}?`,
			choices: Object.keys(remainingCards)
		}))
		.then((answer) => {
			const nowRemainingSlots = remainingSlots - 1;
			const nowRemainingCards = [...remainingCards];
			const selectedCard = nowRemainingCards[answer];
			nowRemainingCards.splice(answer, 1);
			cards.push(selectedCard);

			return channel({
				announce: `You selected a ${selectedCard.cardType.toLowerCase()} card.`
			})
			.then(() => {
				if (nowRemainingSlots <= 0) {
					return channel({
						announce:
`You've filled your slots with the following cards:

${getCardChoices(cards)}`
					});
				}

				if (nowRemainingCards.length <= 0) {
					return channel({
						announce:
`You're out of cards to equip, but you've equiped the following cards:

${getCardChoices(cards)}`
					});
				}

				return addCard({ remainingSlots: nowRemainingSlots, remainingCards: nowRemainingCards });
			})
			.then(() => cards);
		});

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

			return addCard({ remainingSlots: cardSlots, remainingCards: deck });
		});
};

const hydrateMonster = (monsterObj) => {
	const Monster = all.find(({ name }) => name === monsterObj.name);
	const options = Object.assign({ cards: [] }, monsterObj.options);

	options.cards = options.cards.map(hydrateCard);

	return new Monster(options);
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
