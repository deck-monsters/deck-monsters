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

	play ({ channel, environment, explorer }) {
		return Promise.resolve(channel)
			.then(({ channelManager } = {}) => channelManager && channelManager.sendMessages())
			.then(() => {
				this.emit('found', {
					explorer,
					discovery: this
				});

				if (this.effect) {
					return this.effect(environment, explorer.monster);
				}
				return !explorer.monster.dead;
			});
		// .catch((err) => {
		// 	console.log('err', err.message); // some coding error in handling happened
		// });
	}
}

BaseDiscoveryCard.eventPrefix = 'discovery';

module.exports = BaseDiscoveryCard;
