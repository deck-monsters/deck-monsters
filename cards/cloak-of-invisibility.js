/* eslint-disable max-len */
const sample = require('lodash.sample');

const BaseCard = require('./base');
const { roll } = require('../helpers/chance');

const { BARD, CLERIC, WIZARD } = require('../helpers/classes');
const { ATTACK_PHASE, DEFENSE_PHASE } = require('../helpers/phases');
const { capitalize } = require('../helpers/capitalize');

const EFFECT_TYPE = 'InvisibilityEffect';

const isInvisible = monster => !!monster.encounterEffects.find(encounterEffect => encounterEffect.effectType === EFFECT_TYPE);

class CloakOfInvisibilityCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '☁️'
	} = {}) {
		super({ icon });
	}

	getTargets (player) { // eslint-disable-line class-methods-use-this
		return [player];
	}

	getSavingThrow (player) { // eslint-disable-line class-methods-use-this
		return roll({ primaryDice: '1d20', modifier: player.intModifier, crit: true });
	}

	effect (invisibilityPlayer, invisibilityTarget) { // eslint-disable-line no-unused-vars
		invisibilityTarget.encounterModifiers.invisibilityTurns = 0;

		const invisibilityEffect = ({
			card,
			phase
		}) => {
			const { effect } = card;

			if (effect) {
				card.effect = (player, target, ring, activeContestants) => {
					if (phase === DEFENSE_PHASE && player !== invisibilityTarget && target === invisibilityTarget) {
						const potentialTargets = activeContestants.filter(({ monster }) => (monster !== player && !isInvisible(monster)));

						if (potentialTargets.length > 0) {
							const newTarget = sample(potentialTargets).monster;

							this.emit('narration', {
								narration: `${player.givenName} doesn't see ${invisibilityTarget.givenName} anywhere and turns ${player.pronouns.his} attention to ${newTarget.givenName} instead.`
							});

							return effect.call(card, player, newTarget, ring, activeContestants);
						}

						this.emit('effect', {
							effectResult: `${this.icon} hidden from`,
							player,
							target: invisibilityTarget,
							ring
						});

						const savingThrow = this.getSavingThrow(player);
						const { success, strokeOfLuck, curseOfLoki, tie } = this.checkSuccess(savingThrow, invisibilityTarget.ac);
						let outcome;

						if (strokeOfLuck) {
							invisibilityTarget.encounterEffects = invisibilityTarget.encounterEffects.filter(encounterEffect => encounterEffect.effectType !== EFFECT_TYPE);

							outcome = `${player.givenName} rolled a natural 20. ${capitalize(player.pronouns.he)} immediately realizes exactly where ${invisibilityTarget.givenName} is and strips off ${invisibilityTarget.pronouns.his} ${this.cardType.toLowerCase()}.`;
						} else if (curseOfLoki) {
							outcome = `${player.givenName} rolled a 1. While stumbling about looking for ${invisibilityTarget.givenName} ${player.pronouns.he} trips and hits himself instead.`;
						} else if (tie) {
							outcome = `${player.givenName} almost catches a glimpse of ${invisibilityTarget.givenName} but when ${player.pronouns.he} blinks ${invisibilityTarget.givenName} is gone.`;
						} else if (success) {
							outcome = `Success. ${player.givenName} catches a glimpse of ${invisibilityTarget.givenName} and attacks.`;
						} else {
							outcome = `Fail. ${invisibilityTarget.givenName} remains ${this.icon} hidden from ${player.givenName}.`;
						}

						this.emit('rolled', {
							reason: `vs ${invisibilityTarget.givenName}'s ac (${target.ac}) to determine if ${player.pronouns.he} can find ${invisibilityTarget.pronouns.him}.`,
							card,
							roll: savingThrow,
							player,
							target: invisibilityTarget,
							outcome,
							vs: target.ac
						});

						if (curseOfLoki) {
							return effect.call(card, player, player, ring, activeContestants);
						} else if (!success) {
							return true;
						}
					} else if (phase === ATTACK_PHASE && player === invisibilityTarget) {
						if (target !== invisibilityTarget || invisibilityTarget.encounterModifiers.invisibilityTurns > 2) {
							invisibilityTarget.encounterEffects = invisibilityTarget.encounterEffects.filter(encounterEffect => encounterEffect.effectType !== EFFECT_TYPE);

							if (!card.invisibilityNarrationEmitted) {
								this.emit('narration', {
									narration: `${invisibilityTarget.identity} slips off ${invisibilityTarget.pronouns.his} ${this.cardType.toLowerCase()}.`
								});

								card.invisibilityNarrationEmitted = true;
							}
						} else {
							invisibilityTarget.encounterModifiers.invisibilityTurns += 1;
						}
					}

					return effect.call(card, player, target, ring, activeContestants);
				};
			}

			return card;
		};

		invisibilityEffect.effectType = EFFECT_TYPE;

		const alreadyInvisible = isInvisible(invisibilityTarget);

		if (!alreadyInvisible) {
			invisibilityTarget.encounterEffects = [...invisibilityTarget.encounterEffects, invisibilityEffect];

			this.emit('narration', {
				narration: `${invisibilityTarget.identity} dons ${invisibilityTarget.pronouns.his} ${this.cardType.toLowerCase()}.`
			});
		} else {
			this.emit('narration', {
				narration: `${invisibilityTarget.identity} is already hidden.`
			});
		}

		return true;
	}
}

CloakOfInvisibilityCard.cardType = 'Cloak of Invisibility';
CloakOfInvisibilityCard.permittedClassesAndTypes = [BARD, CLERIC, WIZARD];
CloakOfInvisibilityCard.probability = 20;
CloakOfInvisibilityCard.description = 'You don your cloak and disappear, if only for a while.';
CloakOfInvisibilityCard.level = 1;
CloakOfInvisibilityCard.cost = 60;
CloakOfInvisibilityCard.notForSale = true;

module.exports = CloakOfInvisibilityCard;
