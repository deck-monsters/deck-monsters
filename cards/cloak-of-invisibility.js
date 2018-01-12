/* eslint-disable max-len */

const BaseCard = require('./base');

const { CLERIC, WIZARD } = require('../helpers/classes');
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

	effect (invisibilityPlayer, invisibilityTarget) { // eslint-disable-line no-unused-vars
		invisibilityTarget.invisibilityTurns = 0;

		const invisibilityEffect = ({
			card,
			phase
		}) => {
			const { effect } = card;

			if (effect) {
				card.effect = (player, target, ring, activeContestants) => {
					if (phase === DEFENSE_PHASE && player !== invisibilityTarget && target === invisibilityTarget) {
						this.emit('effect', {
							effectResult: `${this.icon} hidden from`,
							player,
							target: invisibilityTarget,
							ring
						});

						return Promise.resolve(true);
					} else if (phase === ATTACK_PHASE && player === invisibilityTarget) {
						if (target !== invisibilityTarget || invisibilityTarget.invisibilityTurns >= 2) {
							invisibilityTarget.encounterEffects = invisibilityTarget.encounterEffects.filter(encounterEffect => encounterEffect !== invisibilityEffect);

							if (!card.invisibilityNarrationEmitted) {
								this.emit('narration', {
									narration: `${invisibilityTarget.identity} slips off ${invisibilityTarget.pronouns[2]} ${this.cardType.toLowerCase()}.`
								});

								card.invisibilityNarrationEmitted = true;
							}
						} else {
							invisibilityTarget.invisibilityTurns += 1;
						}
					}

					return effect.call(card, player, target, ring, activeContestants);
				};
			}

			return card;
		};

		invisibilityTarget.encounterEffects = [...invisibilityTarget.encounterEffects, invisibilityEffect];

		this.emit('narration', {
			narration: `${invisibilityTarget.identity} dons ${invisibilityTarget.pronouns[2]} ${this.cardType.toLowerCase()}.`
		});

		return true;
	}
}

CloakOfInvisibilityCard.cardType = 'Cloak of Invisibility';
CloakOfInvisibilityCard.permittedClassesAndTypes = [CLERIC, WIZARD];
CloakOfInvisibilityCard.probability = 20;
CloakOfInvisibilityCard.description = 'You don your cloak and disappear, if only for a while.';
CloakOfInvisibilityCard.level = 1;
CloakOfInvisibilityCard.cost = 60;

module.exports = CloakOfInvisibilityCard;
