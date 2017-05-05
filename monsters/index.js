const startCase = require('lodash.startcase');

const { hydrateCard } = require('../cards');
const PRONOUNS = require('../helpers/pronouns');
const Basilisk = require('./basilisk');
const Minotaur = require('./minotaur');
const WeepingAngel = require('./weeping-angel');

const all = [
	Basilisk,
	Minotaur,
	WeepingAngel
];

// Channel should be a function that takes a question and an optional array of
// choices and returns an answer to the question (or a Promise that resolves to
// an answer to the question), or that takes a statement to announce.
const spawn = (channel, { type, name, color, gender } = {}) => {
	const monsterTypes = all.map(monster => monster.creatureType);
	const options = {};

	let Monster;
	return Promise
		.resolve()
		.then(() => {
			if (type) {
				return type;
			}

			return channel({
				question: 'Which type of monster would you like to spawn?',
				choices: monsterTypes
			});
		})
		.then((answer) => {
			Monster = all.find(monster => monster.creatureType.toLowerCase() === answer.toLowerCase());

			if (name) {
				return name;
			}

			return channel({
				question: `What would you like to name your new ${Monster.creatureType.toLowerCase()}?`
			});
		})
		.then((answer) => {
			// TO-DO: Keep a master list of monsters and ensure that there are no duplicate names
			options.name = startCase(answer.toLowerCase());

			if (color) {
				return color;
			}

			return channel({
				question: `What color should ${options.name} be?`
			});
		})
		.then((answer) => {
			options.color = answer.toLowerCase();

			if (gender) {
				return gender;
			}

			return channel({
				question: `What gender is ${options.name} the ${options.color} ${Monster.creatureType.toLowerCase()}?`,
				choices: Object.keys(PRONOUNS)
			});
		})
		.then((answer) => {
			options.gender = answer.toLowerCase();

			return new Monster(options);
		});
};

const equip = (deck, monster, channel) => {
	const cards = [];
	const cardSlots = monster.cardSlots;

	const formatCards = remainingCards => remainingCards.map((card, index) => `${index}) ${card.cardType}` + '\n'); // eslint-disable-line no-useless-concat

	const addCard = ({ remainingSlots, remainingCards }) => Promise
		.resolve()
		.then(() => channel({
			question:
`You have ${remainingSlots} of ${cardSlots} remaining, and the following cards:
${formatCards(remainingCards)}
Which card would you like to equip in slot ${cardSlots - remainingSlots}?`,
			choices: Object.keys(remainingCards)
		}))
		.then((answer) => {
			const nowRemainingSlots = remainingSlots - 1;
			const nowRemainingCards = [...remainingCards];
			const selectedCard = nowRemainingCards.splice(answer, 1);
			cards.push(selectedCard);

			channel({
				announce: `You selected a ${selectedCard.cardType} card.`
			});

			if (nowRemainingSlots <= 0) {
				channel({
					announce:
`You've filled your slots with the following cards:
${formatCards(cards)}`
				});

				return cards;
			}

			if (nowRemainingCards.length <= 0) {
				channel({
					announce:
`You're out of cards to equip, but you've equiped the following cards:
${formatCards(cards)}`
				});

				return cards;
			}

			return addCard({ remainingSlots: nowRemainingSlots, remainingCards: nowRemainingCards });
		});

	return Promise
		.resolve()
		.then(() => {
			if (cardSlots <= 0) {
				channel({
					announce: 'You have no card slots available!'
				});

				return Promise.reject();
			}

			if (deck.length <= 0) {
				channel({
					announce: 'Your deck is empty!'
				});

				return Promise.reject();
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
