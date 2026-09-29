import { HitCard } from './hit.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { DRAGON } from '../constants/creature-types.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';
import { chance } from '../helpers/chance.js';

const { roll } = chance;

/*
 * The dragon makes its own Hit, and if that lands on a target that still stands, the tail
 * follows with a second, weaker blow. Modelled on the Unconquerable Horn's companion strike
 * (cards/unconquerable-horn.ts): the tail is an attack profile in class settings
 * (`tailHitPenalty`, `tailDamageDice`) so the balance harness can try values. It rolls
 * without crits, so it can never trigger a stroke of luck or Curse of Loki. A kill by the
 * tail is credited to the dragon (it is the dragon's tail).
 *
 * Player-facing text (written by the orchestrator, roadmap 35 task 8; owner, 2026-09-29: Norse and
 * Viking voice, a little Roman welcome, short verses, dad jokes). Topsell (The Historie of
 * Serpents, 1608) puts a dragon's strength in its tail rather than its teeth; the verse is an
 * original alliterative quatrain in the manner of the Eddas ("wyrm" is the old word for
 * dragon). The mead-horns are the pack's running joke about what a dragon breaks.
 */
export class TailLashCard extends HitCard {
	static cardType = 'Tail Lash';
	static permittedClassesAndTypes = [DRAGON];
	static probability = UNCOMMON.probability;
	static description =
		'Tooth for the foeman, tail for the fool; the wise watch the far end of the wyrm. Topsell says a dragon\'s strength lies not in its teeth but in its tail, which is why the Vikings who shout at dragons stand at the front.';
	static level = 1;
	static cost = REASONABLE.cost;
	/** Taken off the tail's 1d20 + STR modifier attack roll; a class setting for the harness. */
	static tailHitPenalty = 2;
	/** The tail's damage; a class setting for the harness. */
	// 1d6 since roadmap 35 (measured 2026-09-29): with 1d4 it trailed a Hit at level 7.
	static tailDamageDice = '1d6';
	static flavors = {
		hits: [
			['rakes', 80],
			['snaps at', 60],
			['bites', 50],
		],
	};

	/** Set when this play's own hit landed (see `onLanded`). Reset at the top of each `effect`. */
	private hitLanded = false;

	constructor({ icon = '🐉', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest } as any);
	}

	override get stats(): string {
		const { tailHitPenalty, tailDamageDice } = this.constructor as typeof TailLashCard;
		return `Hit: ${this.attackDice} vs ${this.targetProp} / Damage: ${this.damageDice}. If the hit lands and the target is still standing, the tail strikes too (1d20 + your STR modifier - ${tailHitPenalty} to hit, ${tailDamageDice} damage, no critical hits).`;
	}

	protected override async onLanded(): Promise<void> {
		this.hitLanded = true;
	}

	/** The tail's blow. Returns whether the target is still standing. */
	async tailStrike(player: any, target: any, ring?: any): Promise<boolean> {
		const { tailHitPenalty, tailDamageDice } = this.constructor as typeof TailLashCard;
		const label = `${player.givenName}'s tail`;

		this.emit('narration', {
			narration: `${this.icon} And then the tail comes round.`,
		});
		await subEventDelay(ring?.pacingMultiplier);

		// No `crit`: a natural 20 or 1 means nothing to the tail.
		const attackRoll = roll({
			primaryDice: '1d20',
			modifier: player.strModifier - tailHitPenalty,
		});
		const { success } = this.checkSuccess(attackRoll, target.ac);
		this.emit('rolled', {
			reason: `vs ${target.givenName}'s ac (${target.ac}) to determine if the tail struck true.`,
			card: this,
			roll: attackRoll,
			who: { givenName: label, icon: this.icon },
			outcome: success ? 'Hit!' : 'Miss...',
			vs: target.ac,
		});
		await subEventDelay(ring?.pacingMultiplier);

		if (!success) {
			this.emit('narration', {
				narration: `${this.icon} The tail misses ${target.givenName} and clears a whole table of mead-horns instead.`,
			});
			return !target.dead;
		}

		const damageRoll = roll({ primaryDice: tailDamageDice });
		damageRoll.result = Math.max(1, damageRoll.result);
		this.emit('rolled', {
			reason: 'for damage.',
			card: this,
			roll: damageRoll,
			who: { givenName: label, icon: this.icon },
		});
		await subEventDelay(ring?.pacingMultiplier);

		// Credited to the dragon (a killing blow needs a real creature for `die()` to record).
		(this as any).flavorText = `${player.icon} ${this.icon} ${target.icon}  ${label} cracks across ${target.givenName} for ${damageRoll.result} damage.`;
		try {
			return await target.hit(damageRoll.result, player, this);
		} finally {
			delete (this as any).flavorText;
		}
	}

	override async effect(player: any, target: any, ring?: any, activeContestants?: any): Promise<any> {
		this.hitLanded = false;
		const alive = await super.effect(player, target, ring, activeContestants);
		const landed = this.hitLanded;
		this.hitLanded = false;

		// The tail follows a landed hit on a target still standing. A confused dragon hitting
		// itself lashes nobody, and a dragon felled by its own blow has no tail to swing.
		if (!landed || !alive || target.dead || player.dead || target === player) return alive;

		return this.tailStrike(player, target, ring);
	}
}

export default TailLashCard;
