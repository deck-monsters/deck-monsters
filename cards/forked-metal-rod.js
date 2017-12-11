/* eslint-disable max-len */

const ForkedStickCard = require('./forked-stick');

const { roll } = require('../helpers/chance');
const { DEFENSE_PHASE } = require('../helpers/phases');

class ForkedMetalRodCard extends ForkedStickCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '⑂⑂',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	get stats () {
		return `${super.stats}
Will pin a ${this.creatureType} until they roll to break free`;
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars
		if (target.creatureType === this.creatureType) {
			const pinEffect = ({
				card,
				phase
			}) => {
				if (phase === DEFENSE_PHASE) {
					this.emit('effect', {
						effectName: `a forked metal rod ${this.icon} effect`,
						player,
						target,
						ring
					});

					const freedomRoll = roll({ primaryDice: '1d20' });
					const { success, strokeOfLuck } = this.checkSuccess(freedomRoll, 10);
					let commentary;

					if (strokeOfLuck) {
						commentary = `${target.givenName} rolled a natural 20 and fings the metal rod back at ${player.givenName}.`;
					}

					this.emit('rolled', {
						reason: 'and needs a 10 or higher to be free',
						card: this,
						roll: freedomRoll,
						player: target,
						target: player,
						outcome: success ? commentary || `Success! ${target.givenName} is freed.` : commentary || `${target.givenName} remains pinned and will miss a turn.`
					});

					if (success) {
						target.encounterEffects = target.encounterEffects.filter(effect => effect !== pinEffect);

						if (strokeOfLuck) {
							player.hit(2, target, this);
						}
					} else {
						card.play = () => Promise.resolve(true);
					}
				}

				return card;
			};

			target.encounterEffects = [...target.encounterEffects, pinEffect];
		}

		return super.effect(player, target, ring, activeContestants);
	}
}

ForkedMetalRodCard.cardType = 'Forked Metal Rod';
ForkedMetalRodCard.probability = 20;
ForkedMetalRodCard.description = `A dangerous weapon fashioned for ${ForkedMetalRodCard.creatureType}-hunting.`;
ForkedMetalRodCard.level = 2;

module.exports = ForkedMetalRodCard;
