const Promise = require('bluebird');

const BaseClass = require('../baseClass');

const { actionCard } = require('../helpers/card');
const { max } = require('../helpers/chance');

class BaseCard extends BaseClass {
	constructor (options) {
		super(options);

		if (this.name === BaseCard.name) {
			throw new Error('The BaseCard should not be instantiated directly!');
		}
	}

	get cardType () {
		return this.constructor.cardType;
	}

	get description () {
		return this.constructor.description;
	}

	get icon () {
		return this.options.icon;
	}

	get cost () {
		return this.constructor.cost;
	}

	get level () {
		return this.constructor.level;
	}

	get permittedClassesAndTypes () {
		return this.constructor.permittedClassesAndTypes;
	}

	get probability () {
		return this.constructor.probability;
	}

	get flavors () {
		return this.constructor.flavors || this.options.flavors;
	}

	checkSuccess (roll, targetNumber) { // eslint-disable-line class-methods-use-this
		let strokeOfLuck = false;
		let curseOfLoki = false;

		// Stroke of Luck
		if (roll.naturalRoll.result === max(roll.primaryDice)) {
			strokeOfLuck = true;
		} else if (roll.naturalRoll.result === 1) {
			curseOfLoki = true;
		}

		const success = !curseOfLoki && (strokeOfLuck || targetNumber < roll.result);

		return { success, strokeOfLuck, curseOfLoki };
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

	look (channel) {
		return Promise
			.resolve()
			.then(() => channel({
				announce: actionCard(this)
			}));
	}
}

BaseCard.eventPrefix = 'card';

module.exports = BaseCard;
