/* eslint-disable max-len */

const HitCard = require('./hit');

const { GLADIATOR, MINOTAUR, WEEPING_ANGEL } = require('../helpers/creature-types');
const { ATTACK_PHASE } = require('../helpers/phases');
const { roll } = require('../helpers/chance');
const { signedNumber } = require('../helpers/signed-number');

class ImmobilizeCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		dexModifier,
		strModifier,
		hitOnFail,
		doDamageOnImmobilize,
		icon = '😵',
		freedomThresholdModifier,
		ongoingDamage,
		strongAgainstCreatureTypes,
		weakAgainstCreatureTypes,
		uselessAgainstCreatureTypes,
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			dexModifier,
			strModifier,
			hitOnFail,
			doDamageOnImmobilize,
			freedomThresholdModifier,
			ongoingDamage,
			strongAgainstCreatureTypes,
			weakAgainstCreatureTypes,
			uselessAgainstCreatureTypes
		});
	}

	get actions () {
		return this.constructor.actions;
	}

	get doDamageOnImmobilize () {
		return this.options.doDamageOnImmobilize;
	}

	get ongoingDamage () {
		return this.options.ongoingDamage;
	}

	get hitOnFail () {
		return this.options.hitOnFail;
	}

	get strongAgainstCreatureTypes () {
		return this.options.strongAgainstCreatureTypes || this.constructor.strongAgainstCreatureTypes;
	}

	set strongAgainstCreatureTypes (strongAgainstCreatureTypes) {
		this.setOptions({
			strongAgainstCreatureTypes
		});
	}

	get weakAgainstCreatureTypes () {
		return this.options.weakAgainstCreatureTypes || this.constructor.weakAgainstCreatureTypes;
	}

	set weakAgainstCreatureTypes (weakAgainstCreatureTypes) {
		this.setOptions({
			weakAgainstCreatureTypes
		});
	}

	get uselessAgainstCreatureTypes () {
		return this.options.uselessAgainstCreatureTypes || this.constructor.uselessAgainstCreatureTypes;
	}

	set uselessAgainstCreatureTypes (uselessAgainstCreatureTypes) {
		this.setOptions({
			uselessAgainstCreatureTypes
		});
	}

	get dexModifier () {
		return this.options.dexModifier;
	}

	set dexModifier (dexModifier) {
		this.setOptions({
			dexModifier
		});
	}

	get strModifier () {
		return this.options.strModifier;
	}

	getAttackModifier (target) {
		if (this.weakAgainstCreatureTypes.includes(target.name)) {
			return -this.dexModifier;
		} else if (this.strongAgainstCreatureTypes.includes(target.name)) {
			return this.dexModifier;
		}
		return 0;
	}

	get stats () {
		let strModifiers = '\n';
		if (this.strongAgainstCreatureTypes.length && this.getAttackModifier({ name: this.strongAgainstCreatureTypes[0] })) {
			const strongAgainst = this.strongAgainstCreatureTypes.join(', ');
			strModifiers += `\n${signedNumber(this.getAttackModifier({ name: this.strongAgainstCreatureTypes[0] }))} against ${strongAgainst}`;
		}

		if (this.weakAgainstCreatureTypes.length && this.getAttackModifier({ name: this.weakAgainstCreatureTypes[0] })) {
			const weakAgainst = this.weakAgainstCreatureTypes.join(', ');
			strModifiers += `\n${signedNumber(this.getAttackModifier({ name: this.weakAgainstCreatureTypes[0] }))} against ${weakAgainst}`;
		}

		if (this.uselessAgainstCreatureTypes.length) {
			const uselessAgainst = this.uselessAgainstCreatureTypes.join(', ');
			strModifiers += `\ninneffective against ${uselessAgainst}`;
		}

		return `${super.stats}${strModifiers}`;
	}

	get freedomThresholdModifier () {
		return this.options.freedomThresholdModifier;
	}

	set freedomThresholdModifier (freedomThresholdModifier) {
		this.setOptions({
			freedomThresholdModifier
		});
	}

	getFreedomThresholdBase (player) { // eslint-disable-line class-methods-use-this
		return player.ac;
	}

	getFreedomThreshold (player, target) {
		let fatigue = 0;
		if (target.encounterModifiers && target.encounterModifiers.pinnedTurns) {
			fatigue = (target.encounterModifiers.pinnedTurns * 3);
		}

		return (this.getFreedomThresholdBase(player) + this.freedomThresholdModifier) - fatigue;
	}

	getAttackRoll (player, target) {
		return roll({ primaryDice: this.attackDice, modifier: player.dexModifier + this.getAttackModifier(target), bonusDice: player.bonusAttackDice, crit: true });
	}

	getTargetPropValue (target) { // eslint-disable-line class-methods-use-this
		return target.ac;
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars
		const attackRoll = this.getAttackRoll(player, target);
		const alreadyImmobilized = !!target.encounterEffects.find(effect => effect.effectType === 'ImmobilizeEffect');
		const canHaveEffect = !this.uselessAgainstCreatureTypes.includes(target.creatureType);

		if (!alreadyImmobilized && canHaveEffect) {
			const attackSuccess = this.checkSuccess(attackRoll, this.getTargetPropValue(target));

			this.emit('rolling', {
				reason: `to see if ${player.pronouns[0]} ${this.actions[1]} ${target.givenName}`,
				card: this,
				roll: attackRoll,
				player,
				target,
				outcome: '',
				vs: this.getTargetPropValue(target)
			});

			const failMessage = `${this.actions[0]} failed${this.hitOnFail ? ', chance to hit instead...' : ''}`;
			const outcome = attackSuccess.success ? `${this.actions[0]} succeeded!` : failMessage;

			this.emit('rolled', {
				reason: `for ${this.actions[0]}`,
				card: this,
				roll: attackRoll,
				player,
				target,
				outcome,
				vs: this.getTargetPropValue(target)
			});

			if (attackSuccess.success) {
				target.encounterModifiers = { pinnedTurns: 0 };

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
								outcome: success ? commentary || `Success! ${target.givenName} is freed.` : commentary || `${target.givenName} remains ${this.actions[2]} and will miss a turn.`,
								vs: this.getFreedomThreshold(player, target)
							});

							if (success) {
								target.encounterEffects = target.encounterEffects.filter(effect => effect.effectType !== 'ImmobilizeEffect');

								if (strokeOfLuck && target !== player) {
									player.hit(2, target, this);
								}
							} else {
								target.encounterModifiers = { pinnedTurns: target.encounterModifiers.pinnedTurns + 1 };
								if (this.ongoingDamage > 0) {
									this.emit('narration', {
										narration: `${target.givenName} takes ongoing damage from being ${this.actions[2]}`
									});
									target.hit(this.ongoingDamage, player, this);
								}

								card.play = () => Promise.resolve(true);
							}
						} else {
							target.encounterEffects = target.encounterEffects.filter(effect => effect.effectType !== 'ImmobilizeEffect');

							this.emit('narration', {
								narration: `${target.givenName} is no longer ${this.actions[2]}. ${target.pronouns[0]} pushes the limp dead body of ${player.givenName} off of ${target.pronouns[1]}self and proudly stands prepared to fight`
							});
						}
					}

					return card;
				};

				immobilizeEffect.effectType = 'ImmobilizeEffect';
				target.encounterEffects = [...target.encounterEffects, immobilizeEffect];

				if (this.doDamageOnImmobilize) {
					return super.effect(player, target, ring, activeContestants);
				}

				return true;
			} else if (this.hitOnFail) {
				return super.effect(player, target, ring, activeContestants);
			}
		} else if (alreadyImmobilized || !canHaveEffect) {
			let narration = '';
			if (alreadyImmobilized) {
				narration = `${target.givenName} is already ${this.actions[2]}, now _show no mercy_!`;
			} else {
				narration = `${target.givenName} laughs hautily as you try to ${this.actions[0]} them, vent your fury at their mockery!`;
			}
			this.emit('narration', { narration });

			return super.effect(player, target, ring, activeContestants);
		}

		this.emit('miss', {
			attackResult: attackRoll.result,
			attackRoll,
			player,
			target
		});

		return true;
	}
}

ImmobilizeCard.cardType = 'Immobilize';
ImmobilizeCard.actions = ['immobilize', 'immobilizes', 'immobilized'];
ImmobilizeCard.strongAgainstCreatureTypes = [GLADIATOR];// Very effective against these creatures
ImmobilizeCard.weakAgainstCreatureTypes = [MINOTAUR];// Less effective against (but will still hit) these creatures
ImmobilizeCard.uselessAgainstCreatureTypes = [WEEPING_ANGEL];// Immune to mobilization, will hit instead
ImmobilizeCard.probability = 0; // This card is never intended to be played on it's own, but I need access to parts of it for card progressions, so it needs to be instantiatable.
ImmobilizeCard.description = 'Immobilize your adversary.';
ImmobilizeCard.level = 1;
ImmobilizeCard.cost = 0;

ImmobilizeCard.defaults = {
	...HitCard.defaults,
	dexModifier: 2,
	strModifier: 0,
	hitOnFail: false,
	doDamageOnImmobilize: false,
	freedomThresholdModifier: 2,
	ongoingDamage: 0
};

ImmobilizeCard.flavors = {
	hits: [
		['stuns', 100]
	]
};

module.exports = ImmobilizeCard;
