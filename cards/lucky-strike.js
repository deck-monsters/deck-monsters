/* eslint-disable max-len */

const HitCard = require('./hit');

const { roll } = require('../helpers/chance');
const { CLERIC, FIGHTER } = require('../helpers/classes');

class LuckyStrike extends HitCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '🚬',
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	get stats () {
		return `${super.stats}

Roll twice for hit. Use the best roll.`;
	}

	getAttackRoll (player) {
		return roll({ primaryDice: this.attackDice, modifier: player.dexModifier, bonusDice: player.bonusAttackDice });
	}

	hitCheck (player, target) {
		const attackRoll1 = this.getAttackRoll(player);
		const attackRoll2 = this.getAttackRoll(player);

		const betterRoll = (attackRoll2.naturalRoll.result > attackRoll1.naturalRoll.result) ? attackRoll2 : attackRoll1;
		const worseRoll = (attackRoll2.naturalRoll.result < attackRoll1.naturalRoll.result) ? attackRoll2 : attackRoll1;

		this.emit('rolling', {
			reason: `vs ${target.identity}'s ${this.targetProp.toUpperCase()} (${target[this.targetProp]}) twice to determine if the hit was a success, and uses the best roll.`,
			card: this,
			roll: betterRoll,
			player,
			target,
			vs: target[this.targetProp]
		});

		let commentary = `Natural rolls were ${betterRoll.naturalRoll.result} and ${worseRoll.naturalRoll.result}; used ${betterRoll.naturalRoll.result} as better roll.`;

		const { success, strokeOfLuck, curseOfLoki, tie } = this.checkSuccess(betterRoll, this.targetProp);

		if (strokeOfLuck) {
			commentary += ` ${player.givenName} rolled a natural 20. Automatic double max damage.`;
		} else if (curseOfLoki) {
			commentary += ` ${player.givenName} rolled a 1. Even if ${player.pronouns[0]} would have otherwise hit, ${player.pronouns[0]} misses.`;
		} else if (tie) {
			commentary = 'Miss... Tie goes to the defender.';
		}
		this.emit('rolled', {
			reason: `vs ${target.identity}'s ${this.targetProp.toUpperCase()} (${target[this.targetProp]})`,
			card: this,
			roll: betterRoll,
			player,
			target,
			outcome: success ? commentary || 'Hit!' : commentary || 'Miss...',
			vs: target[this.targetProp]
		});

		return {
			attackRoll: betterRoll,
			success,
			strokeOfLuck,
			curseOfLoki
		};
	}
}

LuckyStrike.cardType = 'Lucky Strike';
LuckyStrike.permittedClassesAndTypes = [CLERIC, FIGHTER];
LuckyStrike.probability = 30;
LuckyStrike.description = 'A man in a jester\'s hat smiles at you from the crowd. You feel... Lucky for some reason. Or perhaps feel the _unluckyness_ of your opponent...';
LuckyStrike.level = 2;
LuckyStrike.cost = 30;
LuckyStrike.notForSale = true;

LuckyStrike.flavors = {
	hits: [
		['whistles tunelessly while absolutely destroying', 80],
		['strikes many blows upon', 70],
		['hits', 50],
		['turns into a humingbird and beats down on', 5],
		['is for once blessed by Loki instead of cursed and wonders, "is this a good thing for me? Or is this a bad thing for them?" and strikes', 1]
	]
};

module.exports = LuckyStrike;
