/* eslint-disable max-len */

const HitCard = require('./hit');
const { BARBARIAN } = require('../helpers/classes');

class BerserkCard extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		bigFirstHit,
		damage,
		icon = '😤',
		...rest
	} = {}) {
		super({ icon, ...rest });

		this.setOptions({
			bigFirstHit,
			damage
		});

		this.resetDamageAmount();
	}

	resetDamageAmount () {
		this.damageAmount = this.options.damage;
	}

	set bigFirstHit (bigFirstHit) {
		this.bigFirstHit = bigFirstHit;
	}

	get bigFirstHit () {
		return this.options.bigFirstHit;
	}

	set damageAmount (amount) {
		this.damage = amount;
	}

	get damageAmount () {
		return this.damage;
	}

	get stats () {
		let damageDescription = `${this.damageAmount} damage per hit.`;
		if (this.bigFirstHit) {
			damageDescription = `${this.damageDice} damage on first hit.
${this.damageAmount} damage per hit after that.`;
		}

		return `Hit: ${this.attackDice} vs AC until you miss
${damageDescription}

Stroke of luck increases damage per hit by 1.`;
	}

	effectLoop (firstHit, player, target, ring, activeContestants) {
		return new Promise((resolve, reject) => {
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
						let damage = this.damageAmount;
						if (firstHit && this.bigFirstHit) {
							damage = this.rollForDamage(player, target, strokeOfLuck).result;
						}

						// If we hit then do some damage
						target.hit(damage, player, this);
						resolve(this.effectLoop(false, player, target, ring, activeContestants));
					} else if (curseOfLoki) {
						let damage = this.damageAmount;
						if (firstHit && this.bigFirstHit) {
							damage = this.rollForDamage(player, target, strokeOfLuck).result;
						}

						this.resetDamageAmount();
						// Our attack is now bouncing back against us
						resolve(player.hit(damage, target, this));
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
				}).catch(ex => reject(ex));
		});
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars
		return this.effectLoop(true, player, target, ring, activeContestants);
	}
}

BerserkCard.cardType = 'Berserk';
BerserkCard.probability = 40;
BerserkCard.description = 'The whole world disappears into a beautiful still, silent, red. At the center of all things is the perfect face of your enemy. Destroy it.';
BerserkCard.cost = 6;
BerserkCard.level = 1;
BerserkCard.permittedClassesAndTypes = [BARBARIAN];
BerserkCard.defaults = {
	...HitCard.defaults,
	damage: 1,
	bigFirstHit: false
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
