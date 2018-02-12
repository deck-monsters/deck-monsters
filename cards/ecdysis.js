const BaseCard = require('./base');

const { BOOST } = require('./helpers/constants');
const { COMMON } = require('../helpers/probabilities');
const { BASILISK } = require('../helpers/creature-types');
const { REASONABLE } = require('../helpers/costs');

class EcdysisCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		boosts,
		icon = '📶',
		...rest
	} = {}) {
		super({ boosts, icon, ...rest });
	}

	get boosts () {
		return this.options.boosts;
	}

	get stats () {
		const boostStats = this.boosts.map(boost => `Boost: ${boost.prop} +${boost.amount}`);
		return boostStats.join('\r');
	}

	getTargets (player) { // eslint-disable-line class-methods-use-this
		return [player];
	}

	effect (player, target) {
		this.boosts.forEach(boost => target.setModifier(boost.prop, boost.amount));

		return !player.dead;
	}
}

EcdysisCard.cardClass = [BOOST];
EcdysisCard.cardType = 'Ecdysis';
EcdysisCard.permittedClassesAndTypes = [BASILISK];
EcdysisCard.description = 'Evolve into your more perfect form.';
EcdysisCard.level = 2;
EcdysisCard.cost = REASONABLE.cost;
EcdysisCard.probability = COMMON.probability;

EcdysisCard.defaults = {
	boosts: [
		{ prop: 'dex', amount: 1 },
		{ prop: 'str', amount: 1 }
	]
};

module.exports = EcdysisCard;
