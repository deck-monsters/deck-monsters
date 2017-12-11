/* eslint-disable max-len */

const HitCard = require('./hit');

const { FIGHTER, BARBARIAN } = require('../helpers/classes');
const { GLADIATOR, MINOTAUR, BASILISK } = require('../helpers/creature-types');
const { DEFENSE_PHASE } = require('../helpers/phases');
const { roll } = require('../helpers/chance');

class ForkedStickCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		attackModifier,
		hitOnFail,
		icon = '⑂',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			attackModifier,
			hitOnFail
		});
	}

	get hitOnFail () {
		return this.options.hitOnFail;
	}

	get creatureType () {
		return this.constructor.creatureType;
	}

	get weakAgainstCreatureType () {
		return this.constructor.weakAgainstCreatureType;
	}

	get attackModifier () {
		return this.options.attackModifier;
	}

	getAttackModifier (target) {
		if (target.name === this.weakAgainstCreatureType) {
			return -this.attackModifier;
		} else if (this.creatureType.includes(target.name)) {
			return this.attackModifier;
		}
		return 0;
	}

	get stats () {
		return `${super.stats}
Chance to immobilize opponent by capturing their neck between prongs.

Small chance to do damage.`;
	}

	getFreedomThreshold (player) { // eslint-disable-line class-methods-use-this
		return player.ac;
	}

	getAttackRoll (player, target) {
		return roll({ primaryDice: this.attackDice, modifier: player.attackModifier + this.getAttackModifier(target), bonusDice: player.bonusAttackDice });
	}

	getDamageRoll (player, target) {
		if (this.getAttackRoll(player) > target.ac * 1.5) {
			return roll({ primaryDice: this.damageDice, modifier: player.damageModifier, bonusDice: player.bonusDamageDice });
		}

		return 0;
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			const attackRoll = this.getAttackRoll(player, target);
			const alreadyPinned = !!target.encounterEffects.find(effect => effect.effectType === 'PinEffect');
			const attackSuccess = this.checkSuccess(attackRoll, target.ac);

			if (!alreadyPinned) {
				this.emit('rolling', {
					reason: `to see if you pin ${target.givenName}`,
					card: this,
					roll: attackRoll,
					player,
					target,
					outcome: ''
				});
			}

			if (!alreadyPinned && attackSuccess) {
				this.emit('rolled', {
					reason: 'for pin',
					card: this,
					roll: attackRoll,
					player,
					target,
					outcome: 'Pin succeeded!'
				});

				const pinEffect = ({
					card,
					phase
				}) => {
					if (phase === DEFENSE_PHASE) {
						this.emit('effect', {
							effectName: `a ${this.icon}${this.cardType} effect`,
							player,
							target,
							ring
						});

						const freedomRoll = roll({ primaryDice: '1d20' });
						const { success, strokeOfLuck } = this.checkSuccess(freedomRoll, this.getFreedomThreshold(player, target));
						let commentary;

						if (strokeOfLuck) {
							commentary = `${target.givenName} rolled a natural 20 and flings the metal rod back at ${player.givenName}.`;
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
							target.encounterEffects = target.encounterEffects.filter(effect => effect.effectType !== 'PinEffect');

							if (strokeOfLuck) {
								player.hit(2, target, this);
							}
						} else {
							card.play = () => Promise.resolve(true);
						}
					}

					return card;
				};

				pinEffect.effectType = 'PinEffect';
				target.encounterEffects.push(pinEffect);

				return resolve(true);
			} else if (alreadyPinned || this.hitOnFail) {
				if (alreadyPinned) {
					this.emit('narration', {
						narration: `${target.givenName} is already pinned, attempting to hit`
					});
				} else {
					this.emit('rolled', {
						reason: 'for pin',
						card: this,
						roll: attackRoll,
						player,
						target,
						outcome: 'Pin failed, chance to hit instead...'
					});
				}

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

ForkedStickCard.cardType = 'Forked Stick';
ForkedStickCard.creatureType = [GLADIATOR, MINOTAUR, BASILISK];
ForkedStickCard.probability = 30;
ForkedStickCard.description = `A simple weapon fashioned for ${ForkedStickCard.creatureType}-hunting.`;
ForkedStickCard.cost = 6;
ForkedStickCard.level = 1;
ForkedStickCard.permittedClasses = [FIGHTER, BARBARIAN];
ForkedStickCard.weakAgainstCreatureType = MINOTAUR;
ForkedStickCard.defaults = {
	...HitCard.defaults,
	attackModifier: 2,
	hitOnFail: false
};

ForkedStickCard.flavors = {
	hits: [
		['pins head to the ground', 80],
		['pins neck to the wall', 50],
		['in a fit of brute strength, snags by the neck, and brutally lofts into the air, where they dangle like a toddler\'s booger', 5]
	]
};

module.exports = ForkedStickCard;
