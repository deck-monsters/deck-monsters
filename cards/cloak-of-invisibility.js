/* eslint-disable max-len */
const sample = require('lodash.sample');

const BaseCard = require('./base');
const { roll } = require('../helpers/chance');

const { BARD, CLERIC, WIZARD } = require('../helpers/classes');
const { ATTACK_PHASE, DEFENSE_PHASE } = require('../helpers/phases');
const { capitalize } = require('../helpers/capitalize');
const { AOE, HIDE, PSYCHIC } = require('./helpers/constants');
const { RARE } = require('../helpers/probabilities');
const { PRICEY } = require('../helpers/costs');

const EFFECT_TYPE = 'InvisibilityEffect';

const isInvisible = monster => !!monster.encounterEffects.find(encounterEffect => encounterEffect.effectType === EFFECT_TYPE);

class CloakOfInvisibilityCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '☁️'
	} = {}) {
		super({ icon });
	}

	get stats () { // eslint-disable-line class-methods-use-this
		return `You are invisible until you play a card that targets another player, or for the next 2 cards you play (whichever comes first).
1d20 vs your int for opponent to see you on their turn (natural 20 removes your cloak).`;
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
			phase,
			player: effectPlayer
		}) => {
			const { effect, cardClass } = card;

			// Always increase the count of invisible turns
			if (phase === ATTACK_PHASE && effectPlayer === invisibilityTarget) {
				invisibilityTarget.encounterModifiers.invisibilityTurns += 1;
			}

			if (effect) {
				card.effect = (player, target, ring, activeContestants) => {
					if (phase === DEFENSE_PHASE &&
						player !== invisibilityTarget && target === invisibilityTarget &&
						!cardClass.includes(AOE) &&
						!cardClass.includes(PSYCHIC)) {
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
						const { success, strokeOfLuck, curseOfLoki, tie } = this.checkSuccess(savingThrow, invisibilityTarget.int);
						let outcome;

						if (strokeOfLuck) {
							invisibilityTarget.encounterEffects = invisibilityTarget.encounterEffects.filter(encounterEffect => encounterEffect.effectType !== EFFECT_TYPE);

							outcome = `${player.givenName} rolled a natural 20. ${capitalize(player.pronouns.he)} immediately realizes exactly where ${invisibilityTarget.givenName} is and strips off ${invisibilityTarget.pronouns.his} ${this.cardType.toLowerCase()}.`;
						} else if (curseOfLoki) {
							outcome = `${player.givenName} rolled a 1. While stumbling about looking for ${invisibilityTarget.givenName} ${player.pronouns.he} trips and hits ${player.pronouns.him}self instead.`;
						} else if (tie) {
							outcome = `${player.givenName} almost catches a glimpse of ${invisibilityTarget.givenName} but when ${player.pronouns.he} blinks ${invisibilityTarget.givenName} is gone.`;
						} else if (success) {
							outcome = `Success. ${player.givenName} catches a glimpse of ${invisibilityTarget.givenName} and attacks.`;
						} else {
							outcome = `Fail. ${invisibilityTarget.givenName} remains ${this.icon} hidden from ${player.givenName}.`;
						}

						this.emit('rolled', {
							reason: `vs ${invisibilityTarget.givenName}'s int (${target.int}) to determine if ${player.pronouns.he} can find ${invisibilityTarget.pronouns.him}.`,
							card,
							roll: savingThrow,
							who: player,
							outcome,
							vs: target.int
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

CloakOfInvisibilityCard.cardClass = [HIDE];
CloakOfInvisibilityCard.cardType = 'Cloak of Invisibility';
CloakOfInvisibilityCard.permittedClassesAndTypes = [BARD, CLERIC, WIZARD];
CloakOfInvisibilityCard.probability = RARE.probability;
CloakOfInvisibilityCard.description = 'You don your cloak and disappear, if only for a while.';
CloakOfInvisibilityCard.level = 1;
CloakOfInvisibilityCard.cost = PRICEY.cost;
CloakOfInvisibilityCard.notForSale = true;

module.exports = CloakOfInvisibilityCard;
