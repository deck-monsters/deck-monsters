import { BaseCard, type CardOptions } from './base.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { DEFENSE_PHASE } from '../constants/phases.js';
import { BARD, FIGHTER } from '../constants/creature-classes.js';
import { MIRROR_SHIELD_EFFECT } from '../constants/effect-types.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { CHEAP } from '../helpers/costs.js';

/**
 * Whether `monster` holds a Mirror Shield that has not turned an attack back yet. Spent
 * shields remove themselves, so the presence of the effect is the whole state.
 */
export const isMirrorShielded = (monster: any): boolean =>
	!!monster?.encounterEffects?.some((effect: any) => effect.effectType === MIRROR_SHIELD_EFFECT);

/**
 * How a reflected attack's damage splits. Rounding follows Fire Breath's dodge, the one place
 * the codebase halves damage: floor, and never less than 1 for the holder, so a shield never
 * turns a blow into nothing. The caster takes the other half, rounded up: the odd point goes
 * back where the attack came from. A damage of 0 or less (a Blast II cast with a very low INT)
 * splits into nothing and nothing.
 */
export const splitReflectedDamage = (damage: number): { holder: number; caster: number } => {
	if (damage <= 0) return { holder: 0, caster: 0 };
	return { holder: Math.max(1, Math.floor(damage / 2)), caster: Math.ceil(damage / 2) };
};

/*
 * The owner's counter to a Dragon's breath that is useful against anyone (roadmap 12, "Dragon
 * follow-ups", 2026-09-27): the next area attack aimed at the shielded monster turns back, the
 * holder takes half, and half hits the caster. Spent on use.
 *
 * What counts as "an area attack": a card with an `areaDamage(caster)` method. Blast (and so
 * Blast II and Sandstorm, which extend it), Fire Breath and Tsunami have one, and nothing
 * else does. The spec's four cards are exactly the AOE damage cards; the other two AOE-class
 * cards are not attacks (Mesmerize is a hold, Prion Disease mostly heals), so the class tag
 * alone would catch the wrong things, and a new area attack opts in by writing the method.
 * "Aimed at you" means this monster is one of the card's targets (a cone that reaches you, a
 * Blast at everyone): the shield turns back the share of the attack that was coming for it.
 * Everyone else the card reaches is still hit as normal.
 *
 * What turns back is the damage, not the riders. The holder skips Fire Breath's dodge roll
 * (it is a flat split), takes no burn, and is not confused by a Sandstorm; the caster takes
 * half the damage and none of the riders either. The riders were the dangerous part of those
 * cards, and sending them back too would make the card a coin-flip bomb.
 *
 * Edge cases, so they are decided once:
 *   - The caster is the holder (a confused Blast at yourself, a Tsunami's own wave): not aimed
 *     at you by someone else. The shield stays up and the attack resolves as normal.
 *   - The caster is already dead when the attack reaches the holder: the shield stays up and
 *     the attack resolves as normal. There is nobody to send half back to.
 *   - The caster is an ally (a Tsunami reaches teammates): it still turns back. The wave was
 *     coming for you, and the card does not read teams.
 *   - Both halves land, holder's first, even if the holder's own half fells it. The reflected
 *     half that kills the caster is credited to the holder, and the caster's attack ends
 *     there: anyone the card had not reached yet is spared.
 *   - Two Mirror Shields on one monster: the second finds it already shielded and does
 *     nothing, the rule Dissonant Voice and Take Wing use. A shield is one use, not a stack of
 *     uses, so it can never absorb two attacks.
 *   - It does not lapse. It waits until an area attack comes or the fight ends: encounter
 *     effects never outlive the fight, so it is never serialized.
 *
 * Player-facing lines are placeholders for the orchestrator (`DRAFT(39)`).
 */
export class MirrorShieldCard extends BaseCard {
	static cardType = 'Mirror Shield';
	static permittedClassesAndTypes = [FIGHTER, BARD];
	static probability = UNCOMMON.probability;
	// DRAFT(39)
	static description = 'A polished shield that turns an area attack back on the one who cast it.';
	static level = 1;
	static cost = CHEAP.cost;

	constructor({ icon = '🪞' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		// DRAFT(39)
		return `Raise the shield. The next area attack aimed at you (Blast, Fire Breath, Sandstorm, Tsunami) turns back: you take half the damage, and half hits whoever cast it. Burns and confusion are turned away. Used up when it turns an attack; it waits until one comes.`;
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	/** Puts the shield up on `holder`. */
	raise(holder: any, ring: any): void {
		let fallen = false;

		const mirror = async ({ card, phase, player }: any) => {
			if (phase !== DEFENSE_PHASE || player === holder || typeof card.effect !== 'function') return card;
			if (typeof card.areaDamage !== 'function') return card;

			// Wrapped once for every target of this one play, as Take Wing wraps a blow: the
			// holder's share is turned back, the rest of the card is untouched.
			const { effect } = card;
			card.effect = async (attacker: any, target: any, ...rest: any[]) => {
				// The caster fell to its own reflection earlier in this attack: it goes no further.
				if (fallen) return true;
				if (target !== holder || !isMirrorShielded(holder) || attacker === holder || attacker.dead) {
					return effect.call(card, attacker, target, ...rest);
				}

				holder.encounterEffects = holder.encounterEffects.filter((entry: any) => entry !== mirror);
				const { holder: back, caster: forth } = splitReflectedDamage(card.areaDamage(attacker));

				this.emit('narration', {
					// DRAFT(39)
					narration: `${this.icon} ${holder.givenName}'s shield catches ${attacker.givenName}'s ${card.cardType} and turns it back! ${holder.givenName} takes ${back} damage; ${attacker.givenName} takes ${forth} damage.`,
				});
				await subEventDelay(ring?.pacingMultiplier);

				let holderAlive = true;
				if (back > 0) holderAlive = await holder.hit(back, attacker, card);
				if (forth > 0) {
					// The line names who is hit and by what; cleared once it is announced (Tsunami does the same).
					(this as any).flavorText = `${holder.icon} ${this.icon}  ${attacker.givenName} takes ${forth} damage from the reflection.`;
					try {
						await attacker.hit(forth, holder, this);
					} finally {
						delete (this as any).flavorText;
					}
					if (attacker.dead) fallen = true;
				}
				return holderAlive;
			};
			return card;
		};

		mirror.effectType = MIRROR_SHIELD_EFFECT;
		holder.encounterEffects = [...holder.encounterEffects, mirror];
	}

	async effect(player: any, target: any, ring?: any): Promise<boolean> {
		if (isMirrorShielded(target)) {
			this.emit('narration', {
				// DRAFT(39)
				narration: `${target.givenName}'s shield is already raised.`,
			});
			return true;
		}

		this.emit('narration', {
			// DRAFT(39)
			narration:
				player === target
					? `${this.icon} ${player.givenName} raises a polished shield. The next area attack aimed at ${player.pronouns.him} will turn back.`
					: `${this.icon} In confusion, ${player.givenName} holds a shield up for ${target.givenName}. The next area attack aimed at ${target.pronouns.him} will turn back.`,
		});
		this.raise(target, ring);
		await subEventDelay(ring?.pacingMultiplier);

		return true;
	}
}

export default MirrorShieldCard;
