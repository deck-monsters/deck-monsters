import { BaseCard, type CardOptions } from './base.js';
import { chance } from '../helpers/chance.js';
import { ABUNDANT } from '../helpers/probabilities.js';
import { ALMOST_NOTHING } from '../helpers/costs.js';
import { MELEE } from '../constants/card-classes.js';

const { roll, max } = chance;

export interface HitCardOptions extends CardOptions {
	attackDice?: string;
	damageDice?: string;
	targetProp?: string;
}

export class HitCard extends BaseCard<HitCardOptions> {
	static cardClass = [MELEE];
	static cardType = 'Hit';
	static probability = ABUNDANT.probability + 10;
	static description = 'A basic attack, the staple of all good monsters.';
	static level = 0;
	static cost = ALMOST_NOTHING.cost;
	static defaults = {
		attackDice: '1d20',
		damageDice: '1d6',
		targetProp: 'ac',
	};

	constructor({
		flavors,
		attackDice,
		damageDice,
		targetProp,
		icon = '👊',
	}: Partial<HitCardOptions> = {}) {
		super({ flavors, targetProp, attackDice, damageDice, icon } as Partial<HitCardOptions>);
	}

	get attackDice(): string {
		return (this.options as HitCardOptions).attackDice!;
	}

	get damageDice(): string {
		return (this.options as HitCardOptions).damageDice!;
	}

	get targetProp(): string {
		return (this.options as HitCardOptions).targetProp!;
	}

	get stats(): string {
		return `Hit: ${this.attackDice} vs ${this.targetProp} / Damage: ${this.damageDice}`;
	}

	getAttackRoll(player: any, _target?: any): any {
		return roll({
			primaryDice: this.attackDice,
			modifier: player.dexModifier,
			bonusDice: player.bonusAttackDice,
			crit: true,
		});
	}

	hitCheck(player: any, target: any): {
		attackRoll: any;
		success: boolean;
		strokeOfLuck: boolean;
		curseOfLoki: boolean;
	} {
		const attackRoll = this.getAttackRoll(player);
		const { success, strokeOfLuck, curseOfLoki, tie } = this.checkSuccess(
			attackRoll,
			target[this.targetProp]
		);
		let commentary: string | undefined;

		if (strokeOfLuck) {
			commentary = `${player.givenName} rolled a natural 20. Automatic max damage.`;
		} else if (curseOfLoki) {
			commentary = `${player.givenName} rolled a 1. Unfortunately, while trying to attack, ${target.givenName} flings ${player.pronouns.his} attack back against ${player.pronouns.him}.`;
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
			roll: attackRoll,
			who: player,
			outcome: success ? commentary || 'Hit!' : commentary || 'Miss...',
			vs: target[this.targetProp],
		});

		return { attackRoll, success, strokeOfLuck, curseOfLoki };
	}

	getDamageRoll(player: any, _target?: any): any {
		return roll({
			primaryDice: this.damageDice,
			modifier: player.strModifier,
			bonusDice: player.bonusDamageDice,
		});
	}

	rollForDamage(player: any, target?: any, strokeOfLuck?: boolean): any {
		const damageRoll = this.getDamageRoll(player);

		if (strokeOfLuck) {
			damageRoll.naturalRoll.result = max(this.damageDice);
			damageRoll.result = max(this.damageDice) + damageRoll.modifier;
		} else {
			if (damageRoll.result < 1) {
				damageRoll.result = 1;
			}

			this.emit('rolled', {
				reason: 'for damage.',
				card: this,
				roll: damageRoll,
				who: player,
			});
		}

		return damageRoll;
	}

	effect(player: any, target: any, ring: any, _activeContestants?: any): any {
		const { attackRoll, success, strokeOfLuck, curseOfLoki } = this.hitCheck(
			player,
			target
		);

		if (success) {
			const damageRoll = this.rollForDamage(player, target, strokeOfLuck);
			return target.hit(damageRoll.result, player, this);
		} else if (curseOfLoki) {
			const damageRoll = this.rollForDamage(target, player);
			return player.hit(damageRoll.result, target, this);
		}

		this.emit('miss', {
			attackResult: attackRoll.result,
			attackRoll,
			player,
			target,
		});

		return !target.dead;
	}
}

export default HitCard;
