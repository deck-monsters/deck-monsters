/* eslint-disable max-len */

const BaseCard = require('./base');
const { getTarget, TARGET_RANDOM_PLAYER } = require('../helpers/targeting-strategies');
const { roll } = require('../helpers/chance');

const { BARD, CLERIC, WIZARD } = require('../helpers/classes');
const { ATTACK_PHASE, DEFENSE_PHASE } = require('../helpers/phases');

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

	getSavingThrow (player) {
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
					let finalTarget = target;

					const targetIsInvisible = !!target.encounterEffects.find(targetEffect => targetEffect.effectType === 'InvisibilityEffect');
					if (phase === DEFENSE_PHASE && player !== invisibilityTarget && targetIsInvisible) {
						this.emit('effect', {
							effectResult: `${this.icon} hidden from`,
							player,
							target: invisibilityTarget,
							ring
						});

						const savingThrow = this.getSavingThrow(player, invisibilityTarget);
						const { success, strokeOfLuck, curseOfLoki, tie } = this.checkSuccess(savingThrow, 200);// target.int);
						let commentary;

						if (strokeOfLuck) {
							invisibilityTarget.encounterModifiers.invisibilityTurns = 3;
							commentary = `${player.givenName} rolled a natural 20. ${player.pronouns.he} immediately realizes exactly where ${invisibilityTarget.givenName} is.`;
						} else if (curseOfLoki) {
							invisibilityTarget.encounterModifiers.invisibilityTurns = 0;
							commentary = `${player.givenName} rolled a 1. While looking for ${invisibilityTarget.givenName} ${player.pronouns.he} somehow turns ${player.pronouns.his} back to ${invisibilityTarget.pronouns.him}.`;
						} else if (tie) {
							commentary = 'Miss... Tie goes to the defender.';
						}

						this.emit('rolled', {
							reason: `vs ${invisibilityTarget.givenName}'s int (${target.int}) to determine if ${player.pronouns.he} can see ${player.pronouns.him}.`,
							card: this,
							roll: savingThrow,
							player,
							target: invisibilityTarget,
							outcome: success ? commentary || `Success. ${player.givenName} is able to see ${invisibilityTarget.givenName}` : commentary || `Fail. ${invisibilityTarget.givenName} is ${this.icon} still hidden from ${player.givenName}`,
							vs: target.int
						});

						if (!success) {
							invisibilityTarget.encounterModifiers.alreadyRetargeted = true;

							const playerContestant = activeContestants.filter(contestant => contestant.monster === player)[0];
							const notInvisibilityTarget = contestant => (contestant &&
									!contestant.monster.dead &&
									!contestant.monster.fled &&
									contestant.monster !== invisibilityTarget &&
									!contestant.monster.encounterEffects.find(targetEffect => targetEffect.effectType === 'InvisibilityEffect') &&
									contestant.monster !== player);
							const visibleOtherContestants = activeContestants.filter(notInvisibilityTarget);

							if (visibleOtherContestants.length <= 0 || activeContestants.length <= 2 || invisibilityTarget.encounterModifiers.alreadyRetargeted) {
								this.emit('narration', {
									narration: `All players are currently ${this.icon} hidden from ${player.givenName}`
								});

								invisibilityTarget.encounterModifiers.alreadyRetargeted = false;
								return Promise.resolve(true);
							}

							const finalTargetContestant = getTarget({ playerContestant, contestants: visibleOtherContestants, strategy: TARGET_RANDOM_PLAYER });

							finalTarget = finalTargetContestant.monster;

							this.emit('narration', {
								narration: `${player.givenName} seeks out a new target and finds a good candidate in ${finalTarget.givenName}`
							});
							card.effect = effect;
						}
					} else if (phase === ATTACK_PHASE && player === invisibilityTarget) {
						if (target !== invisibilityTarget || invisibilityTarget.encounterModifiers.invisibilityTurns > 2) {
							invisibilityTarget.encounterEffects = invisibilityTarget.encounterEffects.filter(encounterEffect => encounterEffect !== invisibilityEffect);

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

					return effect.call(card, player, finalTarget, ring, activeContestants);
				};
			}

			return card;
		};

		const alreadyInvisible = !!invisibilityTarget.encounterEffects.find(effect => effect.effectType === 'InvisibilityEffect');
		invisibilityEffect.effectType = 'InvisibilityEffect';
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
