const { randomColor } = require('grab-color-names');
const emoji = require('node-emoji');
const random = require('lodash.random');
const sample = require('lodash.sample');
const shuffle = require('lodash.shuffle');

const { all: allMonsters } = require('../../monsters');
const { fillDeck, getMinimumDeck } = require('../../cards');
const { TARGET_HUMAN_PLAYER_WEAK } = require('../../helpers/targeting-strategies');
const { XP_PER_VICTORY } = require('../../helpers/experience');
const Beastmaster = require('../beastmaster');

// Get a random Beastmaster
module.exports = ({
	battles = {},
	isBoss,
	Monsters,
	...options
} = {}) => {
	if (!battles.total) {
		battles.total = random(0, 180);
		battles.wins = random(0, battles.total);
		battles.losses = battles.total - battles.wins;
	}

	const icon = emoji.random().emoji;

	const xp = XP_PER_VICTORY * battles.wins;

	const monsters = (Monsters || [sample(allMonsters)]).map((Monster) => {
		const monster = new Monster({
			battles,
			color: randomColor()[1].toLowerCase(),
			isBoss,
			xp,
			...options
		});

		if (isBoss) {
			const { canHold } = monster;

			monster.canHold = object => canHold.call(monster, object) && !object.noBosses;
			monster.targetingStrategy = TARGET_HUMAN_PLAYER_WEAK; // Prefer not to target other bosses
		}

		return monster;
	});

	const character = new Beastmaster({
		battles,
		icon,
		isBoss,
		monsters,
		xp,
		...options
	});

	let cleanBossDeck;
	if (isBoss) {
		const weakTypes = ['Flee', 'Harden', 'Heal', 'Hit', 'WhiskeyShot'];
		cleanBossDeck = deck => deck.filter(card => !weakTypes.includes(card.cardType));
	} else {
		cleanBossDeck = deck => deck;
	}

	// If this is a boss, clean up the deck (reducing probability of certain cards)
	if (isBoss) {
		let deck = cleanBossDeck(getMinimumDeck());
		deck = cleanBossDeck(fillDeck(deck, {}, character));
		character.deck = fillDeck(deck, {}, character);
	}

	// Equip the monster
	monsters.forEach((monster) => {
		monster.cards = [
			...shuffle(character.deck.filter(card => monster.canHoldCard(card))),
			...fillDeck([], {}, monster) // Add more cards just in case the character doesn't have enough
		].slice(0, monster.cardSlots);
	});

	return character;
};
