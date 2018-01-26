const Promise = require('bluebird');

const BaseItem = require('../items/base');

class BaseCard extends BaseItem {
	constructor (options) {
		super(options);

		if (this.name === BaseCard.name) {
			throw new Error('The BaseCard should not be instantiated directly!');
		}
	}

	get itemType () {
		return this.constructor.cardType;
	}

	get cardType () {
		return this.itemType;
	}

	get isAreaOfEffect () {
		return !!this.constructor.isAreaOfEffect;
	}

	checkSuccess (roll, targetNumber) { // eslint-disable-line class-methods-use-this
		const success = !roll.curseOfLoki && (roll.strokeOfLuck || targetNumber < roll.result);

		const tie = targetNumber === roll.result;

		return { success, strokeOfLuck: roll.strokeOfLuck, curseOfLoki: roll.curseOfLoki, tie };
	}

	getTargets (player, proposedTarget, area, activeContestants) { // eslint-disable-line class-methods-use-this, no-unused-vars
		return [proposedTarget];
	}

	play (player, proposedTarget, area, activeContestants) {
		return Promise.resolve()
			.then(() => {
				this.emit('played', { player });

				const targets = this.getTargets(player, proposedTarget, area, activeContestants);

				if (this.effect) {
					return Promise.map(targets, target => this.effect(player, target, area, activeContestants))
						.then(results => results.reduce((result, val) => result && val, true));
				}

				return Promise.resolve(true);
			});
	}
}

BaseCard.eventPrefix = 'card';

module.exports = BaseCard;
