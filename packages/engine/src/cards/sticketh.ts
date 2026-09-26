import { ImmobilizeCard } from './immobilize.js';
import { chance } from '../helpers/chance.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { UNICORN } from '../constants/creature-types.js';
import { MELEE } from '../constants/card-classes.js';
import { RARE } from '../helpers/probabilities.js';
import { PRICEY } from '../helpers/costs.js';

const { roll } = chance;

// A small bonus for the headlong charge: enough to make the horn the better swing, not so
// much that it stops missing. Missing is the point of the card.
const STICKETH_TO_HIT_BONUS = 1;

/*
 * The title is exactly "Sticketh" — do not normalize it to Stickith, Sticks, or Striketh.
 * It comes from early-modern English accounts of a unicorn's charge:
 *   - Julius Solinus (3rd c., in Arthur Golding's 1587 English): "His horne sticketh out",
 *     and whatever it charges "he striketh it through easily".
 *   - Edward Topsell, The History of Four-footed Beasts (1607): a lion steps behind a tree
 *     as the unicorn charges, and the "sharp horn sticketh fast" in the trunk.
 *   - Edmund Spenser, The Faerie Queene II.v.10 (1590): the same feint, the horn striking
 *     "in the stocke, ne thence can be releast".
 *   - The Brothers Grimm, "The Brave Little Tailor" (folk tale): the tailor springs behind a
 *     tree and the unicorn gores it "so firmly with his horn that he could not get it out".
 * All four appear in the anthology A Book of Unicorns (Green Tiger Press). The card keeps
 * both halves: a hard charge, and the risk of being left stuck fast.
 */
export class StickethCard extends ImmobilizeCard {
	static cardClass = [MELEE];
	static cardType = 'Sticketh';
	static actions = {
		IMMOBILIZE: 'stick fast',
		IMMOBILIZES: 'sticks fast',
		IMMOBILIZED: 'stuck fast',
	};
	static permittedClassesAndTypes = [UNICORN];
	// Not an immobilize against anyone else, so none of ImmobilizeCard's matchup lists apply.
	static strongAgainstCreatureTypes: string[] = [];
	static weakAgainstCreatureTypes: string[] = [];
	static uselessAgainstCreatureTypes: string[] = [];
	static probability = RARE.probability;
	static description =
		'Charge horn-first. Old accounts warn that a clever foe steps aside, and the "sharp horn sticketh fast."';
	static level = 0;
	static cost = PRICEY.cost;
	// Seeded through the starting deck (cards/helpers/deck.ts) and drops rather than the
	// front shop, so the signature card does not flood the generic pool.
	static notForSale = true;
	static defaults = {
		...ImmobilizeCard.defaults,
		damageDice: '1d10',
		freedomSavingThrowTargetAttr: 'str',
		targetProp: 'ac',
	};

	constructor({
		damageDice,
		freedomSavingThrowTargetAttr,
		icon = '🦄',
		targetProp,
		...rest
	}: Record<string, any> = {}) {
		super({ damageDice, freedomSavingThrowTargetAttr, icon, targetProp, ...rest });
	}

	override get stats(): string {
		return `Charge: ${this.attackDice} +${STICKETH_TO_HIT_BONUS} vs ac / Damage: ${this.damageDice}
On a miss, roll 1d20 + str vs the target's dex to pull up in time.
Fail, and your horn is stuck fast: at the start of each of your turns, roll 1d20 + str vs your own str - (turns stuck x 3) to pull it free. A stuck monster misses that turn.
Natural 1 on either roll fails. Natural 20 on the charge deals max damage.`;
	}

	// The immobilize matchup bonus is meaningless for a self-inflicted hold; returning 0 also
	// keeps it out of the freedom threshold.
	override getAttackModifier(_target: any): number {
		return 0;
	}

	override getAttackRoll(player: any, _target?: any): any {
		return roll({
			primaryDice: this.attackDice,
			modifier: player.dexModifier + STICKETH_TO_HIT_BONUS,
			bonusDice: player.bonusAttackDice,
			crit: true,
		});
	}

	/**
	 * Same shape as HitCard.hitCheck, except a natural 1 is only a miss. HitCard flings a
	 * natural 1 back at the attacker; here the risk is the stick-fast save instead, and the
	 * brief rules out the Unicorn goring themself.
	 */
	override hitCheck(player: any, target: any): any {
		const attackRoll = this.getAttackRoll(player, target);
		const { success, strokeOfLuck, curseOfLoki, tie } = this.checkSuccess(
			attackRoll,
			target[this.targetProp]
		);
		let commentary: string | undefined;

		if (strokeOfLuck) {
			commentary = `${player.givenName} rolled a natural 20. Automatic max damage.`;
		} else if (curseOfLoki) {
			commentary = `${player.givenName} rolled a 1. ${target.givenName} sidesteps at the last instant.`;
		} else if (tie) {
			commentary = 'Miss... Tie goes to the defender.';
		}

		const reason =
			player === target
				? `vs ${target.pronouns.his} own ac (${target.ac}) in confusion.`
				: `vs ${target.givenName}'s ac (${target.ac}) to see if the charge lands.`;

		this.emit('rolled', {
			reason,
			card: this,
			roll: attackRoll,
			who: player,
			outcome: success ? commentary || 'Hit!' : commentary || 'Miss...',
			vs: target.ac,
		});

		return { attackRoll, success, strokeOfLuck, curseOfLoki };
	}

	getStickSaveRoll(player: any): any {
		return roll({
			primaryDice: this.attackDice,
			modifier: player.strModifier,
			bonusDice: player.bonusAttackDice,
			crit: true,
		});
	}

	/**
	 * The STR save after a miss. The difficulty is the target's dex: a nimbler foe sells the
	 * feint better. Returns true when the Unicorn pulls up in time.
	 */
	stickSave(player: any, target: any): boolean {
		const saveRoll = this.getStickSaveRoll(player);
		const { success, curseOfLoki, tie } = this.checkSuccess(saveRoll, target.dex);
		let outcome: string;

		if (success) {
			outcome = `${player.givenName} pulls up in time.`;
		} else if (curseOfLoki) {
			outcome = `${player.givenName} rolled a natural 1. The horn buries itself in the timber.`;
		} else if (tie) {
			outcome = 'Tie... the horn sticks.';
		} else {
			outcome = 'The horn sticks fast!';
		}

		const feint =
			player === target
				? `${player.pronouns.his} own dex (${target.dex})`
				: `${target.givenName}'s dex (${target.dex})`;

		this.emit('rolled', {
			reason: `vs ${feint} to pull up before the horn sticks.`,
			card: this,
			roll: saveRoll,
			who: player,
			outcome,
			vs: target.dex,
		});

		return success;
	}

	override emitHeldEffect(player: any, target: any, _ring: any): void {
		// Only ever self-inflicted, so player === target.
		this.emit('narration', {
			narration: `${target.givenName}'s horn is still ${this.icon} ${this.actions.IMMOBILIZED} in the timber.`,
		});
	}

	override getFreedomCommentary(
		{ strokeOfLuck, curseOfLoki, tie }: { strokeOfLuck: boolean; curseOfLoki: boolean; tie: boolean },
		_player: any,
		target: any
	): string | undefined {
		if (strokeOfLuck) {
			return `${target.givenName} rolled a natural 20 and wrenches the horn free.`;
		} else if (curseOfLoki) {
			return `${target.givenName} rolled a natural 1. The horn only sinks deeper.`;
		} else if (tie) {
			return 'Tie... the timber holds.';
		}
		return undefined;
	}

	override emitImmobilizeNarrative(player: any, _target: any): void {
		this.emit('narration', {
			narration: `\n${player.givenName}'s horn ${this.icon} ${this.actions.IMMOBILIZES} in the timber. At the beginning of ${player.pronouns.his} turn ${player.pronouns.he} will roll ${this.freedomThresholdNarrative(player, player)} to pull it free.`,
		});
	}

	/**
	 * Applies the hold to the Unicorn who played the card and to nobody else, reusing the
	 * ordinary ImmobilizeEffect so freedom, fatigue, and cleanup behave exactly as any other
	 * hold. It deliberately skips `immobilize()`: that path is for holds an opponent applies,
	 * and it is where Unconquerable Horn's ward is checked. The encounter owns the effect, so
	 * `endEncounter()` clears it on fight end, flee, death, or cancellation.
	 */
	stickFast(player: any, ring: any): void {
		const alreadyHeld = player.encounterEffects.some(
			(effect: any) => effect.effectType === 'ImmobilizeEffect'
		);
		if (alreadyHeld) return;

		this.emitImmobilizeNarrative(player, player);
		const stuckEffect = this.getImmobilizeEffect(player, player, ring);
		stuckEffect.effectType = 'ImmobilizeEffect';
		player.encounterEffects = [...player.encounterEffects, stuckEffect];
		player.encounterModifiers.immobilizedTurns = 0;
	}

	override async effect(
		player: any,
		target: any,
		ring: any,
		_activeContestants?: any
	): Promise<any> {
		const { attackRoll, success, strokeOfLuck, curseOfLoki } = this.hitCheck(player, target);
		await subEventDelay(ring?.pacingMultiplier);

		if (success) {
			const damageRoll = this.rollForDamage(player, target, strokeOfLuck);
			await subEventDelay(ring?.pacingMultiplier);
			return target.hit(damageRoll.result, player, this);
		}

		this.emit('miss', {
			attackResult: attackRoll.result,
			attackRoll,
			curseOfLoki,
			player,
			target,
		});
		await subEventDelay(ring?.pacingMultiplier);

		if (player.dead) return !target.dead;

		const pulledUp = this.stickSave(player, target);
		await subEventDelay(ring?.pacingMultiplier);

		if (!pulledUp) {
			this.stickFast(player, ring);
			if (player !== target) {
				this.emit('narration', {
					narration: `${target.givenName} has an opening.`,
				});
			}
			await subEventDelay(ring?.pacingMultiplier);
		}

		return !target.dead;
	}
}

export default StickethCard;
