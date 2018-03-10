/* eslint-disable max-len */

const BaseScroll = require('./base');

const { COMMON } = require('../../helpers/probabilities');
const { VERY_CHEAP } = require('../../helpers/costs');

class TargetingScroll extends BaseScroll {
	constructor ({
		icon = '🎯',
		targetingStrategy
	} = {}) {
		if (targetingStrategy && typeof targetingStrategy !== 'string') {
			throw new Error('Targeting strategies must be a string.');
		}

		super({ icon, targetingStrategy });

		if (this.name === TargetingScroll.name) {
			throw new Error('The TargetingScroll should not be instantiated directly!');
		}
	}

	get targetingStrategy () {
		return this.options.targetingStrategy || this.constructor.targetingStrategy;
	}

	getTargetingDetails () { // eslint-disable-line class-methods-use-this
		return undefined;
	}

	action ({ channel, channelName, monster }) {
		const { expired, targetingStrategy } = this;

		if (targetingStrategy) {
			monster.targetingStrategy = targetingStrategy;
		}

		let narration = `${monster.givenName} learns new tactics from a 📜 well-worn scroll entitled _${this.itemType}_.`;

		if (expired) {
			narration = `${narration} Just as ${monster.pronouns.he} finishes reading, the ancient paper on which it was written finally succumbs to time and decay and falls apart in ${monster.pronouns.his} hands.`;
		}

		const details = this.getTargetingDetails(monster);
		if (details) {
			narration = `${narration}

From now on ${details}`;
		}

		this.emit('narration', {
			environment: monster.environment,
			channel,
			channelName,
			narration
		});

		return true;
	}
}

TargetingScroll.itemType = 'Targeting Strategy';
TargetingScroll.probability = COMMON.probability;
TargetingScroll.numberOfUses = 3;
TargetingScroll.description = `Change your monster's targeting strategy up to ${TargetingScroll.numberOfUses} times.`;
TargetingScroll.level = 1;
TargetingScroll.cost = VERY_CHEAP.cost;

module.exports = TargetingScroll;
