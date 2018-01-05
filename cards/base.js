/* eslint-disable global-require, import/no-dynamic-require */

const BaseClass = require('../baseClass');

const { actionCard } = require('../helpers/card');
const { max } = require('../helpers/chance');

const randomOneOf = cards => cards[Math.floor(Math.random() * cards.length)];

// requires have to be done on the fly because otherwise will cause circular dependencies
const POP_MAP = {
	HitCard: () => require(randomOneOf(['./rehit', './hit-harder'])),
	HitHarderCard: () => require('./pound'),
	CoilCard: () => require('./constrict'),
	EnthrallCard: () => require('./entrance'),
	FleeCard: () => require('./fight-or-flight'),
	ForkedStickCard: () => require('./forked-metal-rod'),
	HealCard: () => require('./whiskey-shot'),
	MesmerizeCard: () => require('./enthrall'),
	BoostCard: () => require(randomOneOf(['./thick-skin', './basic-shield'])),
	WhiskeyShotCard: () => require('./scotch')
};

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

	pop (player) {
		const NewCardRequire = POP_MAP[this.name];
		if (!NewCardRequire) return;
		const NewCard = NewCardRequire();
		const newCard = new NewCard();

		player.cards[player.cards.findIndex(card => card.name === this.name)] = newCard;

		this.emit('narration', {
			narration: `${this.name} Card leveled up! ${this.name} Card is now ${newCard.name} Card.`
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

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this, no-unused-vars
		return [proposedTarget];
	}

	play (player, proposedTarget, ring, activeContestants) {
		this.emit('played', { player });

		const targets = this.getTargets(player, proposedTarget, ring, activeContestants);

		if (this.effect) {
			return Promise.all(targets.map(target => this.effect(player, target, ring, activeContestants)))
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
