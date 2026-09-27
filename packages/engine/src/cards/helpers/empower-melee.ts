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
/**
 * Adds `amount` to a roll. Most cards return one roll; Hit Harder returns
 * `{ betterRoll, worseRoll }` and deals the better, so both get it (a Codex review of PR
 * #402 found the bonus written onto the pair as NaN fields and never dealt). Returns whether
 * anything was added.
 */
const addToRoll = (rolled: any, amount: number): boolean => {
	if (typeof rolled?.result === 'number') {
		rolled.modifier += amount;
		rolled.result += amount;
		return true;
	}
	let added = false;
	// A set: when Hit Harder's two rolls tie, `betterRoll` and `worseRoll` are one object, and
	// adding to it twice doubled the bonus (caught by a flaky test run, not a review).
	for (const inner of new Set(Object.values(rolled ?? {}))) {
		if (inner && typeof (inner as any).result === 'number') {
			(inner as any).modifier += amount;
			(inner as any).result += amount;
			added = true;
		}
	}
	return added;
};

export function empowerMelee(card: any, attacker: any, { hitBonus = 0, damageDice, onDamageBonus }: MeleeBonus): boolean {
	if (!canEmpower(card)) return false;

	const { getAttackRoll, getDamageRoll } = card;

	if (hitBonus) {
		card.getAttackRoll = function (player: any, ...rest: any[]) {
			const attackRoll = getAttackRoll.call(this, player, ...rest);
			if (player === attacker) addToRoll(attackRoll, hitBonus);
			return attackRoll;
		};
	}

	if (damageDice) {
		// Once per play: Horn Gore rolls damage once per horn, and a dive or a fury is one
		// extra die for the card, not one per horn.
		let spent = false;
		card.getDamageRoll = function (player: any, ...rest: any[]) {
			const damageRoll = getDamageRoll.call(this, player, ...rest);
			if (player === attacker && !spent && addToRoll(damageRoll, roll({ primaryDice: damageDice }).result)) {
				spent = true;
				onDamageBonus?.();
			}
			return damageRoll;
		};
	}

	return true;
}
