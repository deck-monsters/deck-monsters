import { ImmobilizeCard, FREEDOM_FATIGUE_TEXT } from './immobilize.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { BARD } from '../constants/creature-classes.js';
import { DRAGON, UNICORN } from '../constants/creature-types.js';
import { ACOUSTIC } from '../constants/card-classes.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { CHEAP } from '../helpers/costs.js';

/** The Dragon's bonus on the lullaby's contest (and, as with every hold matchup, on how hard the sleep is to shake off). */
export const LULLABY_DRAGON_BONUS = 4;

/*
 * The owner's counter to a treasure-guarding dragon that is useful against anyone (roadmap
 * 12, "Dragon follow-ups", 2026-09-27): "1d20 + INT vs the target's INT; on a success the
 * target dozes and loses its next card, through `immobilize()`, so the ward applies. +4
 * against a Dragon (old tales lull treasure-guarding dragons to sleep with song)."
 *
 * It is a hold like Mesmerize and Enthrall, so it inherits everything the family already
 * decides rather than restating it: the doze is an `ImmobilizeEffect` that costs the next card
 * unless the sleeper wakes at the start of its turn (1d20 + its INT against the singer's INT,
 * 3 easier for each turn held); attacks on a dozing monster roll with advantage (the pin rule,
 * roadmap 36); a caster who falls ends the spell at once; an armed Horn of Proof ward cancels
 * it, the contest roll already spent. The ward is Horn of Proof's now: the spec's "Unconquerable
 * Horn ward" moved there on 2026-09-29 (cards/helpers/control-ward.ts).
 *
 * The +4 is the family's own strong-matchup mechanism (`strongAgainstCreatureTypes` with a
 * `freedomThresholdModifier` of 4), so it counts twice, as every matchup does: +4 on the
 * singer's roll, and the dragon wakes against a threshold 4 higher. Not done on purpose: a
 * second, Dragon-only rule beside the one every hold already has.
 *
 * It does no damage. A target that is already held, or that cannot be held at all (a Weeping
 * Angel is a statue), gets a line and nothing else: `ImmobilizeCard.immobilize()` would hit
 * instead, which is right for a pin and wrong for a song.
 *
 * Player-facing lines are placeholders for the orchestrator (`DRAFT(39)`).
 */
export class LullabyCard extends ImmobilizeCard {
	static cardClass = [ACOUSTIC];
	static cardType = 'Lullaby';
	static actions = {
		IMMOBILIZE: 'lull',
		IMMOBILIZES: 'lulls',
		IMMOBILIZED: 'lulled to sleep',
	};
	static permittedClassesAndTypes = [BARD, UNICORN];
	static strongAgainstCreatureTypes = [DRAGON];
	static weakAgainstCreatureTypes: string[] = [];
	static probability = UNCOMMON.probability;
	// DRAFT(39)
	static description = 'A slow song to send an opponent to sleep. Dragons, guarding their hoards, are the easiest to lull.';
	static level = 1;
	static cost = CHEAP.cost;
	static defaults = {
		...ImmobilizeCard.defaults,
		doDamageOnImmobilize: false,
		freedomSavingThrowTargetAttr: 'int',
		freedomThresholdModifier: LULLABY_DRAGON_BONUS,
		targetProp: 'int',
	};

	constructor({ icon = '🎶', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest });
	}

	/**
	 * Not `super.stats`: that text is a pin's ("If already immobilized, hit instead", a damage
	 * block), and a song hits nobody. The wake-up rule is the hold family's, said plainly.
	 */
	override get stats(): string {
		// DRAFT(39)
		return `Sing your opponent to sleep: 1d20 + int vs their int, +${LULLABY_DRAGON_BONUS} against a Dragon. On a success they doze and lose their next card unless they wake first. No damage.
At the start of their turn they roll 1d20 + their int to wake, against your int (+${LULLABY_DRAGON_BONUS} for a Dragon). ${FREEDOM_FATIGUE_TEXT} A natural 20 wakes them hard: you take 2.
Does nothing to a Weeping Angel, or to anyone already asleep. On a natural 1 you doze off instead: you lose your next card, and wake the same way.`;
	}

	/** Set by a natural 1 on the lull roll; `effect` then puts the singer to sleep (see `dozeOff`). */
	private fumbled = false;

	override immobilizeCheck(player: any, target: any): boolean {
		const roll = this.getImmobilizeRoll(player, target);
		const { success, curseOfLoki } = this.checkSuccess(roll, target.int);

		this.emit('rolled', {
			success,
			reason: `to lull ${target.givenName} (int ${target.int}).`,
			card: this,
			roll,
			who: player,
			// DRAFT(39)
			outcome: success
				? `${target.givenName}'s eyelids droop.`
				: curseOfLoki
					? `${player.givenName} yawns in the middle of the verse and nods off.`
					: `${target.givenName} hums along and stays awake.`,
			vs: target.int,
		});

		if (!success) {
			this.emit('miss', {
				attackResult: roll.result,
				immobilizeRoll: roll,
				player,
				target,
				curseOfLoki,
			});
		}
		this.fumbled = curseOfLoki;

		return success;
	}

	/**
	 * The natural-1 backfire (10b #258: a card that rolls for its own move turns a natural 1 on
	 * its player). The singer gets the sleep they meant for the target, through the same hold
	 * (so they wake the way any held monster does: 1d20 + their int against their own int, 3
	 * easier each turn). Like Sticketh's self-inflicted hold it skips `immobilize()`, where the
	 * Horn of Proof ward is checked: a ward guards against an opponent's hold, and no
	 * opponent held this one.
	 */
	private dozeOff(singer: any, ring: any): void {
		const alreadyHeld = singer.encounterEffects.some((effect: any) => effect.effectType === 'ImmobilizeEffect');
		if (alreadyHeld) return;

		this.emitImmobilizeNarrative(singer, singer);
		const effect = this.getImmobilizeEffect(singer, singer, ring);
		effect.effectType = 'ImmobilizeEffect';
		singer.encounterEffects = [...singer.encounterEffects, effect];
		singer.encounterModifiers.immobilizedTurns = 0;
	}

	override getImmobilizeEffect(player: any, target: any, ring: any, activeContestants?: any): any {
		const effect = super.getImmobilizeEffect(player, target, ring, activeContestants);
		// Marks this hold as a sleep, so a second song can tell it from a Coil or a pin.
		effect.isSleep = true;
		return effect;
	}

	override emitImmobilizeNarrative(player: any, target: any): void {
		// DRAFT(39)
		const intro = player === target
			? `${player.givenName} ${this.icon} dozes off.`
			: `${player.givenName} ${this.icon} ${this.actions.IMMOBILIZES} ${target.givenName}.`;
		this.emit('narration', {
			narration: `\n${intro}\nAt the beginning of ${target.givenName}'s turn ${target.pronouns.he} will roll ${this.freedomThresholdNarrative(player, target)} to wake. ${FREEDOM_FATIGUE_TEXT}`,
		});
	}

	override emitHeldEffect(player: any, target: any, ring: any): void {
		if (player !== target) return super.emitHeldEffect(player, target, ring);
		this.emit('narration', {
			// DRAFT(39)
			narration: `${this.icon} ${target.givenName} is still dozing.`,
		});
	}

	override freedomWording(target: any): { goal: string; freed: string; held: string } {
		// DRAFT(39)
		return {
			goal: 'wake',
			freed: `${target.givenName} stirs and wakes.`,
			held: `${target.givenName} sleeps on and will miss a turn.`,
		};
	}

	override getFreedomCommentary(
		{ strokeOfLuck, curseOfLoki, tie }: { strokeOfLuck: boolean; curseOfLoki: boolean; tie: boolean },
		player: any,
		target: any
	): string | undefined {
		// DRAFT(39)
		if (strokeOfLuck) {
			return player === target
				? `${target.givenName} rolled a natural 20 and jolts awake.`
				: `${target.givenName} rolled a natural 20 and jolts awake, startling ${player.givenName}.`;
		} else if (curseOfLoki) {
			return `${target.givenName} rolled a natural 1 and sinks into a deeper sleep.`;
		} else if (tie) {
			return 'Not quite awake... Tie goes to the sleeper.';
		}
		return undefined;
	}

	override async effect(player: any, target: any, ring: any, activeContestants?: any): Promise<any> {
		const hold = target.encounterEffects.find((effect: any) => effect.effectType === 'ImmobilizeEffect');
		if (hold || this.uselessAgainstCreatureTypes.includes(target.creatureType)) {
			this.emit('narration', {
				// DRAFT(39)
				narration: !hold
					? `${this.icon} ${player.givenName} sings to ${target.givenName}, who is stone and does not doze.`
					: hold.isSleep
						? `${this.icon} ${target.givenName} is already out cold, and ${player.givenName} lets ${target.pronouns.him} sleep.`
						: `${this.icon} ${target.givenName} is already held, and ${player.givenName}'s song changes nothing.`,
			});
			await subEventDelay(ring?.pacingMultiplier);
			return !target.dead;
		}

		this.fumbled = false;
		const result = await super.effect(player, target, ring, activeContestants);
		if (!this.fumbled) return result;
		this.fumbled = false;
		if (!player.dead) this.dozeOff(player, ring);
		await subEventDelay(ring?.pacingMultiplier);
		return !target.dead;
	}
}

export default LullabyCard;
