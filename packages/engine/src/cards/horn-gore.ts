import { ImmobilizeCard } from './immobilize.js';
import { sample } from '../helpers/random.js';
import { chance } from '../helpers/chance.js';
import {
	BASILISK,
	GLADIATOR,
	JINN,
	MINOTAUR,
	WEEPING_ANGEL,
} from '../constants/creature-types.js';
import { EPIC } from '../helpers/probabilities.js';
import { EXPENSIVE } from '../helpers/costs.js';
import { MELEE } from '../constants/card-classes.js';

const { roll } = chance;

const STARTING_FREEDOM_THRESHOLD_MODIFIER = -4;
const STARTING_DEX_MODIFIER = 0;

export class HornGore extends ImmobilizeCard {
	static cardClass = [MELEE];
	static cardType = 'Horn Gore';
	static actions = { IMMOBILIZE: 'pin', IMMOBILIZES: 'pins', IMMOBILIZED: 'pinned' };
	static permittedClassesAndTypes = [MINOTAUR];
	static strongAgainstCreatureTypes = [MINOTAUR, GLADIATOR];
	static weakAgainstCreatureTypes = [BASILISK, JINN, WEEPING_ANGEL];
	static uselessAgainstCreatureTypes: string[] = [];
	static probability = EPIC.probability;
	static description =
		'You think those horns are just there to look pretty? Think again...';
	static level = 0;
	static cost = EXPENSIVE.cost;
	static notForSale = true;
	static defaults = {
		...ImmobilizeCard.defaults,
		damageDice: '1d4',
		doDamageOnImmobilize: false,
		freedomThresholdModifier: STARTING_FREEDOM_THRESHOLD_MODIFIER,
		freedomSavingThrowTargetAttr: 'str',
		targetProp: 'ac',
	};
	static flavors = {
		hits: [
			['gores', 80],
			['pokes relentlessly', 70],
			['impales', 70],
			['mercilessly juggles (on their mighty horns) the pitiful', 50],
			[
				'chases down gleefully, stomps on, and then wantonly drives their horns through',
				5,
			],
			['teaches the true meaning of "horny" to', 5],
		],
		spike: 'horn',
	};

	dexModifier: number = STARTING_DEX_MODIFIER;

	constructor({
		damageDice,
		freedomSavingThrowTargetAttr,
		icon = '🐂',
		targetProp,
		...rest
	}: Record<string, any> = {}) {
		super({ damageDice, freedomSavingThrowTargetAttr, icon, targetProp, ...rest });
	}

	get flavors(): any {
		return (this.constructor as any).flavors;
	}

	get mechanics(): string {
		return `Attack twice (once with each ${this.flavors.spike}). +2 to hit and immobilize for each successful ${this.flavors.spike} hit.\n\nIf either ${this.flavors.spike} hits, chance to immobilize: 1d20 vs ${this.freedomSavingThrowTargetAttr}.`;
	}

	override get stats(): string {
		return `${this.mechanics}\n\n${super.stats}`;
	}

	override getAttackModifier(target: any): number {
		if (this.weakAgainstCreatureTypes.includes(target.creatureType)) {
			return -2 + this.freedomThresholdModifier;
		} else if (this.strongAgainstCreatureTypes.includes(target.creatureType)) {
			return 2 + this.freedomThresholdModifier;
		}
		return 0;
	}

	resetImmobilizeStrength(): void {
		this.freedomThresholdModifier = STARTING_FREEDOM_THRESHOLD_MODIFIER;
		this.dexModifier = STARTING_DEX_MODIFIER;
	}

	increaseImmobilizeStrength(amount: number): void {
		this.freedomThresholdModifier += amount;
		this.dexModifier += amount;
	}

	getCommentary(rolled: any, player: any, target: any): string | undefined {
		let commentary: string | undefined;

		if (rolled.strokeOfLuck) {
			commentary = `${player.givenName} rolled a natural 20. Automatic max damage.`;
		}

		if (rolled.curseOfLoki) {
			const flavors = [
				`gouge ${player.pronouns.his} eye`,
				`punch ${player.pronouns.his} soft temple`,
				`kick ${player.pronouns.his} jugular`,
				`shove a fist into each of ${player.pronouns.his} nostrils and spread ${player.pronouns.his} arms as wide as ${target.pronouns.he} can`,
				`bite off ${player.pronouns.his} ear`,
				`grab ${player.pronouns.his} tongue and pull for all ${target.pronouns.he}'s worth`,
			];
			commentary = `${player.givenName} rolled a 1.\n${target.givenName} manages to take the opportunity of such close proximity to ${player.givenName}'s face to ${sample(flavors)}.`;
		}

		return commentary;
	}

	emitRoll(
		rolled: any,
		success: boolean,
		player: any,
		target: any,
		hornNumber?: number
	): void {
		const commentary = this.getCommentary(rolled, player, target);

		let reason: string;
		if (player === target) {
			reason = `vs ${target.pronouns.his} own ac (${target.ac})${hornNumber ? ` for ${this.flavors.spike} ${hornNumber}` : ''} in confusion.`;
		} else {
			reason = `vs ${target.givenName}'s ac (${target.ac})${hornNumber ? ` for ${this.flavors.spike} ${hornNumber}` : ''} to determine if gore was successful.`;
		}

		this.emit('rolled', {
			reason,
			card: this,
			roll: rolled,
			who: player,
			outcome: commentary || (success ? 'Hit!' : 'Miss...'),
			vs: target.ac,
		});
	}

	hitCheck(player: any, target: any, hornNumber?: number): any {
		const attackRoll = this.getAttackRoll(player, target);
		const { success, strokeOfLuck, curseOfLoki } = this.checkSuccess(
			attackRoll,
			target[this.targetProp]
		);

		this.emitRoll(attackRoll, success, player, target, hornNumber);

		return { attackRoll, success, strokeOfLuck, curseOfLoki };
	}

	override getDamageRoll(player: any): any {
		return roll({
			primaryDice: this.damageDice,
			modifier: Math.floor(player.strModifier / 2),
			bonusDice: player.bonusDamageDice,
		});
	}

	async gore(player: any, target: any, hornNumber: number): Promise<any> {
		const { attackRoll, success, strokeOfLuck, curseOfLoki } = this.hitCheck(
			player,
			target,
			hornNumber
		);

		if (success) {
			this.increaseImmobilizeStrength(2);
			const { dexModifier } = player.encounterModifiers;
			player.encounterModifiers.dexModifier = dexModifier > 0 ? dexModifier + 1 : 1;
			const damageRoll = this.rollForDamage(player, target, strokeOfLuck);
			await target.hit(damageRoll.result, player, this);
		} else if (curseOfLoki) {
			const damageRoll = this.rollForDamage(target, player);
			await player.hit(damageRoll.result, target, this);
		}

		return { attackRoll, success, strokeOfLuck, curseOfLoki };
	}

	override immobilizeCheck(player: any, target: any): boolean {
		const immobilizeRoll = this.getImmobilizeRoll(player, target);
		const { success: immobilizeSuccess } = this.checkSuccess(
			immobilizeRoll,
			target[this.freedomSavingThrowTargetAttr]
		);

		const failMessage = `${this.actions.IMMOBILIZE} failed.`;
		const outcome = immobilizeSuccess
			? `${this.actions.IMMOBILIZE} succeeded!`
			: failMessage;

		this.emit('rolled', {
			reason: `to see if ${player.pronouns.he} ${this.actions.IMMOBILIZES} ${target.givenName}.`,
			card: this,
			roll: immobilizeRoll,
			who: player,
			outcome,
			vs: this.freedomSavingThrowTargetAttr,
		});

		if (!immobilizeSuccess) {
			this.emit('miss', {
				attackResult: immobilizeRoll.result,
				immobilizeRoll,
				player,
				target,
			});
		}

		return immobilizeSuccess;
	}

	override async effect(
		player: any,
		target: any,
		ring: any,
		activeContestants: any
	): Promise<any> {
		const originalDexModifier = player.encounterModifiers.dexModifier;

		this.resetImmobilizeStrength();
		const horn1 = await this.gore(player, target, 1);
		const horn2 = await this.gore(player, target, 2);
		const chanceToImmobilize = horn1.success || horn2.success;

		player.encounterModifiers.dexModifier = originalDexModifier;

		if (!player.dead && chanceToImmobilize) {
			if (target.dead) return false;
			return this.immobilize(player, target, ring, activeContestants);
		}

		this.emit('miss', {
			attackResult: Math.max(
				horn1.attackRoll.result,
				horn2.attackRoll.result
			),
			curseOfLoki: horn1.curseOfLoki || horn2.curseOfLoki,
			player,
			target,
		});

		return !target.dead;
	}
}

export default HornGore;
