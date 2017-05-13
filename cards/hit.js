/* eslint-disable max-len */

const BaseCard = require('./base');
const { roll, max, nat20 } = require('../helpers/chance');

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

	rollForAttack (player) {
		const attackRoll = roll({ primaryDice: this.attackDice, modifier: player.attackModifier, bonusDice: player.bonusAttackDice });

		return attackRoll;
	}

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			// Add any player modifiers and roll the dice
			const attackRoll = this.rollForAttack(player);
			const damageRoll = roll({ primaryDice: this.damageDice, modifier: player.damageModifier, bonusDice: player.bonusDamageDice });
			let strokeOfLuck = false;
			let curseOfLoki = false;
			let damageResult = damageRoll.result;
			let commentary;

			if (attackRoll.naturalRoll.result === max(this.attackDice)) {
				strokeOfLuck = true;
				// change the natural roll into a max roll
				damageRoll.naturalRoll.result = max(this.damageDice);
				damageResult = max(this.damageDice) * 2;
				damageRoll.result = damageResult;

				commentary = 'Nice roll! ';

				if (nat20(attackRoll)) {
					commentary = `${player.givenName} rolled a natural 20. `;
				}

				commentary += `Automatic double max damage. That's ${damageResult}!`;
			} else if (attackRoll.naturalRoll.result === 1) {
				curseOfLoki = true;

				commentary = `${player.givenName} rolled a 1. Even if ${player.pronouns[0]} would have otherwise hit, ${player.pronouns[0]} misses.`;
			}

			if (damageResult === 0) {
				damageResult = 1;
				damageRoll.result = 1;
			}

			// results vs AC
			const success = strokeOfLuck || (!curseOfLoki && target.ac < attackRoll.result);

			this.emit('rolling', {
				reason: `vs AC (${target.ac}) to determine if the hit was a success`,
				card: this,
				roll: attackRoll,
				strokeOfLuck,
				curseOfLoki,
				player,
				target
			});

			this.emit('rolled', {
				reason: `vs AC (${target.ac})`,
				card: this,
				roll: attackRoll,
				strokeOfLuck,
				curseOfLoki,
				player,
				target,
				outcome: success ? commentary || 'Hit!' : commentary || 'Miss...'
			});

			ring.channelManager.sendMessages()
				.then(() => {
					if (success) {
						this.emit('rolling', {
							reason: 'for damage',
							card: this,
							roll: damageRoll,
							player,
							target,
							outcome: ''
						});

						this.emit('rolled', {
							reason: 'for damage',
							card: this,
							roll: damageRoll,
							player,
							target,
							outcome: ''
						});

						// If we hit then do some damage
						resolve(target.hit(damageResult, player));
					} else {
						this.emit('miss', {
							attackResult: attackRoll.result,
							attackRoll,
							damageResult,
							damageRoll,
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

module.exports = HitCard;
