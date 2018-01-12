/* eslint-disable max-len */

const BaseCard = require('./base');
const { roll, max } = require('../helpers/chance');

class HitCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		attackDice,
		damageDice,
		targetProp,
		icon = '👊'
	} = {}) {
		super({ targetProp, attackDice, damageDice, icon });
	}

	get attackDice () {
		return this.options.attackDice;
	}

	get damageDice () {
		return this.options.damageDice;
	}

	get targetProp () {
		return this.options.targetProp;
	}

	get stats () {
		return `Hit: ${this.attackDice} vs ${this.targetProp.toUpperCase()} / Damage: ${this.damageDice}`;
	}

	getAttackRoll (player) {
		return roll({ primaryDice: this.attackDice, modifier: player.dexModifier, bonusDice: player.bonusAttackDice });
	}

	hitCheck (player, target) {
		const attackRoll = this.getAttackRoll(player, target);

		this.emit('rolling', {
			reason: `vs ${target.identity}'s ${this.targetProp.toUpperCase()} (${target[this.targetProp]}) to determine if the hit was a success`,
			card: this,
			roll: attackRoll,
			player,
			target,
			vs: target[this.targetProp]
		});

		const { success, strokeOfLuck, curseOfLoki, tie } = this.checkSuccess(attackRoll, target[this.targetProp]);
		let commentary;

		if (strokeOfLuck) {
			commentary = `${player.givenName} rolled a natural 20. Automatic max damage.`;
		} else if (curseOfLoki) {
			commentary = `${player.givenName} rolled a 1. Unfortunately, while trying to attack, ${target.givenName} flings ${player.pronouns[2]} attack back against ${player.pronouns[1]}.`;
		} else if (tie) {
			commentary = 'Miss... Tie goes to the defender.'
		}

		this.emit('rolled', {
			reason: `vs ${target.identity}'s ${this.targetProp.toUpperCase()} (${target[this.targetProp]})`,
			card: this,
			roll: attackRoll,
			player,
			target,
			outcome: success ? commentary || 'Hit!' : commentary || 'Miss...',
			vs: target[this.targetProp]
		});

		return {
			attackRoll,
			success,
			strokeOfLuck,
			curseOfLoki
		};
	}

	getDamageRoll (player) {
		return roll({ primaryDice: this.damageDice, modifier: player.strModifier, bonusDice: player.bonusDamageDice });
	}

	rollForDamage (player, target, strokeOfLuck) {
		const damageRoll = this.getDamageRoll(player, target);

		if (strokeOfLuck) {
			// change the natural roll into a max roll
			damageRoll.naturalRoll.result = max(this.damageDice);
			damageRoll.result = max(this.damageDice) + damageRoll.modifier;
		} else {
			this.emit('rolling', {
				reason: `for damage against ${target.givenName}`,
				card: this,
				roll: damageRoll,
				player,
				target,
				outcome: ''
			});

			if (damageRoll.result < 1) {
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
		}

		return damageRoll;
	}

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		// Add any player modifiers and roll the dice
		const {
			attackRoll, success, strokeOfLuck, curseOfLoki // TODO: Is this curseOfLoki used elsewhere and we can simply drop it?
		} = this.hitCheck(player, target);// eslint-disable-line no-unused-vars

		return ring.channelManager.sendMessages()
			.then(() => {
				if (success) {
					const damageRoll = this.rollForDamage(player, target, strokeOfLuck);

					// If we hit then do some damage
					return target.hit(damageRoll.result, player, this);
				} else if (curseOfLoki) {
					const damageRoll = this.rollForDamage(target, player);

					// Our attack is now bouncing back against us
					return player.hit(damageRoll.result, target, this);
				}

				this.emit('miss', {
					attackResult: attackRoll.result,
					attackRoll,
					player,
					target
				});

				return true;
			});
	}
}

HitCard.cardType = 'Hit';
HitCard.probability = 90;
HitCard.description = 'A basic attack, the staple of all good monsters.';
HitCard.level = 0;
HitCard.cost = 3;

HitCard.defaults = {
	attackDice: '1d20',
	damageDice: '1d6',
	targetProp: 'ac'
};

module.exports = HitCard;
