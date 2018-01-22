const shuffle = require('lodash.shuffle');

const isProbable = require('../../helpers/is-probable');

const all = require('./all');

const draw = (options, creature) => {
	let items = shuffle(all);

	if (creature) {
		items = items.filter(item => creature.canHoldItem(item));
	}

	if (items.length <= 0) return null;

	const Item = items.find(isProbable);

	if (!Item) return draw(options, creature);

	return new Item(options);
};

module.exports = draw;
