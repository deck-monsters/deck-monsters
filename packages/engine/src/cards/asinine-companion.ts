import { BoostCard } from './boost.js';
import { DRAGON } from '../constants/creature-types.js';
import { flavor } from '../helpers/flavor.js';
import { chance } from '../helpers/chance.js';
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
	 * Alternative shape for the harness (default off, today's behaviour): the card is played at
	 * an opponent and the donkey kicks it, instead of boosting the dragon's STR.
	 */
	static kick = false;
	/** The kick's bonus to hit, on 1d20 vs the target's AC; a class setting for the harness. */
	static kickHitBonus = 2;
	/** The kick's damage; a class setting for the harness. */
	static kickDamageDice = '1d6';

	constructor({ icon = '🫏', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest });
	}

	override get stats(): string {
		const { kick, kickHitBonus, kickDamageDice } = this.constructor as typeof AsinineCompanionCard;
		if (kick) {
			return `The donkey kicks your target: 1d20 + ${kickHitBonus} vs ac, for ${kickDamageDice} damage on a hit. It never crits, and there is no strength boost.`;
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

		// PLACEHOLDER narration; the orchestrator writes the real line.
		this.emit('narration', { narration: `${this.icon} The donkey lines up a kick.` });
		await subEventDelay(ring?.pacingMultiplier);

		// No `crit`: a natural 20 or 1 means nothing to a donkey.
		const attackRoll = roll({ primaryDice: '1d20', modifier: kickHitBonus });
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
			// PLACEHOLDER narration; the orchestrator writes the real line.
			this.emit('narration', {
				narration: `${this.icon} The kick misses. ${target.givenName} is untouched.`,
			});
			return !target.dead;
		}

		const damageRoll = roll({ primaryDice: kickDamageDice });
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
		// PLACEHOLDER hit line; the orchestrator writes the real one.
		(this as any).flavorText = `${player.icon} ${this.icon} ${target.icon}  The donkey kicks ${target.givenName} for ${damageRoll.result} damage.`;
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
