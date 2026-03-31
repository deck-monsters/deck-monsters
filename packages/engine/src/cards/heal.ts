import { BaseCard, type CardOptions } from './base.js';
import { chance } from '../helpers/chance.js';
import { random } from '../helpers/random.js';
import { COMMON } from '../helpers/probabilities.js';
import { ALMOST_NOTHING } from '../helpers/costs.js';
import { HEAL } from '../constants/card-classes.js';

const { roll } = chance;

export interface HealCardOptions extends CardOptions {
	healthDice?: string;
	modifier?: number;
}

export class HealCard extends BaseCard<HealCardOptions> {
	static cardClass = [HEAL];
	static cardType = 'Heal';
	static probability = COMMON.probability;
	static description =
		'A well-timed healing can be the difference between sweet victory and devastating defeat.';
	static level = 0;
	static cost = ALMOST_NOTHING.cost;
	static defaults = {
		healthDice: '1d4',
		modifier: 0,
	};

	constructor({
		healthDice,
		modifier,
		icon = '💊',
	}: Partial<HealCardOptions> = {}) {
		super({ healthDice, modifier, icon } as Partial<HealCardOptions>);
	}

	get healthDice(): string {
		return (this.options as HealCardOptions).healthDice!;
	}

	get modifier(): number {
		return (this.options as HealCardOptions).modifier ?? 0;
	}

	get stats(): string {
		return `Health: ${this.healthDice}
+ int bonus (diminished by 1 each use until 0, then resets)

1% chance to heal half max hp
1% chance to poison`;
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	getHealRoll(player: any): any {
		if (
			!player.encounterModifiers.healModifier ||
			player.encounterModifiers.healModifier < 0
		) {
			player.encounterModifiers.healModifier =
				player.intModifier + this.modifier;
		} else {
			player.encounterModifiers.healModifier = Math.max(
				player.encounterModifiers.healModifier - 1,
				0
			);
		}

		return roll({
			primaryDice: this.healthDice,
			modifier: player.encounterModifiers.healModifier,
			bonusDice: player.bonusIntDice,
		});
	}

	override checkSuccess(healRoll: any, target: any): any {
		const hundred = random(1, 100);
		const strokeOfLuck = hundred === 7;
		const curseOfLoki = hundred === 13;

		let { result } = healRoll;
		if (strokeOfLuck) {
			result = Math.floor(target.maxHp / 2);
		} else if (curseOfLoki) {
			result *= -1;
		}

		healRoll.result = result;

		return {
			curseOfLoki,
			healRoll,
			result,
			strokeOfLuck,
			success: result !== 0,
		};
	}

	effect(player: any, target: any, _ring?: any, _activeContestants?: any): any {
		const { curseOfLoki, healRoll, result, strokeOfLuck, success } =
			this.checkSuccess(this.getHealRoll(target), target);

		let outcome = `${target.givenName} grows stronger...`;

		if (strokeOfLuck) {
			this.emit('narration', {
				narration: `Stroke of Luck!\nWait... wasn't this the questionable phial you found on the floor behind the shelf? Is it safe? Desperate times... Down the hatch!`,
			});
			if (!success) outcome = 'The phial was empty!';
		} else if (curseOfLoki) {
			this.emit('narration', {
				narration: `Curse of Loki!\nEw... That tasted awful. Almost like... Oh no. Oh _no_. You just drank poison. 🤢`,
			});
			if (!success) {
				outcome = 'Phew! Barely a drop left, not enough to do any harm.';
			} else {
				outcome = 'Poisoned!';
			}
		} else if (!success) {
			outcome = `Empty! Not a drop left for ${target.givenName}.`;
		}

		this.emit('rolled', {
			reason: 'to determine how much to drink.',
			card: this,
			roll: healRoll,
			who: target,
			outcome,
		});

		if (!success) return true;
		return target.heal(result);
	}
}

export default HealCard;
