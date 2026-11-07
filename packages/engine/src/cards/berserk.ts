import { HitCard } from './hit.js';
import { BARBARIAN } from '../constants/creature-classes.js';
import { chance } from '../helpers/chance.js';
import { COMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';
import { subEventDelay } from '../helpers/delay-times.js';

const { roll } = chance;

/** Swings after HUMILIATION before the berserker takes a bow (bug 259). */
const MAX_SHOWBOATS = 3;
/** What a showboat swing does instead of damage; `{player} {flourish} {target}.` */
const SHOWBOATS = ['flicks the ear of', 'pats the head of', 'flexes over'];

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
	/** Swings after HUMILIATION: no damage, and a natural 1 still costs the attacker. */
	showboats = 0;

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
		this.showboats = 0;
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
		return `Hit: ${this.attackDice} + dex vs ac on first hit\nthen also + int bonus (fatigued by 1 each subsequent hit) until you miss.\nOnce the combo has done half the target's max hp, it shows off for up to 3 more swings: no damage, but a 1 still backfires.\n${damageDescription}\n\nStroke of luck increases damage per hit by 1.`;
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
	 * Bug 259 (fight #137 in production, 2026-11-07). A stolen Berserk at a pinned, 3-hp
	 * target swung 282 times: once the combo had dealt half the target's max hp, HUMILIATION
	 * stopped the damage but not the swinging, and a pin gives every swing advantage, so only
	 * a double 1 (1 in 400) ended it. Those empty swings still counted toward the "total
	 * damage" (4,927 claimed, 24 dealt), and the double 1 had the long-fallen target fling
	 * the blow back and kill the attacker. The loop also awaited no pacing, so all ~560 lines
	 * arrived in 1.5 seconds.
	 *
	 * Now HUMILIATION starts a short showboat: at most MAX_SHOWBOATS swings that do no
	 * damage, each saying so, where a natural 1 still breaks the combo (the owner likes that
	 * risk: pride goes before a fall). A natural 1 at a fallen target still strikes back,
	 * as the owner wants, and the roll line now says how (`fromBeyond` in `hit.ts`).
	 * Totals count only damage dealt. Beating a fallen body until HUMILIATION is kept:
	 * that is how Battle Focus destroys a monster.
	 * Every swing takes a beat after its roll and after its blow, like a Hit.
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

		if (strokeOfLuck && !this.showboats) {
			this.increaseDamage();
			this.resetFatigue();
		}

		// Swings before this one that did no damage: the HUMILIATION swing and any showboats.
		const hits = iteration - 1 - this.showboats;

		if (success && this.showboats) {
			const flourish = SHOWBOATS[(this.showboats - 1) % SHOWBOATS.length];
			this.showboats += 1;
			this.emit('narration', {
				narration: `${player.givenName} ${flourish} ${target.givenName}. No damage, all style.`,
			});
			await subEventDelay(ring?.pacingMultiplier);
			if (this.showboats > MAX_SHOWBOATS) {
				this.emit('narration', { narration: `${player.givenName} takes a bow.` });
				return this.endCombo(hits, target, ring, 'HUMILIATION! ');
			}
			return this.effectLoop(iteration + 1, player, target, ring, activeContestants);
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
				this.showboats = 1;
				this.emit('narration', {
					narration: `HUMILIATION! ${target.givenName} has taken all one combo can dish out. ${player.givenName} keeps swinging just to show off: no more damage, but a natural 1 still backfires.`,
				});
				await subEventDelay(ring?.pacingMultiplier);
				return this.effectLoop(iteration + 1, player, target, ring, activeContestants);
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
		} else if (curseOfLoki) {
			// At a fallen target the roll line says how the body struck back (`fromBeyond`).
			let damage = this.damageAmount;
			if (iteration === 1 && this.bigFirstHit) {
				damage = this.rollForDamage(target, player).result;
			}

			let why = '';
			if (this.showboats) {
				why = target.dead
					? ' Pride goes before a fall.'
					: ` Pride goes before a fall: ${target.givenName} catches ${player.givenName} showing off.`;
			}
			this.emit('narration', {
				narration: `COMBO BREAKER!${why} (Broke a ${hits} hit combo, ${this.initialDamage + this.cumulativeComboDamage} total damage)`,
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

		return this.endCombo(hits, target, ring, this.showboats ? 'HUMILIATION! ' : '');
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

	// Hit's "Automatic max damage" was never true here: a combo's natural 20 adds 1 to each
	// hit, and only Battle Focus's opener rolls its damage (at max).
	override naturalTwentyCommentary(player: any): string {
		const name = player.givenName;
		if (this.showboats) return `${name} rolled a natural 20. Pure style, still no damage.`;
		if (this.iterations === 1 && this.bigFirstHit) return `${name} rolled a natural 20. Automatic max damage.`;
		return `${name} rolled a natural 20. Every hit from here on does 1 more damage.`;
	}

	override get successOutcome(): string {
		return this.showboats ? 'Showing off!' : 'Hit!';
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
