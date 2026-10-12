import { BaseItem, type BaseItemOptions, type BaseItemStatic } from '../items/base.js';
import { mapSeries } from '../helpers/promise.js';
import { ATTACK_PHASE, DEFENSE_PHASE, GLOBAL_PHASE } from '../constants/phases.js';
import { subEventDelay } from '../helpers/delay-times.js';

/**
 * When an encounter effect does its work on its owner's turn. Untagged effects run in the
 * card stage, on the card actually played. See docs/architecture/cards-and-encounter-effects.md
 * ("Turn order") for the whole sequence and why each step sits where it does.
 *
 * - `timeShift`: runs first. A time-shifted monster loses the turn and no time passes for
 *   it, so control and upkeep are skipped too (a burn does not tick, winded does not end).
 * - `control`: holds, awe. May lose the turn, but time still passes, so upkeep runs.
 * - `upkeep`: start-of-turn status (burns, winded, exposed, rest, ward fading). Runs before
 *   the card box, so the feed says why a stat changed before the card that follows.
 *
 * An effect that loses the turn replaces `card.play` on the turn-start clone and may name
 * why in `card.turnLost`. Card-stage effects (a dive, fury, rattled) never run on a lost
 * turn, so a boost "for the next card" is not spent on a card that was never played.
 */
export type TurnStartStage = 'timeShift' | 'control' | 'upkeep';
const TURN_START_STAGES: TurnStartStage[] = ['timeShift', 'control', 'upkeep'];

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

	/**
	 * The monster playing this card right now. Card events reach a room through the
	 * process-wide semaphore, and the room's guard (`createRoomScopedEventGuard`) keeps only
	 * events it can trace to this room. A narration payload is just `{ narration }`, so a card
	 * outside every room character's hand (a boss's hand, a stolen or randomly drawn clone)
	 * had no trace and its narration was dropped: a boss's Pick Pocket never said whose card
	 * it took (10b #190). This property lets the guard reach the player, and through it the
	 * ring. It is set on every play, never serialized (clones and saves use `options`), and
	 * only card events read it, so boss rewards stay unaffected.
	 */
	playedBy?: unknown;

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

	/**
	 * The acting monster's turn-start stages (see `TurnStartStage`), on a clone of this card.
	 * Only the actor's own effects take part: another monster's effects react to the card,
	 * which is the card stage's job. Snapshot the list per stage, since effects remove
	 * themselves as they end.
	 */
	async startTurn(
		player: any,
		proposedTarget: any,
		ring: any,
		activeContestants: any[]
	): Promise<{ card: any; lost: boolean }> {
		const card: any = this.clone();
		const { play } = card;
		const isLost = (): boolean => !!player.dead || card.play !== play;

		for (const stage of TURN_START_STAGES) {
			// No time passes for a time-shifted monster: nothing else on its turn happens.
			if (card.turnLost === 'timeShift') break;
			for (const effect of [...(player.encounterEffects ?? [])]) {
				if (effect.turnStart !== stage) continue;
				const modifiedCard = await effect({
					activeContestants,
					card,
					phase: ATTACK_PHASE,
					player,
					ring,
					proposedTarget,
				});
				if (modifiedCard && modifiedCard !== card) Object.assign(card, modifiedCard);
				if (stage === 'timeShift' && isLost()) card.turnLost = 'timeShift';
			}
		}

		const lost = isLost();
		if (lost && card.play === play) card.play = () => Promise.resolve(!player.dead);
		return { card, lost };
	}

	async applyEffects(
		player: any,
		proposedTarget: any,
		ring: any,
		activeContestants: any[],
		base?: any
	): Promise<any> {
		let card: any = base ?? this.clone();

		if (activeContestants) {
			for (const contestant of activeContestants) {
				const phase = contestant.monster === player ? ATTACK_PHASE : DEFENSE_PHASE;
				for (const effect of contestant.monster.encounterEffects) {
					// The actor's turn-start work already ran in `startTurn`.
					if (phase === ATTACK_PHASE && effect.turnStart) continue;
					const modifiedCard = await effect({
						activeContestants,
						card,
						phase,
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

	/**
	 * The card box, once per play. Turn start announces it before the card-stage effects, so
	 * a dive or fury reads under the card it boosts; the second `play` pass then skips it.
	 */
	async announcePlay(player: any, ring?: any): Promise<void> {
		if ((this as any).announced) return;
		(this as any).announced = true;
		this.emit('played', { player });
		await subEventDelay(ring?.pacingMultiplier);
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

	/**
	 * `shouldApplyEffects`: `true` runs a whole turn (turn start, card box, card stage, the
	 * card); `'card'` is for a card another card put into play (Random Play, Pick Pocket)
	 * after that card already ran the turn start; `false` is the inner pass that resolves
	 * the card on the clone the effects built.
	 */
	play(
		player: any,
		proposedTarget?: any,
		ring?: any,
		activeContestants?: any,
		shouldApplyEffects: boolean | 'card' = true
	): Promise<any> {
		this.playedBy = player;
		if (shouldApplyEffects) {
			const started =
				shouldApplyEffects === 'card'
					? Promise.resolve({ card: this.clone(), lost: false })
					: this.startTurn(player, proposedTarget, ring, activeContestants);

			return started.then(async ({ card: startedCard, lost }) => {
				// A lost turn plays the replacement (a hold's "misses a turn", a flee) and nothing
				// else: no card box, no boosts spent.
				if (lost) {
					return startedCard.play(player, proposedTarget, ring, activeContestants, false);
				}
				await startedCard.announcePlay(player, ring);
				const card = await this.applyEffects(player, proposedTarget, ring, activeContestants, startedCard);
				return card.play(player, proposedTarget, ring, activeContestants, false);
			});
		}

		return Promise.resolve().then(async () => {
			await this.announcePlay(player, ring);

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
