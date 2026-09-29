import { BoostCard } from './boost.js';
import { DRAGON } from '../constants/creature-types.js';
import { BOOST, MELEE } from '../constants/card-classes.js';
import { flavor } from '../helpers/flavor.js';
import { chance } from '../helpers/chance.js';
import { rollWithModes } from './helpers/roll-mode.js';
import { subEventDelay } from '../helpers/delay-times.js';

const { roll } = chance;

/*
 * Asinine: of donkeys (Latin asinus), as feline is of cats; the pun is the point. A dragon's
 * companion is a donkey who carries the gold and never stops talking, a nod the owner chose
 * (2026-09-29) with nothing borrowed from any film: no names, lines, or designs. A beast of
 * burden, so it lends strength. Text written by the orchestrator (roadmap 35 task 8), carrying
 * the pack's joke about what a dragon eats that it shouldn't.
 */

export class AsinineCompanionCard extends BoostCard {
	static cardType = 'Asinine Companion';
	static permittedClassesAndTypes = [DRAGON];
	static description =
		'Every hero needs a faithful companion, and every dragon needs someone to carry the gold. The donkey talks the whole way. The dragon has not eaten him. Yet.';
	static level = 1;
	static defaults = {
		...BoostCard.defaults,
		boostAmount: 2,
		boostedProp: 'str',
	};

	/**
	 * The shipped shape: the card is played at an opponent and the donkey kicks it. Off, it
	 * boosts the dragon's STR instead (kept for the harness).
	 */
	// Roadmap 35 (measured 2026-09-29): as a +2 STR boost the card helped only at level 1; the
	// donkey's kick, growing with the dragon (1d8), is about a Hit at levels 1-5.
	static kick = true;
	/** The kick's bonus to hit, on 1d20 vs the target's AC; a class setting for the harness. */
	static kickHitBonus = 2;
	/** The kick's damage; a class setting for the harness. */
	static kickDamageDice = '1d8';
	/**
	 * When true, the kick grows with the dragon as its own strikes do: + its level to hit (to 10,
	 * where AC's growth nearly stops) and + half its level to damage. A class setting for the
	 * harness (roadmap 35): a flat kick fell further behind a Hit at every level.
	 */
	static kickScales = true;

	constructor({ icon = '🫏', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest });
	}

	/**
	 * The kick is a d20-vs-AC strike, so it is a MELEE attack: an ancient dragon's opponents may
	 * outwit it (`isAttackCard`) and a melee brace absorbs it. A Codex review of #411 found it
	 * still carried only BoostCard's BOOST class. The boost shape stays BOOST.
	 */
	override get cardClass(): string[] | undefined {
		const own = (this.options as any).cardClass as string[] | undefined;
		if (own) return own;
		return (this.constructor as typeof AsinineCompanionCard).kick ? [MELEE] : [BOOST];
	}

	override set cardClass(cardClass: string[] | undefined) {
		super.cardClass = cardClass;
	}

	override get stats(): string {
		const { kick, kickHitBonus, kickDamageDice } = this.constructor as typeof AsinineCompanionCard;
		if (kick) {
			const { kickScales } = this.constructor as typeof AsinineCompanionCard;
			return kickScales
				? `The donkey kicks your target: 1d20 + ${kickHitBonus} + your level (up to 10) vs ac, for ${kickDamageDice} + half your level damage on a hit. It never crits.`
				: `The donkey kicks your target: 1d20 + ${kickHitBonus} vs ac, for ${kickDamageDice} damage on a hit. It never crits.`;
		}
		return super.stats;
	}

	override getTargets(player: any, proposedTarget?: any, _ring?: any, _activeContestants?: any): any[] {
		const { kick } = this.constructor as typeof AsinineCompanionCard;
		if (kick) return [proposedTarget];
		return super.getTargets(player);
	}

	/** The donkey's kick, modelled on the Unconquerable Horn's companion strike. */
	async donkeyKick(player: any, target: any, ring?: any): Promise<boolean> {
		const { kickHitBonus, kickDamageDice } = this.constructor as typeof AsinineCompanionCard;
		const label = 'The donkey';

		this.emit('narration', {
			narration: `${this.icon} The donkey, who has talked the whole fight, stops talking at last and turns around.`,
		});
		await subEventDelay(ring?.pacingMultiplier);

		// No `crit`: a natural 20 or 1 means nothing to a donkey. Through the card's roll modes,
		// so a pinned target gives the kick advantage (roadmap 36).
		const { kickScales } = this.constructor as typeof AsinineCompanionCard;
		const levelBonus = kickScales ? Math.min(player.level ?? 0, 10) : 0;
		const attackRoll = rollWithModes(this, player, target, () =>
			roll({ primaryDice: '1d20', modifier: kickHitBonus + levelBonus }), { targetOnly: true }
		);
		const { success } = this.checkSuccess(attackRoll, target.ac);
		this.emit('rolled', {
			reason: `vs ${target.givenName}'s ac (${target.ac}) to determine if the kick landed.`,
			card: this,
			roll: attackRoll,
			who: { givenName: label, icon: this.icon },
			outcome: success ? 'Hit!' : 'Miss...',
			vs: target.ac,
		});
		await subEventDelay(ring?.pacingMultiplier);

		if (!success) {
			this.emit('narration', {
				narration: `${this.icon} The donkey kicks, misses ${target.givenName} entirely, and says that was a warning shot.`,
			});
			return !target.dead;
		}

		const damageRoll = roll({ primaryDice: kickDamageDice });
		if (kickScales) damageRoll.result += Math.floor((player.level ?? 0) / 2);
		damageRoll.result = Math.max(1, damageRoll.result);
		this.emit('rolled', {
			reason: 'for damage.',
			card: this,
			roll: damageRoll,
			who: { givenName: label, icon: this.icon },
		});
		await subEventDelay(ring?.pacingMultiplier);

		// The kill is credited to the dragon (`die()` needs a real creature); the line is the
		// donkey's own.
		(this as any).flavorText = `${player.icon} ${this.icon} ${target.icon}  The donkey plants both hind hooves in ${target.givenName} for ${damageRoll.result} damage.`;
		try {
			return await target.hit(damageRoll.result, player, this);
		} finally {
			delete (this as any).flavorText;
		}
	}

	override async effect(player: any, target: any, ring?: any): Promise<any> {
		const { kick } = this.constructor as typeof AsinineCompanionCard;
		if (kick) return this.donkeyKick(player, target, ring);
		return super.effect(player, target);
	}

	override getBoostNarrative(_player: any, target: any): string {
		const { text } = flavor.getFlavor('str' as any, {
			str: [
				['loads the gold onto the donkey and stands a little taller', 60],
				['lets the donkey carry the heavy things, which is everything', 40],
				['listens to the donkey\'s advice, ignores it, and feels stronger anyway', 30],
				['stops the donkey from eating the battle standard, and is proud of the restraint', 10],
			],
		} as any);
		return `${target.givenName} ${text}.`;
	}
}

export default AsinineCompanionCard;
