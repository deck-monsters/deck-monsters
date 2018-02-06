/* eslint-disable max-len */

const BaseCard = require('./base');

const { getFlavor } = require('../../helpers/flavor');

class NothingCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🤷‍'
	} = {}) {
		super({ icon });
	}

	get stats () {
		const { text: flavor } = getFlavor('nothing', this.flavors);
		return flavor;
	}

	effect (environment, player) { // eslint-disable-line class-methods-use-this
		return !player.dead;
	}
}

NothingCard.cardType = 'Nothing';
NothingCard.probability = 80;
NothingCard.description = 'Your monster finds...';

NothingCard.flavors = {
	nothing: [
		['absolutely nothing.', 80],
		['several very interesting looking bugs.', 70],
		['some neat looking rocks.', 70],
		['a lovely brook.', 70],
		['a beautiful idyllic view.', 70],
		['a distracting magnificent looking cloud.', 70],
		['the town they set out from. Oops.', 60],
		['some trash. Nothing useful.', 50],
		['a perfect blade of grass to use as one of those grass whistles', 50],
		['just the right stalk of hay to look really cool hanging it out of their mouth.', 50],
		['a rock that turns out to be too heavy to lift to look underneath and gives up.', 40],
		['a torn hit card. Useless.', 30],
		['a counterfeit enchanted faceswap card. Useless.', 30],
		['some burnt scraps of unwanted cards.', 30],
		['what turns out to be stagnant water. Gross.', 10],
		['an empty potion bottle. It has a crack in it. Useless.', 10],
		['two ant colonies fighting. And then after watching and rooting for different ants as they rip each other apart, finds a deep sense of irony.', 10],
		['you really do not want to know. Let\'s just pretend this was never discovered and move on.', 10],
		['something that smells a lot like --nope. No it just actually is, dung.', 5],
		['self awareness. It turns out to be very dismal and depressing.', 5],
		['the carcases of some dead dismissed monsters. Horrifying. Time to sit and reflect on the meaninglessness of existence as a monster used for the enjoyment of cruel masters.', 1]
	]
};

module.exports = NothingCard;
