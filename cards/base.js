const Promise = require('bluebird');

const BaseItem = require('../items/base');

const { ATTACK_PHASE, DEFENSE_PHASE, GLOBAL_PHASE } = require('../constants/phases');

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

	get new () {
		if (this.original) {
			return this.original.new;
		}

		return this.newCard;
	}

	set new (newCard) {
		if (this.original) {
			this.original.new = newCard;
		}

		this.newCard = newCard;
	}

	get cardClass () {
		return this.options.cardClass || this.constructor.cardClass;
	}

	set cardClass (cardClass) {
		this.setOptions({
			cardClass
		});
	}

	isCardClass (cardClass) {
		return this.cardClass && this.cardClass.includes(cardClass);
	}

	applyEffects (player, proposedTarget, ring, activeContestants) {
		// Now we're going to run through all of the possible effects
		// Each effect should either return a card (which will replace the card that was going to be played)
		// or do something in the background and then return nothing (in which case we'll keep the card we had)

		// Let's clone the card before we get started on this - that way any modifications won't be saved
		let card = this.clone();

		// First, run through the effects from the contestants
		if (activeContestants) {
			card = activeContestants.reduce((contestantCard, contestant) =>
				contestant.monster.encounterEffects.reduce((effectCard, effect) => {
					const modifiedCard = effect({
						activeContestants,
						card: effectCard,
						phase: contestant.monster === player ? ATTACK_PHASE : DEFENSE_PHASE,
						player,
						ring,
						proposedTarget
					});

					return modifiedCard || effectCard;
				}, contestantCard), card);
		}

		// Then, run through any global effects
		if (ring && ring.encounterEffects) {
			card = ring.encounterEffects.reduce((currentCard, effect) => {
				const modifiedCard = effect({
					activeContestants,
					card: currentCard,
					phase: GLOBAL_PHASE,
					player,
					ring,
					proposedTarget
				});

				return modifiedCard || currentCard;
			}, card);
		}

		this.new = card;

		return card;
	}

	checkSuccess (roll, targetNumber) { // eslint-disable-line class-methods-use-this
		const success = !roll.curseOfLoki && (roll.strokeOfLuck || targetNumber < roll.result);

		const tie = targetNumber === roll.result;

		return { success, strokeOfLuck: roll.strokeOfLuck, curseOfLoki: roll.curseOfLoki, tie };
	}

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this, no-unused-vars
		return [proposedTarget];
	}

	play (player, proposedTarget, ring, activeContestants, shouldApplyEffects = true) {
		if (shouldApplyEffects) {
			const card = this.applyEffects(player, proposedTarget, ring, activeContestants);
			return card.play(player, proposedTarget, ring, activeContestants, false);
		}

		return Promise.resolve()
			.then(() => {
				this.emit('played', { player });

				const targets = this.getTargets(player, proposedTarget, ring, activeContestants);

				if (this.effect) {
					return Promise.resolve(ring)
						.then(({ channelManager } = {}) => channelManager && channelManager.sendMessages())
						.then(() => Promise.mapSeries(targets, target => this.effect(player, target, ring, activeContestants)))
						.then(results => results.reduce((result, val) => result && val, true));
				}

				return true;
			});
	}
}

BaseCard.eventPrefix = 'card';

module.exports = BaseCard;
