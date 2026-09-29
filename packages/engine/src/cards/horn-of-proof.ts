import { BaseCard, type CardOptions } from './base.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { UNICORN } from '../constants/creature-types.js';
import { CLERIC } from '../constants/creature-classes.js';
import { HEAL } from '../constants/card-classes.js';
import { armControlWard } from './helpers/control-ward.js';
import { BAD_BATCH_EFFECT, EXPOSED_EFFECT, GLOAMING_REST_EFFECT, WINDED_EFFECT } from '../constants/effect-types.js';
import { REST_AC_PENALTY } from './gloaming-rest.js';
import { WINDED_AC_PENALTY } from './fire-breath.js';
import { EXPOSED_AC_PENALTY } from './helpers/ancient-dragon.js';

/**
 * Temporary AC penalties that give themselves back on the monster's next card. They are not
 * curses: lifting one here would leave its effect to add the points back on top, a free
 * bonus for the rest of the fight. Gloaming Rest shipped with this guard; Fire Breath's
 * winded and an ancient dragon's exposed were missed until a review of PR #402 (a Sandstorm-
 * redirected Horn of Proof on a winded Dragon left it +2 AC for the fight).
 */
const TEMPORARY_AC_PENALTIES: Record<string, number> = {
	[GLOAMING_REST_EFFECT]: REST_AC_PENALTY,
	[WINDED_EFFECT]: WINDED_AC_PENALTY,
	[EXPOSED_EFFECT]: EXPOSED_AC_PENALTY,
};
import { RARE } from '../helpers/probabilities.js';
import { CHEAP } from '../helpers/costs.js';

// Fixed and deliberately small: the cleanse and the ward are the point, and the heal must
// stay weaker than a dedicated Heal (1d4 + int, which also scales with level).
const HORN_OF_PROOF_HEAL = 3;

// The stats a curse such as Soften pushes below zero for the rest of the fight.
const CURSABLE_STATS = ['ac', 'dex', 'str', 'int'];

/*
 * Ctesias (Indica, ancient report) says those who drink from cups made of the horn are
 * protected from poison and convulsions. That is a claim about a mythical animal, not
 * medicine: the card is a fantasy cleanse, and its copy says what it removes in the game.
 *
 * What it can remove is an explicit list, because the engine has no shared "harmful
 * effect" flag. In priority order, it removes the first one it finds:
 *   1. a hold on the target (any ImmobilizeEffect, including Coil's ongoing damage). A held
 *      monster's own card never plays, so this only happens when the card lands on someone
 *      else: confusion today, ally targeting if a team-heal rule is ever added. The stats
 *      text says so rather than promising a self-cleanse that cannot happen;
 *   2. the target's harshest negative encounter stat penalty (Soften and similar curses);
 *   3. a Bad Batch waiting in the ring to turn the next drink to poison.
 *
 * The ward (owner, 2026-09-29, roadmap 35 task 5): the owner wanted Horn of Proof to be "the
 * do everything card", so the one-round counterspell that briefly belonged to the Unconquerable
 * Horn lives here now (cards/helpers/control-ward.ts has the rules; that card became a rally
 * call). After the cleanse the drinker is warded for one round against the next harmful,
 * non-damage effect an opponent puts on them, once per fight, and then healed. The cup that
 * draws poison out also keeps it from taking: Topsell's "doth wonderfully help against
 * poisons" read forward in time.
 *
 * Player-facing lines (docs/archive/roadmap/28-unicorn-voice-punch-up.md): the description quotes
 * Topsell (1607, p. 721), the horn "doth wonderfully help against poisons", beside his
 * retelling of kings who drank from horn cups. The frothing cup is Pare's water test
 * (Discours de la licorne, 1582), which Pare records in order to deny it.
 */
export class HornOfProofCard extends BaseCard {
	static cardClass = [HEAL];
	static cardType = 'Horn of Proof';
	static permittedClassesAndTypes = [UNICORN, CLERIC];
	static probability = RARE.probability;
	static description =
		'Kings drank from such horns and feared no cup, for the horn "doth wonderfully help against poisons."';
	static level = 2;
	static cost = CHEAP.cost;
	/** The heal after the cleanse; a class setting so the balance harness can try values (roadmap 35). */
	static healAmount = HORN_OF_PROOF_HEAL;

	constructor({ icon = '🏺' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		return `Drink from the horn: remove one harm already on you (your worst stat penalty, or a Bad Batch waiting in the ring; if turned on someone held, it frees them), then ward yourself for one round against the next harmful effect an opponent puts on you that is not damage (a hold, a curse, poison, being blinked away, or being confused). Then heal ${(this.constructor as typeof HornOfProofCard).healAmount} hp. The ward works once per fight.`;
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	cleanseHold(target: any): boolean {
		const held = target.encounterEffects.some(
			(effect: any) => effect.effectType === 'ImmobilizeEffect'
		);
		if (!held) return false;

		target.encounterEffects = target.encounterEffects.filter(
			(effect: any) => effect.effectType !== 'ImmobilizeEffect'
		);
		target.encounterModifiers.immobilizedTurns = 0;
		this.emit('narration', {
			narration: `${this.icon} The horn toucheth the bonds, and they fall away. ${target.givenName} is free.`,
		});
		return true;
	}

	cleanseCurse(target: any): boolean {
		// Temporary penalties in progress (a rest, winded, exposed) are not curses; count only
		// what lies beyond them. See TEMPORARY_AC_PENALTIES.
		const temporaryAc = target.encounterEffects.reduce(
			(sum: number, effect: any) => sum + (TEMPORARY_AC_PENALTIES[effect.effectType] ?? 0),
			0
		);
		let worstStat: string | undefined;
		let worstAmount = 0;
		for (const stat of CURSABLE_STATS) {
			let amount = (target.encounterModifiers[stat] as number) || 0;
			if (stat === 'ac') amount = Math.min(0, amount + temporaryAc);
			if (amount < worstAmount) {
				worstStat = stat;
				worstAmount = amount;
			}
		}
		if (!worstStat) return false;

		this.emit('narration', {
			narration: `${this.icon} The horn draweth out the curse on ${target.givenName}'s ${worstStat}, as it draweth poison from the cup.`,
		});
		target.setModifier(worstStat, -worstAmount);
		return true;
	}

	cleanseRing(target: any, ring: any): boolean {
		const effects: any[] = ring?.encounterEffects ?? [];
		const index = effects.findIndex((effect: any) => effect.effectType === BAD_BATCH_EFFECT);
		if (index < 0) return false;

		// One cleanse removes one batch; any others stay queued.
		ring.encounterEffects = [...effects.slice(0, index), ...effects.slice(index + 1)];
		this.emit('narration', {
			narration: `${this.icon} ${target.givenName} dips the horn in the cups in the ring. One cup froths and hisses; that bad batch is poured away.`,
		});
		return true;
	}

	/**
	 * Arms the one-round counterspell on `target` and says so. Confusion can point the horn at
	 * someone else; the ward then goes to them, as it did when the Unconquerable Horn carried it.
	 */
	ward(player: any, target: any): void {
		const result = armControlWard(target, this.emit.bind(this));
		let narration: string;

		if (result === 'armed') {
			narration =
				player === target
					? `${this.icon} ${player.givenName} sets ${player.pronouns.his} lips to the horn, and no poison shall pass it. The next harm laid on ${player.pronouns.him} this round will not take.`
					: `${this.icon} In confusion, ${player.givenName} passeth the horn to ${target.givenName}. The next harm laid on ${target.pronouns.him} this round will not take.`;
		} else if (result === 'already-armed') {
			narration = `${this.icon} ${target.givenName} hath drunk already, and standeth warded.`;
		} else {
			narration = `${this.icon} ${target.givenName} has already been warded once this fight. The horn wardeth not twice.`;
		}

		this.emit('narration', { narration });
	}

	async effect(player: any, target: any, ring?: any): Promise<boolean> {
		const cleansed =
			this.cleanseHold(target) || this.cleanseCurse(target) || this.cleanseRing(target, ring);

		if (!cleansed) {
			this.emit('narration', {
				narration: `${this.icon} The horn findeth nothing here to purify.`,
			});
		}
		await subEventDelay(ring?.pacingMultiplier);

		this.ward(player, target);
		await subEventDelay(ring?.pacingMultiplier);

		return target.heal((this.constructor as typeof HornOfProofCard).healAmount);
	}
}

export default HornOfProofCard;
