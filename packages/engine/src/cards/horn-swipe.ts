import { LuckyStrike } from './lucky-strike.js';
import { MINOTAUR } from '../constants/creature-types.js';
import { chance } from '../helpers/chance.js';

const { roll } = chance;

export class HornSwipeCard extends LuckyStrike {
	static cardType = 'Horn Swipe';
	static permittedClassesAndTypes = [MINOTAUR];
	static description = 'Swing your horns at your opponent.';
	static defaults = {
		...LuckyStrike.defaults,
		targetProp: 'str',
	};
	static flavors = {
		hits: [
			['rams a horn into', 80, '🐮'],
			['slams the side of a horn into', 70, '🐮'],
			['stabs with a horn', 50, '🐮'],
			['just barely catches, and rips a huge chunk out of, the arm of', 5, '🐮'],
			[
				'bellows in rage and charges, swinging horns back and forth in a blind rage. The crowds winces as a sickening wet sucking plunging sound reverberates throughout the ring and a horn stabs all the way into',
				1,
				'🐮',
			],
		],
	};

	constructor({
		icon = '⾓',
		targetProp,
		...rest
	}: Record<string, any> = {}) {
		super({ targetProp, icon, ...rest });
	}

	override getAttackRoll(player: any): any {
		return roll({
			primaryDice: this.attackDice,
			modifier: player.strModifier,
			bonusDice: player.bonusAttackDice,
			crit: true,
		});
	}

	override getAttackCommentary(
		player: any,
		target: any,
		betterRoll: any,
		worseRoll: any
	): string {
		let commentary = '';

		const { success: horn1Success } = this.checkSuccess(
			worseRoll,
			target[this.targetProp]
		);
		if (!horn1Success) {
			commentary = `(${worseRoll.result}) ${target.givenName} manages to block your first horn...\n`;

			const { success: horn2Success } = this.checkSuccess(
				betterRoll,
				target[this.targetProp]
			);
			if (!horn2Success) {
				commentary += `(${betterRoll.result}) and your second horn as well.`;
				return commentary;
			}
		}

		commentary += `(${betterRoll.naturalRoll.result}) ${!horn1Success ? 'but' : target.givenName} fails to block your${!horn1Success ? ' second' : ''} horn.`;
		return commentary;
	}
}

export default HornSwipeCard;
