/* eslint-disable max-len */

const ImmobilizeCard = require('./immobilize');

const { MINOTAUR } = require('../helpers/creature-types');

const { roll } = require('../helpers/chance');

const STARTING_FREEDOM_THRESHOLD_MODIFIER = -4;// If they stab with both horns, freedom threshold modifier will be 0
const STARTING_ATTACK_MODIFIER = 0;

class HornGore extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damageDice,
		icon = '🐂',
		...rest
	} = {}) {
		super({ damageDice, icon, ...rest });
	}

	get stats () {
		return `Attack twice (once with each horn). +2 to pin for each successfull horn hit.
${super.stats}`;
	}

	getAttackModifier (target) {
		if (this.weakAgainstCreatureTypes.includes(target.name)) {
			return -2 + this.attackModifier;
		} else if (this.strongAgainstCreatureTypes.includes(target.name)) {
			return this.attackModifier;
		}
		return 0;
	}

	resetImmobilizeStrength () {
		this.freedomThresholdModifier = STARTING_FREEDOM_THRESHOLD_MODIFIER;
		this.attackModifier = STARTING_ATTACK_MODIFIER;
	}

	increaseImmobilizeStrength (ammount) {
		this.freedomThresholdModifier += ammount;
		this.attackModifier += ammount;
	}

	getCommentary (rolled, player, target) { // eslint-disable-line class-methods-use-this
		let commentary;

		if (rolled.strokeOfLuck) {
			commentary = `${player.givenName} rolled a natural 20. Automatic max damage.`;
		}

		if (rolled.curseOfLoki) {
			const flavors = [
				`gouge ${player.pronouns[1]} eye`,
				`punch ${player.pronouns[1]} soft temple`,
				`kick ${player.pronouns[1]} jugular`,
				`shove a fist into each of ${player.pronouns[1]} nostrils and spread ${target.prounouns[1]} arms as wide as ${target.pronouns[0]} can`,
				`bite off ${player.pronouns[1]} ear`,
				`grab ${player.pronouns[1]} tongue and pull for all ${target.pronouns[0]}'s worth`
			];
			commentary = `${player.givenName} rolled a 1.
${target.givenName} manages to take the opportunity of such close proximity to ${player.givenName}'s face to ${flavors[Math.random() * flavors.length]}.`;
		}

		return commentary;
	}

	emitRoll (rolled, success, player, target, hornNumber) {
		this.emit('rolling', {
			reason: `vs ${target.givenName}'s AC (${target.ac})${hornNumber ? ` for horn ${hornNumber}` : ''} to determine if gore was successful`,
			card: this,
			roll: rolled,
			player,
			target
		});

		const commentary = this.getCommentary(rolled, player, target);

		this.emit('rolled', {
			reason: `vs AC (${target.ac})${hornNumber ? ` for horn ${hornNumber}` : ''}`,
			card: this,
			roll: rolled,
			player,
			target,
			outcome: success ? commentary || 'Hit!' : commentary || 'Miss...'
		});
	}

	hitCheck (player, target, hornNumber) {
		const attackRoll = this.getAttackRoll(player, target);
		const { success, strokeOfLuck, curseOfLoki } = this.checkSuccess(attackRoll, target.ac);

		this.emitRoll(attackRoll, success, player, target, hornNumber);

		return {
			attackRoll,
			success,
			strokeOfLuck,
			curseOfLoki
		};
	}

	getDamageRoll (player) {
		return roll({ primaryDice: this.damageDice, modifier: (Math.floor(player.damageModifier / 2)), bonusDice: player.bonusDamageDice });
	}

	gore (player, target, hornNumber) {
		const { attackRoll, success, strokeOfLuck, curseOfLoki } = this.hitCheck(player, target, hornNumber);

		if (success) {
			this.increaseImmobilizeStrength(2);
			player.encounterModifiers = { attackModifier: player.encounterModifiers.attackModifier += 1 || 1 };

			const damageRoll = this.rollForDamage(player, target, strokeOfLuck);

			// If we hit then do some damage
			target.hit(damageRoll.result, player, this);
		} else if (curseOfLoki) {
			const damageRoll = this.rollForDamage(target, player);

			// Our attack is now bouncing back against us
			player.hit(damageRoll.result, target, this);
		}

		return { attackRoll, success, strokeOfLuck, curseOfLoki };
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars
		// if the player stabs with their first horn, make it slightly more likely that the second
		// horn will also stab, but just for this one attack. Therefore, need to store their
		// pre-gore attackModifier and restore it once the second stab is resolved (and before the
		// actual immobilize takes place so it doesn't interfere with the immobilize logic).
		const originalAttackModifier = player.encounterModifiers.attackModifier;

		this.resetImmobilizeStrength();
		const horn1 = this.gore(player, target, 1);
		const horn2 = this.gore(player, target, 2);
		const chanceToImmobilize = horn1.success || horn2.success;

		player.encounterModifiers = { attackModifier: originalAttackModifier };

		if (!player.dead && chanceToImmobilize) {
			if (target.dead) {
				return false;
			}

			return super.effect(player, target, ring, activeContestants);
		}

		this.emit('miss', {
			attackResult: Math.max(horn1.attackRoll.result, horn2.attackRoll.result),
			curseOfLoki: horn1.curseOfLoki || horn2.curseOfLoki,
			player,
			target
		});

		return !target.dead;
	}
}

HornGore.cardType = 'Horn Gore';
HornGore.probability = 5;
HornGore.description = 'You think those horns are just there to look pretty? Think again...';
HornGore.cost = 6;
HornGore.level = 0;
HornGore.permittedClassesAndTypes = [MINOTAUR];
HornGore.defaults = {
	...ImmobilizeCard.defaults,
	damageDice: '1d4',
	hitOnFail: false,
	doDamageOnImmobilize: false,
	freedomThresholdModifier: STARTING_FREEDOM_THRESHOLD_MODIFIER,
	attackModifier: STARTING_ATTACK_MODIFIER
};

HornGore.flavors = {
	hits: [
		['gores', 80],
		['mercilessly juggles on their mighty horns', 70],
		['pokes relentlessly', 70],
		['impales', 50],
		['chases down gleefully, stomps on, and then wantonly drives their horns through', 5],
		['teaches the true meaning of "horny" to', 5]
	]
};

module.exports = HornGore;
