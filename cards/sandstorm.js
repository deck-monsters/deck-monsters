/* eslint-disable max-len */
const sample = require('lodash.sample');

const BlastCard = require('./blast');

const { JINN } = require('../helpers/creature-types');
const { ATTACK_PHASE } = require('../helpers/phases');
const isProbable = require('../helpers/is-probable');

const EFFECT_TYPE = 'SandstormEffect';

class Sandstorm extends BlastCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		hitProbability,
		icon = '🌪',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			hitProbability
		});
	}

	get hitProbability () {
		return this.options.hitProbability;
	}

	get stats () {
		return `${this.damage} storm damage +${this.levelDamage} per level of the jinni to everyone in the ring. Temporarily confuses opponents and causes them to mistake their targets.`;
	}

	effect (sandstormPlayer, sandstormTarget) {
		const alreadyLost = !!sandstormTarget.encounterEffects.find(effect => effect.effectType === EFFECT_TYPE);

		if (alreadyLost) {
			this.emit('narration', {
				narration: `${sandstormTarget.givenName} is already lost and confused, so ${sandstormPlayer.givenName} takes advantage of ${sandstormTarget.pronouns.his} weakened state.`
			});

			return super.effect(sandstormPlayer, sandstormTarget) && super.effect(sandstormPlayer, sandstormTarget);
		}

		const sandstormEffect = ({
			card,
			phase,
			player: effectPlayer
		}) => {
			if (phase === ATTACK_PHASE && effectPlayer === sandstormTarget) {
				sandstormTarget.encounterEffects = sandstormTarget.encounterEffects.filter(encounterEffect => encounterEffect !== sandstormEffect);

				const { getTargets } = card;

				if (getTargets) {
					// Has no effect on sandstorm cards
					if (card.cardType === Sandstorm.cardType) {
						card.getTargets = (player, proposedTarget, ring, activeContestants) => {
							this.emit('narration', {
								narration: `${sandstormTarget.givenName} whips up an even bigger cloud of sand than ${sandstormPlayer.givenName} did.`
							});

							return getTargets.call(card, player, proposedTarget, ring, activeContestants);
						};

						return card;
					}

					card.getTargets = (player, proposedTarget, ring, activeContestants) => {
						this.emit('effect', {
							effectResult: `${this.icon} lost in a cloud of blinding sand kicked up by`,
							player: sandstormPlayer,
							target: sandstormTarget,
							ring
						});

						const oldTargets = getTargets.call(card, player, proposedTarget, ring, activeContestants);
						const newTargets = [];

						// Probably steal health cards
						if (oldTargets.length === 1 && oldTargets[0] === player && isProbable({ probability: 70 })) {
							newTargets.push(sandstormPlayer);
						}

						// Probably don't end up as the target of hit cards
						while (newTargets.length < oldTargets.length) {
							const { monster } = sample(activeContestants);
							if (monster !== sandstormPlayer || isProbable({ probability: this.hitProbability })) {
								newTargets.push(monster);
							}
						}

						return newTargets;
					};
				}
			}

			return card;
		};

		sandstormEffect.effectType = EFFECT_TYPE;

		sandstormTarget.encounterEffects = [...sandstormTarget.encounterEffects, sandstormEffect];

		return super.effect(sandstormPlayer, sandstormTarget);
	}
}

Sandstorm.cardType = 'Sandstorm';
Sandstorm.permittedClassesAndTypes = [JINN];
Sandstorm.probability = 5;
Sandstorm.description = 'A blinding cloud of sand whips across the desert, damaging and confusing all those caught in it.';
Sandstorm.level = 0;
Sandstorm.cost = 80;
Sandstorm.notForSale = true;

Sandstorm.defaults = {
	damage: 1,
	hitProbability: 30,
	levelDamage: 1
};

Sandstorm.flavors = {
	hits: [
		['chokes', 80],
		['whips sand in the eyes of', 70],
		['calls upon the desert gods to destroy', 70],
		['disintigrates', 50],
		['turns to dust and buries', 5]
	]
};

module.exports = Sandstorm;
