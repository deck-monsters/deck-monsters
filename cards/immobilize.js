/* eslint-disable max-len */

const HitCard = require('./hit');

const { GLADIATOR, MINOTAUR } = require('../helpers/creature-types');
const { DEFENSE_PHASE } = require('../helpers/phases');
const { roll } = require('../helpers/chance');

class ImmobilizeCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		attackModifier,
		damageModifier,
		hitOnFail,
		alwaysDoDamage,
		icon = '😵',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			attackModifier,
			damageModifier,
			hitOnFail,
			alwaysDoDamage
		});

		if (this.name === ImmobilizeCard.name) {
			throw new Error('The ImmobilizeCard should not be instantiated directly!');
		}
	}

	get alwaysDoDamage () {
		return this.options.alwaysDoDamage;
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

	getFreedomThreshold (player) { // eslint-disable-line class-methods-use-this
		return player.ac;
	}

	getAttackRoll (player, target) {
		return roll({ primaryDice: this.attackDice, modifier: player.attackModifier + this.getAttackModifier(target), bonusDice: player.bonusAttackDice });
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			const attackRoll = this.getAttackRoll(player, target);
			const alreadyImmobilized = !!target.encounterEffects.find(effect => effect.effectType === 'ImmobilizeEffect');
			const attackSuccess = this.checkSuccess(attackRoll, target.ac);

			if (!alreadyImmobilized) {
				this.emit('rolling', {
					reason: `to see if you ${this.action[0]} ${target.givenName}`,
					card: this,
					roll: attackRoll,
					player,
					target,
					outcome: ''
				});
			}

			if (!alreadyImmobilized && attackSuccess) {
				this.emit('rolled', {
					reason: `for ${this.action[0]}`,
					card: this,
					roll: attackRoll,
					player,
					target,
					outcome: `${this.action[0]} succeeded!`
				});

				const immobilizeEffect = ({
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
							commentary = `${target.givenName} rolled a natural 20 and violently breaks free from ${player.givenName}.`;
						}

						this.emit('rolled', {
							reason: `and needs higher than a ${this.getFreedomThreshold(player, target)} to be free`,
							card: this,
							roll: freedomRoll,
							player: target,
							target: player,
							outcome: success ? commentary || `Success! ${target.givenName} is freed.` : commentary || `${target.givenName} remains ${this.action[2]} and will miss a turn.`
						});

						if (success) {
							target.encounterEffects = target.encounterEffects.filter(effect => effect.effectType !== 'ImmobilizeEffect');

							if (strokeOfLuck) {
								player.hit(2, target, this);
							}
						} else {
							card.play = () => Promise.resolve(true);
						}
					}

					return card;
				};

				immobilizeEffect.effectType = 'ImmobilizeEffect';
				target.encounterEffects.push(immobilizeEffect);

				if (this.alwaysDoDamage) {
					return resolve(super.effect(player, target, ring, activeContestants));
				}

				return resolve(true);
			} else if (alreadyImmobilized || this.hitOnFail) {
				if (alreadyImmobilized) {
					this.emit('narration', {
						narration: `${target.givenName} is already ${this.action[2]}, attempting to hit`
					});
				} else {
					this.emit('rolled', {
						reason: `for ${this.action[0]}`,
						card: this,
						roll: attackRoll,
						player,
						target,
						outcome: `${this.action[0]} failed, chance to hit instead...`
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

ImmobilizeCard.cardType = 'Immobilize';
ImmobilizeCard.strongAgainstCreatureTypes = [GLADIATOR];// Very effective against these creatures
ImmobilizeCard.weakAgainstCreatureTypes = [MINOTAUR];// Less effective against (but will still hit) these creatures
ImmobilizeCard.probability = 0;
ImmobilizeCard.description = 'Immobilize your adversary.';
ImmobilizeCard.cost = 6;
ImmobilizeCard.level = 1;
ImmobilizeCard.defaults = {
	...HitCard.defaults,
	attackModifier: 2,
	damageModifier: 0,
	hitOnFail: false,
	alwaysDoDamage: false
};
ImmobilizeCard.action = ['immobilize', 'immobilizes', 'immobilized'];

ImmobilizeCard.flavors = {
	hits: [
		['immobilizes', 100]
	]
};

module.exports = ImmobilizeCard;
