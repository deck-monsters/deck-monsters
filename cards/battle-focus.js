/* eslint-disable max-len */

const BerserkCard = require('./berserk');
const { GLADIATOR } = require('../helpers/creature-types');

class BattleFocusCard extends BerserkCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damage,
		damageDice,
		icon = '🥋',
		...rest
	} = {}) {
		super({ icon, damage, damageDice, ...rest });
	}

	get stats () {
		return `Hit: ${this.attackDice} vs AC until you miss
${this.damageDice} damage on first hit.
${this.damageAmount} damage per hit after that.

Stroke of luck increases damage per hit by 1.`;
	}

	effect (player, target, ring) { // eslint-disable-line no-unused-vars
		return new Promise((resolve) => {
			// Add any player modifiers and roll the dice
			const {
				attackRoll, success, strokeOfLuck, curseOfLoki
			} = this.hitCheck(player, target);// eslint-disable-line no-unused-vars

			if (strokeOfLuck) {
				this.damageAmount = this.damageAmount + 1;
			}

			ring.channelManager.sendMessages()
				.then(() => {
					if (success) {
						// If we hit then do some damage
						const { result } = this.rollForDamage(player, target, strokeOfLuck)
						target.hit(result, player, this);

						// We have to make a new BerserkCard here because just calling super.effect will cause a
						// successfull hit to in turn call this.effect, which will result in hitting for 1d4 again
						const berserk = new BerserkCard({ damage: this.damageAmount });
						resolve(berserk.effect(player, target, ring));
					} else if (curseOfLoki) {
						this.resetDamageAmount();
						// Our attack is now bouncing back against us
						const { result } = this.rollForDamage(target, player)
						resolve(player.hit(result, target, this));
					} else {
						this.resetDamageAmount();
						this.emit('miss', {
							attackResult: attackRoll.result,
							attackRoll,
							player,
							target
						});

						resolve(!target.dead);
					}
				});
		});
	}
}

BattleFocusCard.cardType = 'Battle Focus';
BattleFocusCard.probability = 20;
BattleFocusCard.description = 'Years of training, drill after drill, kick in. An attack is not a single hit, but a series of strikes each leading to another. Time seems to disappear and for a brief moment you and your adversary become perfectly in sync as you lead in a dance of their destruction.';
BattleFocusCard.level = 0;
BattleFocusCard.permittedClassesAndTypes = [GLADIATOR];
BattleFocusCard.defaults = {
	...BerserkCard.defaults,
	damageDice: '1d4'
};


module.exports = BattleFocusCard;
