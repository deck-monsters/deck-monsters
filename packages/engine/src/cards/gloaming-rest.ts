import { BaseCard, type CardOptions } from './base.js';
import { chance } from '../helpers/chance.js';
import { hitLogTimestamp, subEventDelay } from '../helpers/delay-times.js';
import { agree } from '../helpers/pronouns.js';
import { capitalize } from '../helpers/capitalize.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import { GLOAMING_REST_EFFECT } from '../constants/effect-types.js';
import { UNICORN } from '../constants/creature-types.js';
import { CLERIC } from '../constants/creature-classes.js';
import { HEAL } from '../constants/card-classes.js';
import { RARE } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';

const { roll } = chance;

export const REST_AC_PENALTY = 2;
const REST_HEALTH_DICE = '3d4';
const GROWING_REST_TURNS = 3;
const RANGED_REST_MIN = 4;

/*
 * Edwin Julian's comic verse "The Capture of the Unicorn" (illustrated by Reginald Birch;
 * via the anthology A Book of Unicorns, Green Tiger Press) has a unicorn roaming "in the
 * gloaming" through rocky gorges, kneeling before someone carrying flowers from beneath a
 * laurel, and falling asleep. The poem and the old capture stories turn that on virtue and
 * a virginity test; this card keeps only the freely chosen trust and the risk of resting in
 * the open. No target, no gender or "purity" check, and no sleep effect on anyone else.
 *
 * The description quotes Topsell (1607, p. 719, as quoted by the Edward Worth Library),
 * where unicorns "growe tame, and come and sleepe beside them", and the hunters come.
 * The line is cut before Topsell names who "them" are, so the card keeps trust and rest
 * and never the purity test. Narration plays on the same story: the hunters listen, wait,
 * or do not come. See docs/archive/roadmap/28-unicorn-voice-punch-up.md.
 */
export class GloamingRestCard extends BaseCard {
	static cardClass = [HEAL];
	static cardType = 'Gloaming Rest';
	static permittedClassesAndTypes = [UNICORN, CLERIC];
	static probability = RARE.probability;
	static description =
		'"At the sight of them they growe tame, and come and sleepe beside them." And then the hunters come. Rest, and beware.';
	static level = 3;
	static cost = REASONABLE.cost;
	/**
	 * What an undisturbed rest restores. The owner's call (2026-09-29, roadmap 35): kneeling in
	 * the open is a huge risk, so the reward is huge too, and a broken rest heals nothing. At
	 * 3d4 (`dice`) the card was worth almost nothing in a duel, where damage nearly always comes
	 * before your next card. Shapes being measured, the same for bosses and players (owner):
	 * `full` restores every hit point; `half` restores half of what is missing; `two-turns`
	 * rests through two of your cards, then restores every hit point; `growing` heals 3d4 at
	 * your next card, 6d4 at the one after, 9d4 at the third, while nothing disturbs you, and
	 * keeps what it healed if the rest is broken; `ranged` heals a random amount from 4 to half
	 * the monster's max hp, never more than it is missing. The -2 AC lasts as long as the rest.
	 */
	static restShape: 'full' | 'half' | 'two-turns' | 'growing' | 'dice' | 'ranged' = 'full';
	/**
	 * What a broken rest leaves behind (owner, 2026-09-29): the hunted unicorn wakes in wrath.
	 * `advantage`: its next card that rolls to hit rolls twice and keeps the better;
	 * `advantage-damage`: that and +`rageDamage` damage. `none` is the plain broken rest.
	 * Class settings for the harness (roadmap 35).
	 */
	static brokenRestRage: 'none' | 'advantage' | 'advantage-damage' = 'none';
	static rageDamage = 2;

	constructor({ icon = '🌙' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		switch ((this.constructor as typeof GloamingRestCard).restShape) {
			case 'two-turns':
				return `Kneel to rest: -${REST_AC_PENALTY} ac until your second card from now.
If nothing damages you before then, heal to full hp as that card begins. Any damage interrupts the rest and the healing is lost.`;
			case 'growing':
				return `Kneel to rest: -${REST_AC_PENALTY} ac while you rest, for up to ${GROWING_REST_TURNS} of your cards.
As each card begins, if nothing has damaged you, heal 3d4, then 6d4, then 9d4. Any damage ends the rest; you keep what you healed.`;
			default: {
				const heal = {
					full: 'heal to full hp',
					half: 'heal half your missing hp',
					dice: `heal ${REST_HEALTH_DICE}`,
					ranged: `heal between ${RANGED_REST_MIN} hp and half your max hp (never more than you are missing)`,
				}[(this.constructor as typeof GloamingRestCard).restShape as 'full' | 'half' | 'dice' | 'ranged'];
				return `Kneel to rest: -${REST_AC_PENALTY} ac until your next card.
If nothing damages you before then, ${heal} as that card begins. Any damage interrupts the rest and the healing is lost${(this.constructor as typeof GloamingRestCard).brokenRestRage === 'none' ? '' : `, but you wake in wrath: your next card that rolls to hit rolls twice and keeps the better${(this.constructor as typeof GloamingRestCard).brokenRestRage === 'advantage-damage' ? `, for +${(this.constructor as typeof GloamingRestCard).rageDamage} damage` : ''}`}.`;
			}
		}
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	/**
	 * Give the full penalty back. The penalty shares `encounterModifiers.ac` with a brace,
	 * which melee hits spend, but a flat +2 is still right in every case: a brace raised
	 * during the rest was only ever reduced by the penalty, so whatever part of it the hits
	 * did not spend comes back whole. An earlier clamp here ("only give back what is still
	 * missing") lost the 2 AC for the rest of the fight whenever a brace was already up.
	 */
	restoreAc(target: any): void {
		target.setModifier('ac', REST_AC_PENALTY);
	}

	/**
	 * Wrath on waking: `card` (the per-play clone, so nothing leaks into the deck) rolls to hit
	 * with advantage, and with `advantage-damage` hits harder. A card that does not roll to
	 * hit passes the wrath on to the monster's next card that does.
	 */
	enrage(target: any, card: any): void {
		const { brokenRestRage, rageDamage } = this.constructor as typeof GloamingRestCard;
		const apply = (clone: any): boolean => {
			const { getAttackRoll, getDamageRoll } = clone;
			if (typeof getAttackRoll !== 'function') return false;
			// A curse of Loki is the worst roll and a natural 20 the best, whatever the totals.
			const rank = (r: any) => (r.curseOfLoki ? -Infinity : r.strokeOfLuck ? Infinity : r.result);
			clone.getAttackRoll = (...args: any[]) => {
				const first = getAttackRoll.apply(clone, args);
				const second = getAttackRoll.apply(clone, args);
				return rank(second) > rank(first) ? second : first;
			};
			if (brokenRestRage === 'advantage-damage' && typeof getDamageRoll === 'function') {
				clone.getDamageRoll = (...args: any[]) => {
					const damageRoll = getDamageRoll.apply(clone, args);
					damageRoll.modifier += rageDamage;
					damageRoll.result += rageDamage;
					return damageRoll;
				};
			}
			this.emit('narration', {
				narration: `${this.icon} ${target.givenName} striketh in wrath, and the horn is terrible (advantage${brokenRestRage === 'advantage-damage' ? `, +${rageDamage} damage` : ''}).`,
			});
			return true;
		};
		if (apply(card)) return;

		const wrath = ({ card: next, phase, player }: any) => {
			if (phase !== ATTACK_PHASE || player !== target) return next;
			if (apply(next)) {
				target.encounterEffects = target.encounterEffects.filter((effect: any) => effect !== wrath);
			}
			return next;
		};
		target.encounterEffects = [...target.encounterEffects, wrath];
	}

	/** HP the rest restores when it resolves undisturbed, for the shapes that heal once. */
	restHealAmount(target: any): number {
		const missing = Math.max(0, target.maxHp - target.hp);
		switch ((this.constructor as typeof GloamingRestCard).restShape) {
			case 'half': return Math.floor(missing / 2);
			case 'dice': return roll({ primaryDice: REST_HEALTH_DICE }).result;
			case 'ranged': {
				// Owner's shape (2026-09-29): somewhere between a little and half the monster,
				// never more than it is missing, so one rest can never erase a whole lead.
				const low = Math.min(RANGED_REST_MIN, missing);
				const high = Math.min(Math.floor(target.maxHp / 2), missing);
				return low + Math.floor(Math.random() * (Math.max(high, low) - low + 1));
			}
			default: return missing;
		}
	}

	rest(target: any, ring: any): void {
		// hitLogTimestamp is the same clock creature.hit() stamps hits with (see DelayedHit),
		// so "hit after the rest began" compares like with like, including in tests.
		const since = hitLogTimestamp();
		const pacing = ring?.pacingMultiplier;
		const { restShape, brokenRestRage } = this.constructor as typeof GloamingRestCard;
		let turns = 0;

		const resting = async ({ card, phase, player }: any) => {
			if (phase !== ATTACK_PHASE || player !== target) return card;
			turns += 1;

			const wake = () => {
				target.encounterEffects = target.encounterEffects.filter(
					(effect: any) => effect !== resting
				);
				this.restoreAc(target);
			};

			const hitLog: any[] = (target.encounterModifiers.hitLog as any[]) || [];
			// `dealt` is the HP a blow actually took; a hit the brace absorbed in full does not
			// disturb the rest. Entries without it predate the field and count at face value.
			const interrupted = hitLog.some(
				({ when, damage, dealt }) => when > since && (dealt ?? damage) > 0
			);

			if (interrupted && brokenRestRage !== 'none') {
				this.emit('narration', {
					narration: `${this.icon} The hunters were waiting! ${target.givenName} riseth from the laurel in a terrible wrath, horn lowered.`,
				});
				wake();
				this.enrage(target, card);
				await subEventDelay(pacing);
				return card;
			}

			if (interrupted) {
				this.emit('narration', {
					narration: `${this.icon} The hunters were waiting! ${target.givenName}'s rest is broken, and ${target.pronouns.he} ${agree(target.pronouns, 'rises', 'rise')} ${restShape === 'growing' && turns > 1 ? 'with what comfort the dusk gave' : 'without its comfort'}.`,
				});
				wake();
				await subEventDelay(pacing);
				return card;
			}

			if (restShape === 'two-turns' && turns < 2) {
				this.emit('narration', {
					narration: `${this.icon} The dusk deepens. ${target.givenName} sleepeth on among the laurel, and the hunters are listening still.`,
				});
				await subEventDelay(pacing);
				return card;
			}

			if (restShape === 'growing') {
				// Each undisturbed card heals more than the last: 3d4, then 6d4, then 9d4.
				const healRoll = roll({ primaryDice: `${3 * turns}d4` });
				const last = turns >= GROWING_REST_TURNS || target.hp + healRoll.result >= target.maxHp;
				this.emit('rolled', {
					reason: 'for a quiet rest.',
					card: this,
					roll: healRoll,
					who: target,
					outcome: last
						? `No hunter came. ${target.givenName} riseth from the laurel, restored.`
						: `No hunter came, and ${target.givenName} sleepeth on, the deeper for it.`,
				});
				await subEventDelay(pacing);
				await target.heal(healRoll.result);
				if (last) wake();
				return card;
			}

			const amount = this.restHealAmount(target);
			this.emit('narration', {
				narration: `${this.icon} No hunter came. ${target.givenName} riseth from the laurel, restored (${amount} hp).`,
			});
			await subEventDelay(pacing);
			if (amount > 0) await target.heal(amount);
			wake();

			return card;
		};

		resting.effectType = GLOAMING_REST_EFFECT;
		target.encounterEffects = [...target.encounterEffects, resting];
	}

	async effect(player: any, target: any, ring?: any): Promise<boolean> {
		const alreadyResting = target.encounterEffects.some(
			(effect: any) => effect.effectType === GLOAMING_REST_EFFECT
		);

		if (alreadyResting) {
			this.emit('narration', {
				narration: `${target.givenName} is already resting.`,
			});
			return true;
		}

		this.emit('narration', {
			narration:
				player === target
					// The subject is the monster's name, which is always singular; `agree` is only
					// for sentences whose subject is the pronoun ("they rise").
					? `${this.icon} As the light fails, ${player.givenName} kneels among the laurel and closes ${player.pronouns.his} eyes. Somewhere in the dusk, the hunters are listening.`
					: `${this.icon} In confusion, ${player.givenName} coaxes ${target.givenName} to kneel and rest.`,
		});
		target.setModifier('ac', -REST_AC_PENALTY);
		this.rest(target, ring);
		await subEventDelay(ring?.pacingMultiplier);

		return true;
	}
}

export default GloamingRestCard;
