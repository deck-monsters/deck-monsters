/* eslint-disable max-len */

const BaseCard = require('./base');
const { roll, max } = require('../helpers/chance');

class HitCard extends BaseCard {
	constructor (options) {
		// Set defaults for these values that can be overridden by the options passed in
		const defaultOptions = {
			attackDice: '1d20',
			damageDice: '1d6',
			icon: '🗡'
		};

		super(Object.assign(defaultOptions, options));
	}

	get attackDice () {
		return this.options.attackDice;
	}

	get damageDice () {
		return this.options.damageDice;
	}

	get stats () {
		return `Hit: ${this.attackDice} vs AC / Damage: ${this.damageDice}`;
	}

	hitCheck (player, target) {
		const attackRoll = roll({ primaryDice: this.attackDice, modifier: player.attackModifier, bonusDice: player.bonusAttackDice });

		this.emit('rolling', {
			reason: `vs AC (${target.ac}) to determine if the hit was a success`,
			card: this,
			roll: attackRoll,
			player,
			target
		});

		const { success, strokeOfLuck, curseOfLoki } = this.isSuccessful(attackRoll, target.ac);
		let commentary;

		if (strokeOfLuck) {
			commentary = `${player.givenName} rolled a natural 20. Automatic double max damage.`;
		} else if (curseOfLoki) {
			commentary = `${player.givenName} rolled a 1. Even if ${player.pronouns[0]} would have otherwise hit, ${player.pronouns[0]} misses.`;
		}

		this.emit('rolled', {
			reason: `vs AC (${target.ac})`,
			card: this,
			roll: attackRoll,
			player,
			target,
			outcome: success ? commentary || 'Hit!' : commentary || 'Miss...'
		});

		return {
			attackRoll,
			success,
			strokeOfLuck,
			curseOfLoki
		};
	}

	rollForDamage (player, target, strokeOfLuck) {
		const damageRoll = roll({ primaryDice: this.damageDice, modifier: player.damageModifier, bonusDice: player.bonusDamageDice });

		this.emit('rolling', {
			reason: 'for damage',
			card: this,
			roll: damageRoll,
			player,
			target,
			outcome: ''
		});

		if (strokeOfLuck) {
			// change the natural roll into a max roll
			damageRoll.naturalRoll.result = max(this.damageDice);
			damageRoll.result = max(this.damageDice) * 2;
		}

		if (damageRoll.result === 0) {
			damageRoll.result = 1;
		}

		this.emit('rolled', {
			reason: 'for damage',
			card: this,
			roll: damageRoll,
			player,
			target,
			outcome: ''
		});

		return damageRoll;
	}

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			// Add any player modifiers and roll the dice
			const { attackRoll, success, strokeOfLuck, curseOfLoki } = this.hitCheck(player, target);// eslint-disable-line no-unused-vars

			ring.channelManager.sendMessages()
				.then(() => {
					if (success) {
						const damageRoll = this.rollForDamage(player, target, strokeOfLuck);

						// If we hit then do some damage
						resolve(target.hit(damageRoll.result, player));
					} else {
						this.emit('miss', {
							attackResult: attackRoll.result,
							attackRoll,
							player,
							target
						});

						resolve(true);
					}
				});
		});
	}
}

HitCard.cardType = 'Hit';
HitCard.probability = 80;
HitCard.description = 'A basic attack, the staple of all good monsters.';
HitCard.cost = 4;
HitCard.level = 1;

module.exports = HitCard;
