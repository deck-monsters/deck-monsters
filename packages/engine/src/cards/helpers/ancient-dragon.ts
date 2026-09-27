import { chance } from '../../helpers/chance.js';
import { ATTACK_PHASE, DEFENSE_PHASE } from '../../constants/phases.js';
import { DRAGON } from '../../constants/creature-types.js';
import { ANCIENT_DRAGON_EFFECT, EXPOSED_EFFECT } from '../../constants/effect-types.js';
import { isOpponentHold } from './control-ward.js';

const { roll } = chance;

/*
 * Very old dragons (owner, 2026-09-27): "immensely powerful but occasionally able to be
 * tricked, because that's the way someone usually defeats them." The old stories do it two
 * ways, and an ancient dragon has both weaknesses:
 *   - talk: Fafnir is drawn into conversation by a hero who hides his name (Völsunga saga).
 *     Once per fight, each opponent the ancient dragon attacks may try to outwit it: 1d20 +
 *     INT against 20 + the dragon's INT. It is hard, and clever monsters are the ones who
 *     manage it. The attack goes wide and the dragon is exposed: -4 AC until its next card.
 *   - the soft underbelly: Sigurd waits in a pit and strikes from below. A natural 20 with a
 *     Hit-family attack against an ancient dragon does triple damage instead of the usual
 *     maximum.
 * Its power is in Fire Breath: an ancient dragon's flames cannot be dodged and burn a turn
 * longer. See docs/archive/roadmap/30-dragon-pack.md.
 *
 * Everything lives in one encounter effect armed when the fight starts (Dragon.startEncounter),
 * so fight cleanup ends it; the "once per fight" record lives in its closure.
 */

export const ANCIENT_DRAGON_LEVEL = 10;
export const TRICK_DIFFICULTY = 20;
export const EXPOSED_AC_PENALTY = 4;
export const UNDERBELLY_MULTIPLIER = 3;

export const isAncientDragon = (monster: any): boolean =>
	monster?.creatureType === DRAGON && (monster.level ?? 0) >= ANCIENT_DRAGON_LEVEL;

export const isExposed = (monster: any): boolean =>
	!!monster?.encounterEffects?.some((effect: any) => effect.effectType === EXPOSED_EFFECT);

/** -4 AC until the dragon's next card; a second trick in the same turn does not stack. */
export function expose(dragon: any): void {
	if (isExposed(dragon)) return;

	const exposed = ({ card, phase, player }: any) => {
		if (phase !== ATTACK_PHASE || player !== dragon) return card;
		dragon.encounterEffects = dragon.encounterEffects.filter((effect: any) => effect !== exposed);
		dragon.setModifier('ac', EXPOSED_AC_PENALTY);
		return card;
	};

	exposed.effectType = EXPOSED_EFFECT;
	dragon.setModifier('ac', -EXPOSED_AC_PENALTY);
	dragon.encounterEffects = [...dragon.encounterEffects, exposed];
}

/** The target's attempt to talk its way past the dragon. `card` voices the roll. */
export function outwit(dragon: any, target: any, card: any): boolean {
	const difficulty = TRICK_DIFFICULTY + dragon.intModifier;
	const trickRoll = roll({ primaryDice: '1d20', modifier: target.intModifier });
	// A tie goes to the dragon, as a tie goes to the defender on a Hit and on a Fire Breath
	// dodge. No crits: a natural 20 is no cleverer than any other 20.
	const tricked = trickRoll.result > difficulty;

	card.emit?.('rolled', {
		reason: `vs ${difficulty} to outwit an ancient dragon.`,
		card,
		roll: trickRoll,
		who: target,
		outcome: tricked
			? `${target.givenName} flatters ${dragon.givenName} with a riddle, and the ancient dragon stops to think. The attack goes wide, and ${dragon.pronouns.his} guard is down (-${EXPOSED_AC_PENALTY} ac until ${dragon.pronouns.his} next card).`
			: `${dragon.givenName} is far too old to fall for that.`,
		vs: difficulty,
	});

	return tricked;
}

export function armAncientDragon(dragon: any): void {
	const tried = new Set<unknown>();

	const ancient = ({ card, phase, player, ring, activeContestants }: any) => {
		// The dragon's own attack: each opponent gets one try per fight to outwit it. Only an
		// opponent: an ally caught in the dragon's Tsunami must not talk its way out of the
		// wave. `isOpponentHold` is the team rule the hold ward already uses.
		if (phase === ATTACK_PHASE && player === dragon && typeof card.effect === 'function') {
			const { effect } = card;
			card.effect = async (attacker: any, target: any, ...rest: any[]) => {
				if (
					attacker !== dragon ||
					target.dead ||
					tried.has(target) ||
					!isOpponentHold(dragon, target, activeContestants, ring)
				) {
					return effect.call(card, attacker, target, ...rest);
				}
				tried.add(target);
				if (!outwit(dragon, target, card)) return effect.call(card, attacker, target, ...rest);

				expose(dragon);
				return !target.dead;
			};
			return card;
		}

		// Someone else's Hit-family attack: a natural 20 finds the soft underbelly.
		if (phase === DEFENSE_PHASE && player !== dragon && typeof card.rollForDamage === 'function') {
			const { rollForDamage } = card;
			card.rollForDamage = function (roller: any, target: any, strokeOfLuck?: boolean, ...rest: any[]) {
				const damageRoll = rollForDamage.call(this, roller, target, strokeOfLuck, ...rest);
				if (strokeOfLuck && target === dragon && roller !== dragon) {
					damageRoll.result *= UNDERBELLY_MULTIPLIER;
					dragon.emit('narration', {
						narration: `${roller.givenName} finds the soft underbelly of ${dragon.givenName}! Triple damage.`,
					});
				}
				return damageRoll;
			};
		}

		return card;
	};

	ancient.effectType = ANCIENT_DRAGON_EFFECT;
	dragon.encounterEffects = [
		...dragon.encounterEffects.filter((effect: any) => effect.effectType !== ANCIENT_DRAGON_EFFECT),
		ancient,
	];
}
