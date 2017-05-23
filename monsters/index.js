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
const spawn = (channel, { type, name, color, gender, cards, game } = {}) => {
	const options = {};

	if (cards && cards.length > 0) {
		options.cards = cards;
	}

	let monsterNames = [];
	if (game) {
		const allMonsters = game.getAllMonsters();
		monsterNames = allMonsters.reduce((monsters, monster) => monsters.concat(monster.givenName), []);
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
