import { BaseItem, type BaseItemOptions, type BaseItemStatic } from '../items/base.js';
import { mapSeries } from '../helpers/promise.js';
import { ATTACK_PHASE, DEFENSE_PHASE, GLOBAL_PHASE } from '../constants/phases.js';

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

	applyEffects(
		player: any,
		proposedTarget: any,
		ring: any,
		activeContestants: any[]
	): any {
		let card: any = this.clone();

		if (activeContestants) {
			card = activeContestants.reduce(
				(contestantCard: any, contestant: any) =>
					contestant.monster.encounterEffects.reduce((effectCard: any, effect: any) => {
						const modifiedCard = effect({
							activeContestants,
							card: effectCard,
							phase:
								contestant.monster === player ? ATTACK_PHASE : DEFENSE_PHASE,
							player,
							ring,
							proposedTarget,
						});
						return modifiedCard || effectCard;
					}, contestantCard),
				card
			);
		}

		if (ring && ring.encounterEffects) {
			card = ring.encounterEffects.reduce((currentCard: any, effect: any) => {
				const modifiedCard = effect({
					activeContestants,
					card: currentCard,
					phase: GLOBAL_PHASE,
					player,
					ring,
					proposedTarget,
				});
				return modifiedCard || currentCard;
			}, card);
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
			const card = this.applyEffects(
				player,
				proposedTarget,
				ring,
				activeContestants
			);
			return card.play(player, proposedTarget, ring, activeContestants, false);
		}

		return Promise.resolve().then(() => {
			this.emit('played', { player });

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
