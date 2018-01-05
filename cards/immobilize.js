/* eslint-disable max-len */

const HitCard = require('./hit');

const { GLADIATOR, MINOTAUR, WEEPING_ANGEL } = require('../helpers/creature-types');
const { ATTACK_PHASE } = require('../helpers/phases');
const { roll } = require('../helpers/chance');

class ImmobilizeCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		attackModifier,
		damageModifier,
		hitOnFail,
		doDamageOnImmobilize,
		icon = '😵',
		freedomThresholdModifier,
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			attackModifier,
			damageModifier,
			hitOnFail,
			doDamageOnImmobilize,
			freedomThresholdModifier
		});
	}

	get actions () {
		return this.constructor.actions;
	}

	get doDamageOnImmobilize () {
		return this.options.doDamageOnImmobilize;
	}

	get hitOnFail () {
		return this.options.hitOnFail;
	}

	get strongAgainstCreatureTypes () {
		return this.constructor.strongAgainstCreatureTypes;
	}

	get weakAgainstCreatureTypes () {
		return this.constructor.weakAgainstCreatureTypes;
	}

	get uselessAgainstCreatureTypes () {
		return this.constructor.uselessAgainstCreatureTypes;
	}

	get attackModifier () {
		return this.options.attackModifier;
	}

	get damageModifier () {
		return this.options.damageModifier;
	}

	getAttackModifier (target) {
		if (this.weakAgainstCreatureTypes.includes(target.name)) {
			return -this.attackModifier;
		} else if (this.strongAgainstCreatureTypes.includes(target.name)) {
			return this.attackModifier;
		}
		return 0;
	}

	get stats () {
		return `${super.stats}`;
	}

	get freedomThresholdModifier () {
		return this.options.freedomThresholdModifier;
	}

	getFreedomThreshold (player) {
		return Math.min(player.ac, 10) + this.freedomThresholdModifier;
	}

	getAttackRoll (player, target) {
		return roll({ primaryDice: this.attackDice, modifier: player.attackModifier + this.getAttackModifier(target), bonusDice: player.bonusAttackDice });
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			const attackRoll = this.getAttackRoll(player, target);
			const alreadyImmobilized = !!target.encounterEffects.find(effect => effect.effectType === 'ImmobilizeEffect');
			const canHaveEffect = !this.uselessAgainstCreatureTypes.includes(target.creatureType);

			if (!alreadyImmobilized && canHaveEffect) {
				const attackSuccess = this.checkSuccess(attackRoll, target.ac);

				this.emit('rolling', {
					reason: `to see if ${player.pronouns[0]} ${this.actions[1]} ${target.givenName}`,
					card: this,
					roll: attackRoll,
					player,
					target,
					outcome: ''
				});

				const failMessage = `${this.actions[0]} failed${this.hitOnFail ? ', chance to hit instead...':''}`;
				const outcome = attackSuccess.success ? `${this.actions[0]} succeeded!` : failMessage;

				this.emit('rolled', {
					reason: `for ${this.actions[0]}`,
					card: this,
					roll: attackRoll,
					player,
					target,
					outcome
				});

				if (attackSuccess.success) {
					const immobilizeEffect = ({
						card,
						phase
					}) => {
						if (phase === ATTACK_PHASE) {
							if (!player.dead) {
								this.emit('effect', {
									effectResult: `${this.icon}  ${this.actions[2]} by`,
									player,
									target,
									ring
								});

								const freedomRoll = super.getAttackRoll(player, target);
								const { success, strokeOfLuck } = this.checkSuccess(freedomRoll, this.getFreedomThreshold(player, target));
								let commentary;

								if (strokeOfLuck) {
									commentary = `${target.givenName} rolled a natural 20 and violently breaks free from ${player.givenName}.`;
								}

								this.emit('rolled', {
									reason: `and needs ${this.getFreedomThreshold(player, target) + 1} or higher to break free`,
									card: this,
									roll: freedomRoll,
									player: target,
									target: player,
									outcome: success ? commentary || `Success! ${target.givenName} is freed.` : commentary || `${target.givenName} remains ${this.actions[2]} and will miss a turn.`
								});

								if (success) {
									target.encounterEffects = target.encounterEffects.filter(effect => effect.effectType !== 'ImmobilizeEffect');

									if (strokeOfLuck && target !== player) {
										player.hit(2, target, this);
									}
								} else {
									card.play = () => Promise.resolve(true);
								}
							} else {
								target.encounterEffects = target.encounterEffects.filter(effect => effect.effectType !== 'ImmobilizeEffect');

								this.emit('narration', {
									narration: `${target.givenName} is now ${this.actions[2]}. ${target.pronouns[0]} pushes the limp dead body of ${player.givenName} off of ${target.pronouns[1]}self and proudly stands prepared to fight`
								});
							}
						}

						return card;
					};

					immobilizeEffect.effectType = 'ImmobilizeEffect';
					target.encounterEffects = [...target.encounterEffects, immobilizeEffect];

					if (this.doDamageOnImmobilize) {
						return resolve(super.effect(player, target, ring, activeContestants));
					}

					return resolve(true);
				} else if (this.hitOnFail) {
					return resolve(super.effect(player, target, ring, activeContestants));
				}
			} else if (alreadyImmobilized || !canHaveEffect) {
				let narration = '';
				if (alreadyImmobilized) {
					narration = `${target.givenName} is already ${this.actions[2]}, now _show no mercy_!`;
				} else {
					narration = `${target.givenName} laughs hautily as you try to ${this.actions[2]} them, vent your fury at their mockery!`;
				}
				this.emit('narration', { narration });

				return resolve(super.effect(player, target, ring, activeContestants));
			}

			this.emit('miss', {
				attackResult: attackRoll.result,
				attackRoll,
				player,
				target
			});

			return resolve(false);
		});
	}
}

ImmobilizeCard.cardType = 'Immobilize';
ImmobilizeCard.strongAgainstCreatureTypes = [GLADIATOR];// Very effective against these creatures
ImmobilizeCard.weakAgainstCreatureTypes = [MINOTAUR];// Less effective against (but will still hit) these creatures
ImmobilizeCard.uselessAgainstCreatureTypes = [WEEPING_ANGEL];// Immune to mobilization, will hit instead
ImmobilizeCard.probability = 0;// This card is never intended to be played on it's own, but I need access to parts of it for card progressions, so it needs to be instantiatable.
ImmobilizeCard.description = 'Immobilize your adversary.';
ImmobilizeCard.cost = 6;
ImmobilizeCard.level = 1;
ImmobilizeCard.defaults = {
	...HitCard.defaults,
	attackModifier: 2,
	damageModifier: 0,
	hitOnFail: false,
	doDamageOnImmobilize: false,
	freedomThresholdModifier: 2
};
ImmobilizeCard.actions = ['immobilize', 'immobilizes', 'immobilized'];

ImmobilizeCard.flavors = {
	hits: [
		['immobilizes', 100]
	]
};

module.exports = ImmobilizeCard;
