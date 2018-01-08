/* eslint-disable max-len */

const HitCard = require('./hit');
const { GLADIATOR } = require('../helpers/creature-types');

class BerserkCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damage,
		icon = '😤',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			damage
		});

		this.resetDamageAmount();
	}

	resetDamageAmount () {
		this.damageAmount = this.options.damage;
	}

	set damageAmount (amount) {
		this.damage = amount;
	}

	get damageAmount () {
		return this.damage;
	}

	get stats () {
		return `Hit: ${this.attackDice} vs AC until you miss
${this.damageAmount} damage per hit.

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
						target.hit(this.damageAmount, player, this);
						resolve(this.effect(player, target, ring));
					} else if (curseOfLoki) {
						this.resetDamageAmount();
						// Our attack is now bouncing back against us
						resolve(player.hit(1, target, this));
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

BerserkCard.cardType = 'Berserk';
BerserkCard.probability = 20;
BerserkCard.description = 'The whole world disappears into a beautiful still, silent, red. At the center of all things is the perfect face of your enemy. Destroy it.';
BerserkCard.cost = 6;
BerserkCard.level = 0;
BerserkCard.permittedClassesAndTypes = [GLADIATOR];
BerserkCard.defaults = {
	...HitCard.defaults,
	damage: 1
};

BerserkCard.flavors = {
	hits: [
		['punches', 80],
		['smacks', 70],
		['back-fists', 70],
		['upper-cuts', 70],
		['head-butts', 50],
		['puts a boot to the face of', 50],
		['back-hands', 50],
		['elbows', 30],
		['cupped-hand-smacks the ear of', 30],
		['fist-to-face cuddles', 20],
		['nose-honks', 5],
		['eye-pokes', 5]
	]
};

module.exports = BerserkCard;
