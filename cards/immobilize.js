/* eslint-disable max-len */

const HitCard = require('./hit');

const { GLADIATOR, MINOTAUR, WEEPING_ANGEL } = require('../helpers/creature-types');
const { ATTACK_PHASE } = require('../helpers/phases');
const { roll } = require('../helpers/chance');
const { signedNumber } = require('../helpers/signed-number');
const { IMPOSSIBLE } = require('../helpers/probabilities');
const { FREE } = require('../helpers/costs');

class ImmobilizeCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		doDamageOnImmobilize,
		icon = '😵',
		freedomSavingThrowTargetAttr,
		freedomThresholdModifier,
		ongoingDamage,
		strongAgainstCreatureTypes,
		targetProp,
		uselessAgainstCreatureTypes,
		weakAgainstCreatureTypes,
		...rest
	} = {}) {
		super({ icon, targetProp, ...rest });

		this.setOptions({
			doDamageOnImmobilize,
			freedomSavingThrowTargetAttr,
			freedomThresholdModifier,
			ongoingDamage,
			strongAgainstCreatureTypes,
			targetProp,
			uselessAgainstCreatureTypes,
			weakAgainstCreatureTypes
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

	get stats () {
		let strModifiers = '';
		let strongBonus = 0;
		let weakBonus = 0;

		if (this.strongAgainstCreatureTypes.length && this.getAttackModifier({ creatureType: this.strongAgainstCreatureTypes[0] })) {
			const strongAgainst = this.strongAgainstCreatureTypes.join(', ');
			strongBonus = signedNumber(this.getAttackModifier({ creatureType: this.strongAgainstCreatureTypes[0] }));
			strModifiers += `${strongBonus} ${strongBonus < 0 ? 'dis' : ''}advantage vs ${strongAgainst}\n`;
		}

		if (this.weakAgainstCreatureTypes.length && this.getAttackModifier({ creatureType: this.weakAgainstCreatureTypes[0] })) {
			const weakAgainst = this.weakAgainstCreatureTypes.join(', ');
			weakBonus = signedNumber(this.getAttackModifier({ creatureType: this.weakAgainstCreatureTypes[0] }));
			strModifiers += `${weakBonus} ${weakBonus < 0 ? 'dis' : ''}advantage vs ${weakAgainst}\n`;
		}

		if (this.uselessAgainstCreatureTypes.length) {
			const uselessAgainst = this.uselessAgainstCreatureTypes.join(', ');
			strModifiers += `inneffective against ${uselessAgainst}\n`;
		}

		const ongoingDamageText = this.ongoingDamage ? `
-${this.ongoingDamage} hp each turn immobilized.` : '';

		let advantageModifier = '+ advantage';
		if (strongBonus < 0 && weakBonus < 0) {
			advantageModifier = '- disadvantage';
		} else if (strongBonus >= 0 && weakBonus < 0) {
			advantageModifier = '+/- advantage/disadvantage';
		}

		return `If already immobilized, hit instead.
${super.stats}
${strModifiers}
Opponent breaks free by rolling 1d20 vs immobilizer's ${this.freedomSavingThrowTargetAttr.toUpperCase()} ${advantageModifier} - (turns immobilized * 3)
Hits immobilizer back on stroke of luck.
Turns immobilized resets on curse of loki.
${ongoingDamageText}`;
	}

	get freedomThresholdModifier () {
		return this.options.freedomThresholdModifier;
	}

	set freedomThresholdModifier (freedomThresholdModifier) {
		this.setOptions({
			freedomThresholdModifier
		});
	}

	get freedomSavingThrowTargetAttr () { // eslint-disable-line class-methods-use-this
		return this.options.freedomSavingThrowTargetAttr;
	}

	set freedomSavingThrowTargetAttr (freedomSavingThrowTargetAttr) {
		this.setOptions({
			freedomSavingThrowTargetAttr
		});
	}

	getFreedomThresholdBase (player) { // eslint-disable-line class-methods-use-this
		return player[this.freedomSavingThrowTargetAttr];
	}

	getFreedomThreshold (player, target) {
		let fatigue = 0;
		if (target.encounterModifiers && target.encounterModifiers.immobilizedTurns) {
			fatigue = (target.encounterModifiers.immobilizedTurns * 3);
		}

		return Math.max((this.getFreedomThresholdBase(player) + this.getAttackModifier(target)) - fatigue, 1);
	}

	getAttackModifier (target) {
		if (this.weakAgainstCreatureTypes.includes(target.creatureType)) {
			return -this.freedomThresholdModifier;
		} else if (this.strongAgainstCreatureTypes.includes(target.creatureType)) {
			return this.freedomThresholdModifier;
		}
		return 0;
	}

	getAttackRoll (player, target) {
		const statsBonus = this.targetProp === 'ac' ? player.dexModifier : player[`${this.targetProp}Modifier`];
		return roll({ primaryDice: this.attackDice, modifier: statsBonus + this.getAttackModifier(target), bonusDice: player.bonusAttackDice, crit: true });
	}

	getImmobilizeRoll (immobilizer, immobilized) {
		const statsBonus = this.freedomSavingThrowTargetAttr === 'ac' ? immobilizer.dexModifier : immobilizer[`${this.freedomSavingThrowTargetAttr}Modifier`];
		return roll({ primaryDice: this.attackDice, modifier: statsBonus + this.getAttackModifier(immobilized), bonusDice: immobilizer.bonusAttackDice, crit: true });
	}

	getFreedomRoll (immobilizer, immobilized) {
		const statsBonus = this.freedomSavingThrowTargetAttr === 'ac' ? immobilized.dexModifier : immobilized[`${this.freedomSavingThrowTargetAttr}Modifier`];
		return roll({ primaryDice: this.attackDice, modifier: statsBonus - this.getAttackModifier(immobilized), bonusDice: immobilized.bonusAttackDice, crit: true });
	}

	// Most of the time this should be an auto-success since they get a chance to break free on their next turn
	immobilizeCheck (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars, class-methods-use-this
		return true;
	}

	getImmobilizeEffect (player, target, ring) {
		const immobilize = this;
		const ImmobilizeEffect = ({ card, phase }) => {
			if (phase === ATTACK_PHASE) {
				if (!player.dead) {
					this.emit('effect', {
						effectResult: `${this.icon} ${this.actions.IMMOBILIZED} by`,
						player,
						target,
						ring
					});

					const freedomRoll = immobilize.getFreedomRoll(player, target);
					const { success, strokeOfLuck, curseOfLoki, tie } = this.checkSuccess(freedomRoll, this.getFreedomThreshold(player, target));
					let commentary;

					if (strokeOfLuck) {
						commentary = `${target.givenName} rolled a natural 20 and violently breaks free from ${player.givenName}.`;
					} else if (curseOfLoki) {
						target.encounterModifiers.immobilizedTurns = 0;
						commentary = `${target.givenName} rolled a natural 1. ${player.givenName} improves ${player.pronouns.his} cruel hold on ${target.pronouns.him}`;
					} else if (tie) {
						commentary = 'Miss... Tie goes to the defender.';
					}

					this.emit('rolled', {
						reason: `and needs ${this.getFreedomThreshold(player, target) + 1} or higher to break free.`,
						card: this,
						roll: freedomRoll,
						who: target,
						outcome: success ? commentary || `Success! ${target.givenName} is freed.` : commentary || `${target.givenName} remains ${this.actions.IMMOBILIZED} and will miss a turn.`,
						vs: this.getFreedomThreshold(player, target)
					});

					if (success) {
						target.encounterEffects = target.encounterEffects.filter(effect => effect.effectType !== 'ImmobilizeEffect');

						if (strokeOfLuck && target !== player) {
							player.hit(2, target, this);
						}
					} else {
						target.encounterModifiers.immobilizedTurns = (target.encounterModifiers.immobilizedTurns || 0) + 1;
						if (this.ongoingDamage > 0) {
							this.emit('narration', {
								narration: `${target.givenName} takes ongoing damage from being ${this.actions.IMMOBILIZED}`
							});
							target.hit(this.ongoingDamage, player, this);
						}

						card.play = () => Promise.resolve(true);
					}
				} else {
					target.encounterEffects = target.encounterEffects.filter(effect => effect.effectType !== 'ImmobilizeEffect');

					this.emit('narration', {
						narration: `${target.givenName} is no longer ${this.actions.IMMOBILIZED}. ${target.pronouns.he} pushes the limp dead body of ${player.givenName} off of ${target.pronouns.him}self and proudly stands prepared to fight`
					});
				}
			}

			return card;
		};

		return ImmobilizeEffect;
	}

	freedomThresholdNarrative (player, target) {
		const thresholdBonusText = this.getAttackModifier(target) ? `${signedNumber(this.getAttackModifier(target))}` : '';
		const playerName = player === target ? `${player.pronouns.his} own` : `${player.givenName}'s`;
		return `1d20 vs ${playerName} ${this.freedomSavingThrowTargetAttr.toUpperCase()}(${this.getFreedomThresholdBase(player)})${thresholdBonusText} -(immobilized turns x 3)`;
	}

	emitImmobilizeNarrative (player, target) {
		const targetName = player === target ? `${player.pronouns.him}self` : target.givenName;
		let immobilizeNarrative = `
${player.givenName} ${this.icon} ${this.actions.IMMOBILIZES} ${targetName}.
At the beginning of ${target.givenName}'s turn ${target.pronouns.he} will roll ${this.freedomThresholdNarrative(player, target)} to attempt to break free.`;
		if (this.ongoingDamage > 0) {
			immobilizeNarrative += `
${target.givenName} takes ${this.ongoingDamage} damage per turn ${target.pronouns.he} is ${this.actions.IMMOBILIZED}
`;
		}
		this.emit('narration', {
			narration: immobilizeNarrative
		});
	}

	effect (player, target, ring, activeContestants) {
		const alreadyImmobilized = !!target.encounterEffects.find(effect => effect.effectType === 'ImmobilizeEffect');
		const canHaveEffect = !this.uselessAgainstCreatureTypes.includes(target.creatureType);

		if (alreadyImmobilized || !canHaveEffect) {
			let narration = '';
			if (alreadyImmobilized) {
				narration = `${target.givenName} is already immobilized, now _show no mercy_!`;// Use immobilize here, because it could be the result of ANY immobilization, not just "coil" or whatever is checking right now.
			} else {
				narration = `${target.givenName} laughs hautily as you try to ${this.actions.IMMOBILIZE} them, vent your fury at their mockery!`;
			}
			this.emit('narration', { narration });

			return super.effect(player, target, ring, activeContestants);
		}

		const immobilizeSuccess = this.immobilizeCheck(player, target, ring, activeContestants);
		if (immobilizeSuccess) {
			this.emitImmobilizeNarrative(player, target);

			const immobilizeEffect = this.getImmobilizeEffect(player, target, ring, activeContestants);
			immobilizeEffect.effectType = 'ImmobilizeEffect';
			target.encounterEffects = [...target.encounterEffects, immobilizeEffect];
			target.encounterModifiers.immobilizedTurns = 0;

			if (this.doDamageOnImmobilize) {
				return super.effect(player, target, ring, activeContestants);
			}

			return !target.dead;
		}

		// immobilize failed
		return !target.dead;
	}
}

ImmobilizeCard.cardType = 'Immobilize';
ImmobilizeCard.actions = { IMMOBILIZE: 'immobilize', IMMOBILIZES: 'immobilizes', IMMOBILIZED: 'immobilized' };
ImmobilizeCard.strongAgainstCreatureTypes = [GLADIATOR];// Very effective against these creatures
ImmobilizeCard.weakAgainstCreatureTypes = [MINOTAUR];// Less effective against (but will still hit) these creatures
ImmobilizeCard.uselessAgainstCreatureTypes = [WEEPING_ANGEL];// Immune to mobilization, will hit instead
ImmobilizeCard.probability = IMPOSSIBLE.probability; // This card is never intended to be played on it's own, but I need access to parts of it for card progressions, so it needs to be instantiatable.
ImmobilizeCard.description = 'Immobilize your adversary.';
ImmobilizeCard.level = 1;
ImmobilizeCard.cost = FREE.cost;

ImmobilizeCard.defaults = {
	...HitCard.defaults,
	doDamageOnImmobilize: false,
	freedomSavingThrowTargetAttr: 'ac',
	freedomThresholdModifier: 2,
	ongoingDamage: 0,
	targetProp: 'dex'
};

ImmobilizeCard.flavors = {
	hits: [
		['stuns', 100]
	]
};

module.exports = ImmobilizeCard;
