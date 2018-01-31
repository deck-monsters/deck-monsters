/* eslint-disable max-len */
const sample = require('lodash.sample');

const ImmobilizeCard = require('./immobilize');

const { BASILISK, GLADIATOR, JINN, MINOTAUR, WEEPING_ANGEL } = require('../helpers/creature-types');
const { roll } = require('../helpers/chance');
const { EPIC } = require('../helpers/probabilities');
const { EXPENSIVE } = require('../helpers/costs');

const STARTING_FREEDOM_THRESHOLD_MODIFIER = -4;// If they stab with both horns, freedom threshold modifier will be 0
const STARTING_DEX_MODIFIER = 0;

class HornGore extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		damageDice,
		freedomSavingThrowTargetAttr,
		icon = '🐂',
		targetProp,
		...rest
	} = {}) {
		super({ damageDice, freedomSavingThrowTargetAttr, icon, targetProp, ...rest });
	}

	get stats () {
		return `Attack twice (once with each ${this.flavors.spike}). +2 to hit and ${this.actions.IMMOBILIZE} for each successfull ${this.flavors.spike} hit.

If either ${this.flavors.spike} hits, chance to ${this.actions.IMMOBILIZE}: 1d20 - 6 vs ${this.freedomSavingThrowTargetAttr.toUpperCase()}.

${super.stats}`;
	}

	getAttackModifier (target) {
		if (this.weakAgainstCreatureTypes.includes(target.creatureType)) {
			return -2 + this.freedomThresholdModifier;
		} else if (this.strongAgainstCreatureTypes.includes(target.creatureType)) {
			return this.freedomThresholdModifier;
		}
		return 0;
	}

	resetImmobilizeStrength () {
		this.freedomThresholdModifier = STARTING_FREEDOM_THRESHOLD_MODIFIER;
		this.dexModifier = STARTING_DEX_MODIFIER;
	}

	increaseImmobilizeStrength (ammount) {
		this.freedomThresholdModifier += ammount;
		this.dexModifier += ammount;
	}

	getCommentary (rolled, player, target) { // eslint-disable-line class-methods-use-this
		let commentary;

		if (rolled.strokeOfLuck) {
			commentary = `${player.givenName} rolled a natural 20. Automatic max damage.`;
		}

		if (rolled.curseOfLoki) {
			const flavors = [
				`gouge ${player.pronouns.his} eye`,
				`punch ${player.pronouns.his} soft temple`,
				`kick ${player.pronouns.his} jugular`,
				`shove a fist into each of ${player.pronouns.his} nostrils and spread ${player.pronouns.his} arms as wide as ${target.pronouns.he} can`,
				`bite off ${player.pronouns.his} ear`,
				`grab ${player.pronouns.his} tongue and pull for all ${target.pronouns.he}'s worth`
			];
			commentary = `${player.givenName} rolled a 1.
${target.givenName} manages to take the opportunity of such close proximity to ${player.givenName}'s face to ${sample(flavors)}.`;
		}

		return commentary;
	}

	emitRoll (rolled, success, player, target, hornNumber) {
		const commentary = this.getCommentary(rolled, player, target);

		let reason;
		if (player === target) {
			reason = `vs ${target.pronouns.his} own ac (${target.ac})${hornNumber ? ` for ${this.flavors.spike} ${hornNumber}` : ''} in confusion.`;
		} else {
			reason = `vs ${target.givenName}'s ac (${target.ac})${hornNumber ? ` for ${this.flavors.spike} ${hornNumber}` : ''} to determine if gore was successful.`;
		}

		this.emit('rolled', {
			reason,
			card: this,
			roll: rolled,
			who: player,
			outcome: commentary || (success ? 'Hit!' : 'Miss...'),
			vs: target.ac
		});
	}

	hitCheck (player, target, hornNumber) {
		const attackRoll = this.getAttackRoll(player, target);
		const { success, strokeOfLuck, curseOfLoki } = this.checkSuccess(attackRoll, target[this.targetProp]);

		this.emitRoll(attackRoll, success, player, target, hornNumber);

		return {
			attackRoll,
			success,
			strokeOfLuck,
			curseOfLoki
		};
	}

	getDamageRoll (player) {
		return roll({ primaryDice: this.damageDice, modifier: (Math.floor(player.strModifier / 2)), bonusDice: player.bonusDamageDice });
	}

	gore (player, target, hornNumber) {
		const { attackRoll, success, strokeOfLuck, curseOfLoki } = this.hitCheck(player, target, hornNumber);

		if (success) {
			this.increaseImmobilizeStrength(2);
			const { dexModifier } = player.encounterModifiers;
			player.encounterModifiers.dexModifier = dexModifier > 0 ? dexModifier + 1 : 1;

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

	// do not auto-succeed since this already hits twice
	immobilizeCheck (player, target) {
		const attackRoll = this.getImmobilizeRoll(player, target);
		const attackSuccess = this.checkSuccess(attackRoll, target[this.freedomSavingThrowTargetAttr]);

		const failMessage = `${this.actions.IMMOBILIZE} failed.`;
		const outcome = attackSuccess.success ? `${this.actions.IMMOBILIZE} succeeded!` : failMessage;

		this.emit('rolled', {
			reason: `to see if ${player.pronouns.he} ${this.actions.IMMOBILIZES} ${target.givenName}.`,
			card: this,
			roll: attackRoll,
			who: player,
			outcome,
			vs: this.freedomSavingThrowTargetAttr
		});

		if (!attackSuccess) {
			this.emit('miss', {
				attackResult: attackRoll.result,
				attackRoll,
				player,
				target
			});
		}

		return attackSuccess;
	}

	effect (player, target, ring, activeContestants) { // eslint-disable-line no-unused-vars
		// if the player stabs with their first horn, make it slightly more likely that the second
		// horn will also stab, but just for this one attack. Therefore, need to store their
		// pre-gore dexModifier and restore it once the second stab is resolved (and before the
		// actual immobilize takes place so it doesn't interfere with the immobilize logic).
		const originalDexModifier = player.encounterModifiers.dexModifier;

		this.resetImmobilizeStrength();
		const horn1 = this.gore(player, target, 1);
		const horn2 = this.gore(player, target, 2);
		const chanceToImmobilize = horn1.success || horn2.success;

		player.encounterModifiers.dexModifier = originalDexModifier;

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
HornGore.actions = { IMMOBILIZE: 'pin', IMMOBILIZES: 'pins', IMMOBILIZED: 'pinned' };
HornGore.permittedClassesAndTypes = [MINOTAUR];
HornGore.strongAgainstCreatureTypes = [MINOTAUR, GLADIATOR];
HornGore.weakAgainstCreatureTypes = [BASILISK, JINN, WEEPING_ANGEL];
HornGore.uselessAgainstCreatureTypes = [];
HornGore.probability = EPIC.probability;
HornGore.description = 'You think those horns are just there to look pretty? Think again...';
HornGore.level = 0;
HornGore.cost = EXPENSIVE.cost;
HornGore.notForSale = true;

HornGore.defaults = {
	...ImmobilizeCard.defaults,
	damageDice: '1d4',
	doDamageOnImmobilize: false,
	freedomThresholdModifier: STARTING_FREEDOM_THRESHOLD_MODIFIER,
	freedomSavingThrowTargetAttr: 'dex',
	targetProp: 'ac'
};

HornGore.flavors = {
	hits: [
		['gores', 80],
		['pokes relentlessly', 70],
		['impales', 70],
		['mercilessly juggles (on their mighty horns) the pitiful', 50],
		['chases down gleefully, stomps on, and then wantonly drives their horns through', 5],
		['teaches the true meaning of "horny" to', 5]
	],
	spike: 'horn'
};

module.exports = HornGore;
