const Promise = require('bluebird');

const BaseCard = require('../../cards/base');

const { discoveryCard } = require('../../helpers/card');

class BaseDiscoveryCard extends BaseCard {
	constructor (options) {
		super(options);

		if (this.name === BaseDiscoveryCard.name) {
			throw new Error('The BaseDiscoveryCard Card should not be instantiated directly!');
		}
	}

	look (channel) {
		channel({
			announce: discoveryCard(this)
		});
	}

	play (environment, monster) {
		return this.effect(environment, monster);
	}
}

BaseDiscoveryCard.eventPrefix = 'discovery';

module.exports = BaseDiscoveryCard;
