import { HitCard } from './hit.js';
import { BARBARIAN } from '../constants/creature-classes.js';
import { chance } from '../helpers/chance.js';
import { COMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';
import { subEventDelay } from '../helpers/delay-times.js';

const { roll } = chance;

export class BerserkCard extends HitCard {
	static cardType = 'Berserk';
	static permittedClassesAndTypes = [BARBARIAN];
	static probability = COMMON.probability;
	static description =
		'The whole world disappears into a beautiful still, silent, red. At the center of all things is the perfect face of your enemy. Destroy it.';
	static level = 1;
	static cost = REASONABLE.cost;
	static defaults = {
		...HitCard.defaults,
		damage: 1,
		bigFirstHit: false,
	};
	static flavors = {
		hits: [
			['punches', 80],
			['smacks', 70],
			['back-fists', 70],
			['upper-cuts', 70],
			['head-butts', 50],
			['puts a boot to the face of', 50],
			['back-hands', 50],
			['elbows', 30],
			['cupped-hand-smacks the ear of', 30],
			['fist-to-face cuddles', 20],
			['nose-honks', 5],
			['eye-pokes', 5],
		],
	};

	cumulativeComboDamage = 0;
	initialDamage = 0;
	iterations = 0;
	damageAmount = 0;
	intBonusFatigue = 0;

	constructor({
		bigFirstHit,
		damage,
		icon = '😤',
		...rest
	}: Record<string, any> = {}) {
		super({ icon, ...rest } as any);
		this.setOptions({ bigFirstHit, damage } as any);
		this.resetCard();
	}

	set bigFirstHit(bigFirstHit: boolean) {
		this.setOptions({ bigFirstHit } as any);
	}

	get bigFirstHit(): boolean {
		return (this.options as any).bigFirstHit;
	}

	resetCard(): void {
		this.cumulativeComboDamage = 0;
		this.initialDamage = 0;
		this.iterations = 0;
		this.resetDamage();
		this.resetFatigue();
	}

	resetFatigue(): void {
		this.intBonusFatigue = 0;
	}

	increaseFatigue(): void {
		this.intBonusFatigue += 1;
	}

	resetDamage(): void {
		this.damageAmount = (this.options as any).damage;
	}

	increaseDamage(): void {
		this.damageAmount += 1;
	}

	override get stats(): string {
		let damageDescription = `${this.damageAmount} damage per hit.`;
		if (this.bigFirstHit) {
			damageDescription = `${this.damageDice} damage on first hit.\n${this.damageAmount} damage per hit after that.`;
		}
		// The roll adds dex (getAttackRollBonus). This text said "+ str bonus" and nothing
		// rolled str; it now says what the roll does (owner, 2026-10-14). Str is on roadmap 11.
		return `Hit: ${this.attackDice} + dex vs ac on first hit\nthen also + int bonus (fatigued by 1 each subsequent hit) until you miss,\nor until the combo has done half the target's max hp\n${damageDescription}\n\nStroke of luck increases damage per hit by 1.`;
	}

	override getDamageRoll(): any {
		return roll({ primaryDice: this.damageDice });
	}

	getAttackRollBonus(player: any): number {
		let modifier = player[`${this.attackStat}Modifier`];
		if (this.iterations > 1) {
			modifier += Math.max(player.intModifier - this.intBonusFatigue, 0);
		}
		return modifier;
	}

	override getAttackRoll(player: any, target?: any): any {
		const modifier = this.getAttackRollBonus(player);
		return roll({
			primaryDice: this.attackDice,
			modifier,
			bonusDice: player.bonusAttackDice,
			crit: true,
		});
	}

	/*
	 * The combo swings until it misses, and until it has done enough (bug 259, fight #137
	 * in production, 2026-11-07). Three things went wrong together there:
	 * - Once the combo had dealt half the target's max hp, HUMILIATION stopped applying
	 *   damage but kept swinging. Against a pinned target every swing rolls with advantage,
	 *   so only a double 1 (1 in 400) ended it: 282 swings, ~560 feed lines.
	 * - Those no-damage swings still added to the "total damage" in the summary (4,927
	 *   claimed, 24 dealt), and each natural 20 kept raising the per-hit damage.
	 * - The double 1 finally came, and the target, by then long fallen, "flung the attack
	 *   back" for 27 and killed the attacker, turning a win into a draw.
	 * So HUMILIATION now ends the combo, the summary counts only damage dealt, and a fallen
	 * target cannot fling anything back. Beating a fallen body is still allowed until
	 * HUMILIATION: that is how a big first hit destroys a monster (Battle Focus).
	 *
	 * Every swing is paced like a Hit (a beat after the roll, another after the blow): the
	 * loop used to await nothing, so a whole combo arrived in one burst.
	 */
	async effectLoop(
		iteration: number,
		player: any,
		target: any,
		ring: any,
		activeContestants: any
	): Promise<any> {
		this.iterations = iteration;

		if (iteration > 2) this.increaseFatigue();

		const { attackRoll, success, strokeOfLuck, curseOfLoki } = this.hitCheck(
			player,
			target
		);
		await subEventDelay(ring?.pacingMultiplier);

		if (strokeOfLuck) {
			this.increaseDamage();
			this.resetFatigue();
		}

		if (success) {
			let damage = this.damageAmount;
			if (iteration === 1 && this.bigFirstHit) {
				damage = this.rollForDamage(player, target, strokeOfLuck).result;
			}

			if (
				iteration !== 1 &&
				this.cumulativeComboDamage + damage > Math.floor(target.maxHp / 2)
			) {
				return this.endCombo(iteration - 1, target, ring, 'HUMILIATION! ');
			}

			if (iteration !== 1) {
				this.cumulativeComboDamage += damage;
			} else {
				this.initialDamage = damage;
			}

			await target.hit(damage, player, this);
			await subEventDelay(ring?.pacingMultiplier);

			return this.effectLoop(
				iteration + 1,
				player,
				target,
				ring,
				activeContestants
			);
		} else if (curseOfLoki && !target.dead) {
			let damage = this.damageAmount;
			if (iteration === 1 && this.bigFirstHit) {
				damage = this.rollForDamage(target, player).result;
			}

			this.emit('narration', {
				narration: `COMBO BREAKER!  (Broke a ${iteration - 1} hit combo, ${this.initialDamage + this.cumulativeComboDamage} total damage)`,
			});

			this.resetCard();
			return player.hit(damage, target, this);
		}

		this.emit('miss', {
			attackResult: attackRoll.result,
			attackRoll,
			player,
			target,
		});

		return this.endCombo(iteration - 1, target, ring);
	}

	/** The combo's closing line, then a clean card for the next play. */
	async endCombo(hits: number, target: any, ring: any, prefix = ''): Promise<boolean> {
		if (hits > 0 || prefix) {
			const comboText = hits > 2 ? 'COMBO! ' : '';
			const ultraText = hits > 4 ? 'ULTRA ' : '';
			this.emit('narration', {
				narration: `${prefix}${target.dead ? 'ULTIMATE ' : ultraText}${comboText}${hits} HIT${hits > 1 ? 'S' : ''} (${this.initialDamage + this.cumulativeComboDamage} total damage).`,
			});
		}

		this.resetCard();
		return ring.channelManager
			.sendMessages()
			.then(() => !target.dead);
	}

	override async effect(
		player: any,
		target: any,
		ring: any,
		activeContestants?: any
	): Promise<any> {
		this.resetCard();
		this.cumulativeComboDamage = 0;
		return this.effectLoop(1, player, target, ring, activeContestants);
	}
}

export default BerserkCard;
