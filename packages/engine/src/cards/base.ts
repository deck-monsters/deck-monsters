import { BaseItem, type BaseItemOptions, type BaseItemStatic } from '../items/base.js';
import { mapSeries } from '../helpers/promise.js';
import { ATTACK_PHASE, DEFENSE_PHASE, GLOBAL_PHASE } from '../constants/phases.js';
import { subEventDelay } from '../helpers/delay-times.js';

export interface CardOptions extends Omit<BaseItemOptions, 'flavors'> {
	cardClass?: string[];
	attackDice?: string;
	damageDice?: string;
	targetProp?: string;
	flavors?: any;
}

export interface BaseCardStatic extends Omit<BaseItemStatic, 'flavors'> {
	cardType: string;
	cardClass?: string[];
	probability?: number;
	noBosses?: boolean;
	notForSale?: boolean;
	neverForSale?: boolean;
	defaults?: Record<string, any>;
	actions?: Record<string, string>;
	strongAgainstCreatureTypes?: string[];
	weakAgainstCreatureTypes?: string[];
	uselessAgainstCreatureTypes?: string[];
	permittedClassesAndTypes?: string[];
	targetCards?: string[];
	creatureType?: string;
	flavors?: any;
}

export interface CheckSuccessResult {
	success: boolean;
	strokeOfLuck: boolean;
	curseOfLoki: boolean;
	tie: boolean;
}

export class BaseCard<TOptions extends CardOptions = CardOptions> extends BaseItem<TOptions> {
	static eventPrefix = 'card';

	private _new: any = undefined;

	constructor(options?: Partial<TOptions>) {
		super(options);

		if (this.name === BaseCard.name) {
			throw new Error('The BaseCard should not be instantiated directly!');
		}
	}

	override get itemType(): string {
		return (this.constructor as unknown as BaseCardStatic).cardType;
	}

	get cardType(): string {
		return this.itemType;
	}

	get ['new'](): any {
		if (this.original) {
			return (this.original as any).new;
		}
		return this._new;
	}

	set ['new'](newCard: any) {
		if (this.original) {
			(this.original as any).new = newCard;
		}
		this._new = newCard;
	}

	get cardClass(): string[] | undefined {
		return (this.options as CardOptions).cardClass
			?? (this.constructor as unknown as BaseCardStatic).cardClass;
	}

	set cardClass(cardClass: string[] | undefined) {
		this.setOptions({ cardClass } as unknown as Partial<TOptions>);
	}

	isCardClass(cardClass: string): boolean {
		return !!(this.cardClass && this.cardClass.includes(cardClass));
	}

	async applyEffects(
		player: any,
		proposedTarget: any,
		ring: any,
		activeContestants: any[]
	): Promise<any> {
		let card: any = this.clone();

		if (activeContestants) {
			for (const contestant of activeContestants) {
				for (const effect of contestant.monster.encounterEffects) {
					const modifiedCard = await effect({
						activeContestants,
						card,
						phase:
							contestant.monster === player ? ATTACK_PHASE : DEFENSE_PHASE,
						player,
						ring,
						proposedTarget,
					});
					card = modifiedCard || card;
				}
			}
		}

		if (ring && ring.encounterEffects) {
			for (const effect of ring.encounterEffects) {
				const modifiedCard = await effect({
					activeContestants,
					card,
					phase: GLOBAL_PHASE,
					player,
					ring,
					proposedTarget,
				});
				card = modifiedCard || card;
			}
		}

		this.new = card;
		return card;
	}

	checkSuccess(roll: any, targetNumber: number): CheckSuccessResult {
		const success =
			!roll.curseOfLoki && (roll.strokeOfLuck || targetNumber < roll.result);
		const tie = targetNumber === roll.result;
		return {
			success,
			strokeOfLuck: roll.strokeOfLuck,
			curseOfLoki: roll.curseOfLoki,
			tie,
		};
	}

	getTargets(
		player: any,
		proposedTarget: any,
		_ring?: any,
		_activeContestants?: any
	): any[] {
		return [proposedTarget];
	}

	play(
		player: any,
		proposedTarget?: any,
		ring?: any,
		activeContestants?: any,
		shouldApplyEffects = true
	): Promise<any> {
		if (shouldApplyEffects) {
			return this.applyEffects(
				player,
				proposedTarget,
				ring,
				activeContestants
			).then(card =>
				card.play(player, proposedTarget, ring, activeContestants, false)
			);
		}

		return Promise.resolve().then(async () => {
			this.emit('played', { player });
			await subEventDelay();

			const targets = this.getTargets(
				player,
				proposedTarget,
				ring,
				activeContestants
			);

			if ((this as any).effect) {
				return Promise.resolve(ring)
					.then(
						({ channelManager }: any = {}) =>
							channelManager && channelManager.sendMessages()
					)
					.then(() =>
						mapSeries(targets, (target: any) =>
							(this as any).effect(player, target, ring, activeContestants)
						)
					)
					.then((results: any[]) =>
						results.reduce(
							(result: any, val: any) => result && val,
							true
						)
					);
			}

			return true;
		});
	}
}

export default BaseCard;
