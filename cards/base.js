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

	set flavors (flavors) {
		this.setOptions({
			flavors
		});
	}

	get flavor () {
		return this.constructor.flavor || this.options.flavor;
	}

	set flavor (flavor) {
		this.setOptions({
			flavor
		});
	}

	get flavorText () {
		return this.constructor.flavorText || this.options.flavorText;
	}

	set flavorText (flavorText) {
		this.setOptions({
			flavorText
		});
	}

	get icons () {
		return this.options.icons;
	}

	set icons(icons) {
		this.setOptions({
			icons
		});
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

	getTargets (player, proposedTarget, area, activeContestants) { // eslint-disable-line class-methods-use-this, no-unused-vars
		return [proposedTarget];
	}

	play (player, proposedTarget, area, activeContestants) {
		this.emit('played', { player });

		const targets = this.getTargets(player, proposedTarget, area, activeContestants);

		if (this.effect) {
			return Promise.all(targets.map(target => this.effect(player, target, area, activeContestants)))
				.then(results => results.reduce((result, val) => result && val, true));
		}

		return Promise.resolve(true);
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
