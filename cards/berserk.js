/* eslint-disable max-len */

const HitCard = require('./hit');

const { BARBARIAN } = require('../helpers/classes');
const { roll } = require('../helpers/chance');
const { COMMON } = require('../helpers/probabilities');
const { REASONABLE } = require('../helpers/costs');

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

		this.resetCard();
	}

	resetCard () {
		this.damageAmount = this.options.damage;
		this.iterations = 0;
		this.baseFatigue = -1;
		this.intBonusFatigue = undefined;
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

		return `Hit: ${this.attackDice} + attack bonus vs AC on first hit
then also + spell bonus (fatigued by 1 each subsequent hit) until you miss
${damageDescription}

Stroke of luck increases damage per hit by 1.`;
	}

	getDamageRoll () {
		return roll({ primaryDice: this.damageDice });
	}

	getAttackRollBonus (player) {
		let modifier = player.dexModifier;

		// intBonus doesn't kick in until we've actually successfully hit
		if (this.iterations > 1) {
			modifier += Math.max(player.intModifier - (this.intBonusFatigue || 0), 0);
		}

		return modifier;
	}

	getAttackRoll (player, target) {
		// once you hit the first time, you get a fatiguing bonus for each subsequent hit.
		const modifier = this.getAttackRollBonus(player, target);
		return roll({ primaryDice: this.attackDice, modifier, bonusDice: player.bonusAttackDice, crit: true });
	}

	increaseFatigue (currentFatigue, iteration) {
		let fatigueAmount = (currentFatigue >= 0) ? currentFatigue : this.baseFatigue;

		return fatigueAmount + 1;
	}

	effectLoop (iteration, player, target, ring, activeContestants) {
		this.iterations = iteration;
		// intBonus doesn't kick in until we've actually successfully hit, don't fatigue the bonus until then
		if (iteration > 1) {
			this.intBonusFatigue = this.increaseFatigue(this.intBonusFatigue, iteration);
		}

		// Add any player modifiers and roll the dice
		const {
			attackRoll, success, strokeOfLuck, curseOfLoki
		} = this.hitCheck(player, target);// eslint-disable-line no-unused-vars

		if (strokeOfLuck) {
			this.damageAmount = this.damageAmount + 1;
			this.intBonusFatigue = this.baseFatigue;
		}

		if (success) {
			let damage = this.damageAmount;
			if (iteration === 1 && this.bigFirstHit) {
				damage = this.rollForDamage(player, target, strokeOfLuck).result;
			}

			// Do not consider the first hit part of the cumulative combo damage.
			// For cards with a bigFirstHit, this will make perma-death possible (although unlikely)
			if (iteration !== 1) {
				this.cumulativeComboDamage++;
			}

			// If we hit then do some damage
			if (!target.dead && this.cumulativeComboDamage <= Math.floor(target.maxHp / 2)) {
				target.hit(damage, player, this);
			} else {
				this.emit('narration', {
					narration: `HUMILIATION! ${iteration} hits`
				});
			}

			return this.effectLoop(iteration + 1, player, target, ring, activeContestants);
		} else if (curseOfLoki) {
			let damage = this.damageAmount;
			if (iteration === 1 && this.bigFirstHit) {
				damage = this.rollForDamage(player, target, strokeOfLuck).result;
			}

			this.emit('narration', {
				narration: 'COMBO BREAKER!'
			});

			this.resetCard();
			// Our attack is now bouncing back against us
			return player.hit(damage, target, this);
		}

		this.resetCard();
		this.emit('miss', {
			attackResult: attackRoll.result,
			attackRoll,
			player,
			target
		});

		if (iteration > 1) {
			const comboText = (iteration > 3) ? 'COMBO! ' : '';
			const ultraText = (iteration > 5) ? 'ULTRA ' : '';
			this.emit('narration', {
				narration: `${target.dead ? 'ULTIMATE ' : ultraText}${comboText}${iteration - 1} HIT${(iteration - 1 > 1) ? 'S' : ''}`
			});
		}

		return ring.channelManager.sendMessages()
			.then(() => !target.dead);
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars
		this.cumulativeComboDamage = 0;
		return this.effectLoop(1, player, target, ring, activeContestants);
	}
}

BerserkCard.cardType = 'Berserk';
BerserkCard.permittedClassesAndTypes = [BARBARIAN];
BerserkCard.probability = COMMON.probability;
BerserkCard.description = 'The whole world disappears into a beautiful still, silent, red. At the center of all things is the perfect face of your enemy. Destroy it.';
BerserkCard.level = 1;
BerserkCard.cost = REASONABLE.cost;

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
