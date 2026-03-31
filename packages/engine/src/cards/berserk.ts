import { HitCard } from './hit.js';
import { BARBARIAN } from '../constants/creature-classes.js';
import { chance } from '../helpers/chance.js';
import { COMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';

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
		return `Hit: ${this.attackDice} + str bonus vs ac on first hit\nthen also + int bonus (fatigued by 1 each subsequent hit) until you miss\n${damageDescription}\n\nStroke of luck increases damage per hit by 1.`;
	}

	override getDamageRoll(): any {
		return roll({ primaryDice: this.damageDice });
	}

	getAttackRollBonus(player: any): number {
		let modifier = player.dexModifier;
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

	effectLoop(
		iteration: number,
		player: any,
		target: any,
		ring: any,
		activeContestants: any
	): any {
		this.iterations = iteration;

		if (iteration > 2) this.increaseFatigue();

		const { attackRoll, success, strokeOfLuck, curseOfLoki } = this.hitCheck(
			player,
			target
		);

		if (strokeOfLuck) {
			this.increaseDamage();
			this.resetFatigue();
		}

		if (success) {
			let damage = this.damageAmount;
			if (iteration === 1 && this.bigFirstHit) {
				damage = this.rollForDamage(player, target, strokeOfLuck).result;
			}

			if (iteration !== 1) {
				this.cumulativeComboDamage += damage;
			} else {
				this.initialDamage = damage;
			}

			if (
				this.cumulativeComboDamage <= Math.floor(target.maxHp / 2)
			) {
				target.hit(damage, player, this);
			} else {
				this.emit('narration', {
					narration: `HUMILIATION! ${iteration} hits`,
				});
			}

			return this.effectLoop(
				iteration + 1,
				player,
				target,
				ring,
				activeContestants
			);
		} else if (curseOfLoki) {
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

		if (iteration > 1) {
			const comboText = iteration > 3 ? 'COMBO! ' : '';
			const ultraText = iteration > 5 ? 'ULTRA ' : '';
			this.emit('narration', {
				narration: `${target.dead ? 'ULTIMATE ' : ultraText}${comboText}${iteration - 1} HIT${iteration - 1 > 1 ? 'S' : ''} (${this.initialDamage + this.cumulativeComboDamage} total damage).`,
			});
		}

		this.resetCard();
		return ring.channelManager
			.sendMessages()
			.then(() => !target.dead);
	}

	override effect(
		player: any,
		target: any,
		ring: any,
		activeContestants?: any
	): any {
		this.resetCard();
		this.cumulativeComboDamage = 0;
		return this.effectLoop(1, player, target, ring, activeContestants);
	}
}

export default BerserkCard;
