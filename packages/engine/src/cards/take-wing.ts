import { BaseCard, type CardOptions } from './base.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { ATTACK_PHASE, DEFENSE_PHASE } from '../constants/phases.js';
import { AOE, MELEE } from '../constants/card-classes.js';
import { DRAGON } from '../constants/creature-types.js';
import { TAKE_WING_EFFECT } from '../constants/effect-types.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { CHEAP } from '../helpers/costs.js';
import { empowerMelee } from './helpers/empower-melee.js';

export const DIVE_HIT_BONUS = 2;
export const DIVE_DAMAGE_DICE = '1d6';

export const isAirborne = (monster: any): boolean =>
	!!monster?.encounterEffects?.some((effect: any) => effect.effectType === TAKE_WING_EFFECT);

/*
 * The flight card the requester asked for (docs/archive/roadmap/30-dragon-pack.md; owner's choice
 * "take off, then dive"). The description quotes Isaiah 30:6 (1611 King James Bible).
 *
 * Every part is spent or visible, as 29 requires of any defence: one dodge per take-off,
 * only against a melee blow; anything that does land knocks the dragon down and loses the
 * dive; and the dive only happens if the very next card is a melee attack. All of it lives
 * in one encounter effect, so the fight's cleanup ends it.
 */
export class TakeWingCard extends BaseCard {
	static cardType = 'Take Wing';
	static permittedClassesAndTypes = [DRAGON];
	static probability = UNCOMMON.probability;
	static description =
		'"The fiery flying serpent." Up, out of reach, and then down again, all teeth.';
	static level = 0;
	static cost = CHEAP.cost;
	/**
	 * Roadmap 36, being measured: when true, the flier also dodges the first area spell (Blast
	 * and its kin), not only the first melee blow. Today a Blast knocks a flying dragon out of
	 * the sky, so Take Wing is a wasted turn against a Blast-heavy hand.
	 */
	static dodgesSpells = false;

	constructor({ icon = '🌬️' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		return `Take off until your next card. The first melee attack against you misses.
If your next card is a melee attack, dive: +${DIVE_HIT_BONUS} to hit and +${DIVE_DAMAGE_DICE} damage.
Any damage that lands while you are in the air knocks you down, and the dive is lost.`;
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	/** Remove the flight, if it is still there. */
	land(flier: any, airborne: unknown): void {
		flier.encounterEffects = flier.encounterEffects.filter((effect: any) => effect !== airborne);
	}

	takeOff(flier: any, ring: any): void {
		let dodged = false;

		const airborne = async ({ card, phase, player }: any) => {
			// The flier's next card: land, and dive if it is a melee attack.
			if (phase === ATTACK_PHASE && player === flier) {
				this.land(flier, airborne);
				if (empowerMelee(card, flier, { hitBonus: DIVE_HIT_BONUS, damageDice: DIVE_DAMAGE_DICE })) {
					this.emit('narration', {
						narration: `${this.icon} ${flier.givenName} folds ${flier.pronouns.his} wings and dives!`,
					});
				} else {
					this.emit('narration', {
						narration: `A Viking below bellows "COME DOWN FROM THERE THIS INSTANT!" ${flier.givenName} glides back down to the sand, in ${flier.pronouns.his} own time.`,
					});
				}
				await subEventDelay(ring?.pacingMultiplier);
				return card;
			}

			if (phase !== DEFENSE_PHASE || player === flier || typeof card.effect !== 'function') return card;

			// Someone else's card. Wrap its effect so the flier can dodge the first melee blow,
			// and is knocked down by anything that lands.
			const { effect } = card;
			card.effect = async (attacker: any, target: any, ...rest: any[]) => {
				if (target !== flier || !isAirborne(flier)) return effect.call(card, attacker, target, ...rest);

				const { dodgesSpells } = this.constructor as typeof TakeWingCard;
				if (!dodged && (card.isCardClass(MELEE) || (dodgesSpells && card.isCardClass(AOE)))) {
					dodged = true;
					this.emit('narration', {
						narration: `${flier.givenName} is high in the air, and ${attacker.givenName}'s blow strikes empty air.`,
					});
					await subEventDelay(ring?.pacingMultiplier);
					return !flier.dead;
				}

				const hpBefore = flier.hp;
				const result = await effect.call(card, attacker, target, ...rest);
				if (flier.hp < hpBefore && isAirborne(flier)) {
					this.land(flier, airborne);
					this.emit('narration', {
						narration: `${flier.givenName} is knocked out of the sky! No dive this time.`,
					});
					await subEventDelay(ring?.pacingMultiplier);
				}
				return result;
			};
			return card;
		};

		airborne.effectType = TAKE_WING_EFFECT;
		flier.encounterEffects = [...flier.encounterEffects, airborne];
	}

	async effect(player: any, target: any, ring?: any): Promise<boolean> {
		if (isAirborne(target)) {
			this.emit('narration', {
				narration: `${target.givenName} is already in the air, and climbs a little higher.`,
			});
			return true;
		}

		this.emit('narration', {
			narration:
				player === target
					? `${this.icon} ${player.givenName} spreads ${player.pronouns.his} wings and takes to the sky.`
					: `${this.icon} In confusion, ${player.givenName} flings ${target.givenName} into the air.`,
		});
		this.takeOff(target, ring);
		await subEventDelay(ring?.pacingMultiplier);

		return true;
	}
}

export default TakeWingCard;
