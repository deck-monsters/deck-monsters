const BattleFocusCard = require('../battle-focus');
const BlastCard = require('../blast');
const BlinkCard = require('../blink');
const CoilCard = require('../coil');
const FleeCard = require('../flee');
const HealCard = require('../heal');
const HitCard = require('../hit');
const HornGoreCard = require('../horn-gore');
const SandstormCard = require('../sandstorm');

const { DEFAULT_MINIMUM_CARDS } = require('./constants');
const draw = require('./draw');

// Gets the base cards that all players should have
const getMinimumDeck = () => [
	new BlinkCard(),
	new CoilCard(),
	new HornGoreCard(),
	new BattleFocusCard(),
	new SandstormCard(),
	new BlastCard(),
	new HitCard(),
	new HitCard(),
	new HitCard(),
	new HitCard(),
	new HealCard(),
	new HealCard(),
	new FleeCard()
];

// Fills deck up with random cards appropriate for player's level
const fillDeck = (deck, options, creature) => {
	while (deck.length < DEFAULT_MINIMUM_CARDS) {
		deck.push(draw(options, creature));
	}

	return deck;
};

const getInitialDeck = (options, creature) => fillDeck(getMinimumDeck(), options, creature);

module.exports = {
	fillDeck,
	getInitialDeck,
	getMinimumDeck
};
