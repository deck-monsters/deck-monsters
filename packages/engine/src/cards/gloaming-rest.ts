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

const REST_AC_PENALTY = 2;
const REST_HEALTH_DICE = '3d4';

/*
 * Edwin Julian's poem (modern, via the supplied anthology) has a unicorn kneel and sleep in
 * the gloaming beside someone offering flowers. The old capture stories turn that on a
 * virginity test; this card keeps only the freely chosen trust and the risk of resting in
 * the open. No target, no gender or "purity" check, and no sleep effect on anyone else.
 */
export class GloamingRestCard extends BaseCard {
	static cardClass = [HEAL];
	static cardType = 'Gloaming Rest';
	static permittedClassesAndTypes = [UNICORN, CLERIC];
	static probability = RARE.probability;
	static description = 'Kneel among the laurel as the light goes. Trust that nobody strikes before you rise.';
	static level = 3;
	static cost = REASONABLE.cost;

	constructor({ icon = '🌙' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		return `Kneel to rest: -${REST_AC_PENALTY} ac until your next card.
If nothing damages you before then, heal ${REST_HEALTH_DICE} as that card begins. Any damage interrupts the rest and the healing is lost.`;
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	/**
	 * Give back the AC the rest took, but only what is still missing. The penalty shares
	 * `encounterModifiers.ac` with a brace, which melee hits spend; adding a flat +2 back
	 * after a brace was spent would hand out free AC. The cost is that a brace raised
	 * during the rest can come out up to the penalty short.
	 */
	restoreAc(target: any): void {
		const current = (target.encounterModifiers.ac as number) || 0;
		const giveBack = Math.min(REST_AC_PENALTY, Math.max(0, -current));
		if (giveBack > 0) target.setModifier('ac', giveBack);
	}

	rest(target: any, ring: any): void {
		// hitLogTimestamp is the same clock creature.hit() stamps hits with (see DelayedHit),
		// so "hit after the rest began" compares like with like, including in tests.
		const since = hitLogTimestamp();
		const pacing = ring?.pacingMultiplier;

		const resting = async ({ card, phase, player }: any) => {
			if (phase !== ATTACK_PHASE || player !== target) return card;

			target.encounterEffects = target.encounterEffects.filter(
				(effect: any) => effect !== resting
			);

			const hitLog: any[] = (target.encounterModifiers.hitLog as any[]) || [];
			const interrupted = hitLog.some(({ when, damage }) => when > since && damage > 0);

			if (interrupted) {
				this.emit('narration', {
					narration: `${this.icon} ${target.givenName}'s rest was broken. ${capitalize(target.pronouns.he)} ${agree(target.pronouns, 'rises', 'rise')} without its comfort.`,
				});
				this.restoreAc(target);
				await subEventDelay(pacing);
				return card;
			}

			const healRoll = roll({ primaryDice: REST_HEALTH_DICE });
			this.emit('rolled', {
				reason: 'for a quiet rest.',
				card: this,
				roll: healRoll,
				who: target,
				outcome: `${target.givenName} rises from the laurel, restored.`,
			});
			await subEventDelay(pacing);
			await target.heal(healRoll.result);
			this.restoreAc(target);

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
					? `${this.icon} As the light fails, ${player.givenName} ${agree(player.pronouns, 'kneels', 'kneel')} among the laurel and ${agree(player.pronouns, 'closes', 'close')} ${player.pronouns.his} eyes.`
					: `${this.icon} In confusion, ${player.givenName} coaxes ${target.givenName} to kneel and rest.`,
		});
		target.setModifier('ac', -REST_AC_PENALTY);
		this.rest(target, ring);
		await subEventDelay(ring?.pacingMultiplier);

		return true;
	}
}

export default GloamingRestCard;
