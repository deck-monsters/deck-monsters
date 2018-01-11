const shuffle = require('lodash.shuffle');

const isProbable = require('../../helpers/is-probable');

const all = require('./all');

const draw = (options, creature) => {
	let deck = shuffle(all);

	if (creature) {
		deck = deck.filter(card => creature.canHoldCard(card));
	}

	const Card = deck.find(isProbable);

	if (!Card) return draw(options, creature);

	// In the future we may want to pass some options to the cards,
	// but we need to make sure that we only pass card-related options.
	// For example, the level is not meant to passed to the card.
	return new Card(options);
};

module.exports = draw;
