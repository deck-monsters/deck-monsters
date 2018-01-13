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

	checkSuccess (roll, targetNumber) { // eslint-disable-line class-methods-use-this
		const success = !roll.curseOfLoki && (roll.strokeOfLuck || targetNumber < roll.result);

		const tie = targetNumber === roll.result;

		return { success, strokeOfLuck: roll.strokeOfLuck, curseOfLoki: roll.curseOfLoki, tie };
	}

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this, no-unused-vars
		return [proposedTarget];
	}

	play (player, proposedTarget, ring, activeContestants) {
		return Promise.resolve()
			.then(() => {
				this.emit('played', { player });

				const targets = this.getTargets(player, proposedTarget, ring, activeContestants);

				if (this.effect) {
					return Promise.map(targets, target => this.effect(player, target, ring, activeContestants))
						.then(results => results.reduce((result, val) => result && val, true));
				}

				return Promise.resolve(true);
			});
	}
}

BaseCard.eventPrefix = 'card';

module.exports = BaseCard;
