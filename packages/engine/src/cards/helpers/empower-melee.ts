import { chance } from '../../helpers/chance.js';
import { MELEE } from '../../constants/card-classes.js';

const { roll } = chance;

export interface MeleeBonus {
	/** Added to the attack roll. */
	hitBonus?: number;
	/** Rolled and added to the damage roll, e.g. '1d6'. */
	damageDice?: string;
	/**
	 * Called when the damage bonus is actually added, which is only when the attack hits:
	 * Hit rolls damage for the attacker only on a hit. A bonus meant for the next *hit*
	 * (Mood Scales' fury) spends itself here, not when the attack is made.
	 */
	onDamageBonus?: () => void;
}

/** True for a melee card that rolls to hit and for damage (Hit and its family). */
export const canEmpower = (card: any): boolean =>
	!!card?.isCardClass?.(MELEE) &&
	typeof card.getAttackRoll === 'function' &&
	typeof card.getDamageRoll === 'function';

/**
 * Adds a one-play bonus to `card` (the per-play clone `applyEffects` hands to encounter
 * effects), for rolls `attacker` makes. The Dragon's dive (Take Wing) and fury (Mood Scales)
 * use it. The bonus goes on the roll's `modifier`, not `bonusResult`, because a natural 20
 * recomputes damage as the dice's maximum plus `modifier` (HitCard.rollForDamage) and would
 * otherwise drop it. A natural 1 makes Hit roll damage for the *target* against the attacker;
 * that roll is not the attacker's, so it gets no bonus.
 */
export function empowerMelee(card: any, attacker: any, { hitBonus = 0, damageDice, onDamageBonus }: MeleeBonus): boolean {
	if (!canEmpower(card)) return false;

	const { getAttackRoll, getDamageRoll } = card;

	if (hitBonus) {
		card.getAttackRoll = function (player: any, ...rest: any[]) {
			const attackRoll = getAttackRoll.call(this, player, ...rest);
			if (player === attacker) {
				attackRoll.modifier += hitBonus;
				attackRoll.result += hitBonus;
			}
			return attackRoll;
		};
	}

	if (damageDice) {
		card.getDamageRoll = function (player: any, ...rest: any[]) {
			const damageRoll = getDamageRoll.call(this, player, ...rest);
			if (player === attacker) {
				const extra = roll({ primaryDice: damageDice }).result;
				damageRoll.modifier += extra;
				damageRoll.result += extra;
				onDamageBonus?.();
			}
			return damageRoll;
		};
	}

	return true;
}
