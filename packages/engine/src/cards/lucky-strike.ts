import { HitCard } from './hit.js';
import { chance } from '../helpers/chance.js';
import { BARD, CLERIC, FIGHTER } from '../constants/creature-classes.js';
import { RARE } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';

const { roll } = chance;

export class LuckyStrike extends HitCard {
	static cardType = 'Lucky Strike';
	static permittedClassesAndTypes = [BARD, CLERIC, FIGHTER];
	static probability = RARE.probability;
	static description =
		"A man in a jester's hat smiles at you from the crowd. You feel... Lucky for some reason. Or perhaps feel the unluckiness of your opponent...";
	static level = 2;
	static cost = REASONABLE.cost;
	static notForSale = true;
	static flavors = {
		hits: [
			['whistles tunelessly while absolutely destroying', 80],
			['strikes many blows upon', 70],
			['hits', 50],
			['turns into a humingbird and beats down on', 5],
			[
				'is for once blessed by Loki instead of cursed and wonders, "is this a good thing for me? Or is this a bad thing for them?" and strikes',
				1,
			],
		],
	};

	constructor({ icon = '🚬', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest } as any);
	}

	override get stats(): string {
		return `${super.stats}\nRoll twice for hit. Use the best roll.`;
	}

	override getAttackRoll(player: any): any {
		return roll({
			primaryDice: this.attackDice,
			modifier: player.dexModifier,
			bonusDice: player.bonusAttackDice,
			crit: true,
		});
	}

	getAttackCommentary(
		player: any,
		target: any,
		betterRoll: any,
		worseRoll: any
	): string {
		let commentary = '';

		const { success: roll1Success } = this.checkSuccess(
			worseRoll,
			target[this.targetProp]
		);
		if (!roll1Success) {
			commentary = `(${worseRoll.result}) ${player.givenName} was sure ${player.pronouns.he} was going to miss ${target.givenName}\n`;

			const { success: roll2Success } = this.checkSuccess(
				betterRoll,
				target[this.targetProp]
			);
			if (!roll2Success) {
				commentary += `(${betterRoll.result}) and ${player.pronouns.he} did.`;
				return commentary;
			}
		}

		commentary += `(${betterRoll.naturalRoll.result})${!roll1Success ? ' but' : ''} ${target.givenName} fails to block ${player.pronouns.his} blow.`;
		return commentary;
	}

	override hitCheck(player: any, target: any): any {
		const attackRoll1 = this.getAttackRoll(player);
		const attackRoll2 = this.getAttackRoll(player);

		const betterRoll =
			attackRoll2.naturalRoll.result > attackRoll1.naturalRoll.result
				? attackRoll2
				: attackRoll1;
		const worseRoll =
			attackRoll2.naturalRoll.result < attackRoll1.naturalRoll.result
				? attackRoll2
				: attackRoll1;

		let commentary = this.getAttackCommentary(
			player,
			target,
			betterRoll,
			worseRoll
		);

		const { success, strokeOfLuck, curseOfLoki, tie } = this.checkSuccess(
			betterRoll,
			target[this.targetProp]
		);

		if (strokeOfLuck) {
			commentary += ` ${player.givenName} rolled a natural 20. Automatic double max damage.`;
		} else if (curseOfLoki) {
			commentary += ` ${player.givenName} rolled a 1. Even if ${player.pronouns.he} would have otherwise hit, ${player.pronouns.he} misses.`;
		} else if (tie) {
			commentary = 'Miss... Tie goes to the defender.';
		}

		let reason: string;
		if (player === target) {
			reason = `vs ${target.pronouns.his} own ${this.targetProp.toLowerCase()} (${target[this.targetProp]}) in confusion.`;
		} else {
			reason = `vs ${target.givenName}'s ${this.targetProp.toLowerCase()} (${target[this.targetProp]}) to determine if the hit was a success.`;
		}

		this.emit('rolled', {
			reason,
			card: this,
			roll: betterRoll,
			who: player,
			outcome: success ? commentary || 'Hit!' : commentary || 'Miss...',
			vs: target[this.targetProp],
		});

		return { attackRoll: betterRoll, success, strokeOfLuck, curseOfLoki };
	}
}

export default LuckyStrike;
