import { HitCard } from './hit.js';
import { chance } from '../helpers/chance.js';
import { CLERIC, FIGHTER } from '../constants/creature-classes.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { VERY_CHEAP } from '../helpers/costs.js';

const { roll } = chance;

export class Rehit extends HitCard {
	static cardType = 'Rehit';
	static permittedClassesAndTypes = [CLERIC, FIGHTER];
	static probability = UNCOMMON.probability;
	static description =
		'At the last moment you realize your trajectory is off and quickly attempt to correct your aim.';
	static level = 2;
	static cost = VERY_CHEAP.cost;

	constructor({ icon = '🔂', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest } as any);
	}

	override get stats(): string {
		return `${super.stats}\nRoll for attack, if you roll less than 10, roll again and use the second roll no matter what.`;
	}

	override hitCheck(player: any, target: any): any {
		let attackRoll = roll({
			primaryDice: this.attackDice,
			modifier: player.dexModifier,
			bonusDice: player.bonusAttackDice,
			crit: true,
		});
		let commentary = `Originally rolled ${attackRoll.naturalRoll.result}`;

		if (attackRoll.naturalRoll.result < 10) {
			attackRoll = roll({
				primaryDice: this.attackDice,
				modifier: player.dexModifier,
				bonusDice: player.bonusAttackDice,
				crit: true,
			});
			commentary += ', which was less than 10. Rerolled and used second roll.';
		} else {
			commentary += ', which was greater than 10. Kept first roll.';
		}

		const { success, strokeOfLuck, curseOfLoki, tie } = this.checkSuccess(
			attackRoll,
			target.ac
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
			reason = `vs ${target.pronouns.his} own ac (${target.ac}) in confusion.`;
		} else {
			reason = `vs ${target.givenName}'s ac (${target.ac}) to determine if the hit was a success.`;
		}

		this.emit('rolled', {
			reason,
			card: this,
			roll: attackRoll,
			who: player,
			outcome: success ? commentary || 'Hit!' : commentary || 'Miss...',
			vs: target.ac,
		});

		return { attackRoll, success, strokeOfLuck, curseOfLoki };
	}
}

export default Rehit;
