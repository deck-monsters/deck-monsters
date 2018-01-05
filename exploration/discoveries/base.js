const BaseCard = require('../../cards/base');

const { discoveryCard } = require('../helpers/card');

const { getFlavor } = require('../helpers/flavor');

class BaseDiscoveryCard extends BaseCard {
	constructor (options) {
		super(options);

		if (this.name === BaseDiscoveryCard.name) {
			throw new Error('The BaseDiscoveryCard Card should not be instantiated directly!');
		}
	}

	get flavor () {
		return getFlavor(this.name, this.flavors);
	}

	look (channel) {
		return Promise
			.resolve()
			.then(() => channel({
				announce: discoveryCard(this)
			}));
	}
}

BaseDiscoveryCard.eventPrefix = 'discovery';

module.exports = BaseDiscoveryCard;
