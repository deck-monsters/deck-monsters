/* eslint-disable max-len */

const BaseScroll = require('./base');

class TargetingScroll extends BaseScroll {
	constructor ({
		customStrategy,
		icon = '🎯'
	} = {}) {
		if (customStrategy && typeof customStrategy !== 'function') {
			throw new Error('Custom targeting strategies must be functions.');
		}

		super({ customStrategy, icon });

		if (this.name === TargetingScroll.name) {
			throw new Error('The TargetingScroll should not be instantiated directly!');
		}
	}

	get targetingStrategy () {
		return this.options.customStrategy || this.constructor.targetingStrategy;
	}

	getTargetingDetails () { // eslint-disable-line class-methods-use-this
		return undefined;
	}

	action (character, monster) {
		const { targetingStrategy, used } = this;

		if (targetingStrategy) {
			monster.targetingStrategy = targetingStrategy;
		}

		this.emit('narration', {
			narration: `${monster.givenName} learns new tactics from an ancient scroll entitled _${this.itemType}_. Just as ${monster.pronouns.he} finishes reading, the ancient paper on which it was written finally succumbs to time and decay and falls apart in ${monster.pronouns.his} hands.`
		});

		const details = this.getTargetingDetails(monster);
		if (details) {
			this.emit('narration', {
				narration: `From now on ${details}`
			});
		}

		if (used >= 1) {
			character.removeItem(this);
		}
	}
}

TargetingScroll.itemType = 'Targeting Strategy';
TargetingScroll.probability = 60;
TargetingScroll.description = "Change your monster's targeting strategy.";
TargetingScroll.level = 1;
TargetingScroll.cost = 20;

module.exports = TargetingScroll;
