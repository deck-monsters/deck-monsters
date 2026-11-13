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
Does nothing to a Weeping Angel, or to anyone already asleep.`;
	}

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
					? `${player.givenName} yawns in the middle of the verse.`
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

		return success;
	}

	override async effect(player: any, target: any, ring: any, activeContestants?: any): Promise<any> {
		const alreadyHeld = target.encounterEffects.some((effect: any) => effect.effectType === 'ImmobilizeEffect');
		if (alreadyHeld || this.uselessAgainstCreatureTypes.includes(target.creatureType)) {
			this.emit('narration', {
				// DRAFT(39)
				narration: alreadyHeld
					? `${this.icon} ${target.givenName} is already out cold, and ${player.givenName} lets ${target.pronouns.him} sleep.`
					: `${this.icon} ${player.givenName} sings to ${target.givenName}, who is stone and does not doze.`,
			});
			await subEventDelay(ring?.pacingMultiplier);
			return !target.dead;
		}

		return super.effect(player, target, ring, activeContestants);
	}
}

export default LullabyCard;
