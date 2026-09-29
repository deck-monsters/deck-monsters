import { BaseCard, type CardOptions } from './base.js';
import { chance } from '../helpers/chance.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { getTarget, TARGET_ALL_CONTESTANTS } from '../helpers/targeting-strategies.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import { AOE, HEAL } from '../constants/card-classes.js';
import { DRAGON } from '../constants/creature-types.js';
import { BURNING_EFFECT, WINDED_EFFECT } from '../constants/effect-types.js';
import { COMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';
import { ANCIENT_DRAGON_LEVEL, isAncientDragon } from './helpers/ancient-dragon.js';

const { roll } = chance;

export const WINDED_AC_PENALTY = 2;
export const BREATH_BASE_DAMAGE = 2;
export const DODGE_DIFFICULTY = 15;
export const BURN_TURNS = 2;
export const ANCIENT_BURN_TURNS = 3;

/** Opponents the breath reaches: two, and one more for every two levels. */
export const breathReach = (level: number): number => 2 + Math.floor(Math.max(0, level) / 2);

/** Fire damage a burning monster takes at the start of each of its turns. */
export const burnDamage = (level: number): number => 1 + Math.floor(Math.max(0, level) / 3);

export const isBurning = (monster: any): boolean =>
	!!monster?.encounterEffects?.some((effect: any) => effect.effectType === BURNING_EFFECT);

/*
 * The fire breath the requester asked for (docs/archive/roadmap/30-dragon-pack.md). The
 * description quotes Job 41:21 (1611 King James Bible), on Leviathan.
 *
 * It started as Blast with a cost, and the owner asked for something that plays
 * differently (2026-09-27). What makes it fire rather than magic:
 *   - a cone, not the whole ring: the chosen target and the opponents beside it in ring
 *     order, two at first and one more every two levels (most play happens at levels 0-6,
 *     so the reach grows where players are);
 *   - it can be dodged, barely: each target rolls 1d20 + DEX against 15 + the dragon's INT
 *     (Blast, being magic, cannot be dodged). A dodge takes half damage and does not burn;
 *   - it burns: anyone it catches takes fire damage at the start of their next two turns.
 *     A new breath rekindles the burn rather than stacking it, and a heal puts it out;
 *   - an ancient dragon (level 10+, cards/helpers/ancient-dragon.ts) breathes fire that
 *     cannot be dodged and burns a turn longer;
 *   - and the dragon is winded afterwards: 2 AC down until its next card, the same penalty
 *     and give-back as Gloaming Rest. The owner kept this as the visible price.
 */
export class FireBreathCard extends BaseCard {
	static cardClass = [AOE];
	static cardType = 'Fire Breath';
	static permittedClassesAndTypes = [DRAGON];
	static probability = COMMON.probability;
	static description =
		'"His breath kindleth coals, and a flame goeth out of his mouth." Whatever the flame touches keeps burning.';
	static level = 0;
	static cost = REASONABLE.cost;
	static flavors = {
		hits: [
			['breathes fire on', 80],
			['scorches', 70],
			['kindles coals around', 50],
			['roasts', 40],
			['sings the old fire-song over', 30],
			['very gently toasts', 5],
		],
	};

	constructor({ icon = '🔥' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		return `A cone of fire: your target and the opponents beside it, ${breathReach(0)} at first and 1 more every 2 levels.
${BREATH_BASE_DAMAGE} fire damage +1 per level. Each target rolls 1d20 + dex vs ${DODGE_DIFFICULTY} + your int to dodge for half damage.
Anyone who does not dodge burns: 1 damage +1 per 3 levels at the start of their next ${BURN_TURNS} turns (a heal puts it out).
Winded afterwards: -${WINDED_AC_PENALTY} ac until your next card.
An ancient dragon (level ${ANCIENT_DRAGON_LEVEL}+) breathes fire that cannot be dodged and burns for ${ANCIENT_BURN_TURNS} turns.`;
	}

	/**
	 * The cone: every opponent the ring would let the dragon target, in ring order, starting
	 * at the proposed target and wrapping round, cut to the reach.
	 */
	override getTargets(player: any, proposedTarget: any, ring: any, activeContestants: any): any[] {
		const opponents = (getTarget({
			contestants: activeContestants,
			playerMonster: player,
			strategy: TARGET_ALL_CONTESTANTS,
			ring,
		}) as any[]).map(({ monster }: any) => monster);
		const start = Math.max(0, opponents.indexOf(proposedTarget));
		const inRingOrder = [...opponents.slice(start), ...opponents.slice(0, start)];
		return inRingOrder.slice(0, breathReach(player.level));
	}

	/** 1d20 + the target's DEX against 15 + the dragon's INT; meeting it dodges. */
	dodge(player: any, target: any): boolean {
		const difficulty = DODGE_DIFFICULTY + player.intModifier;
		const dodgeRoll = roll({ primaryDice: '1d20', modifier: target.dexModifier, crit: true });
		const { success: dodged } = this.checkSuccess(dodgeRoll, difficulty - 1);

		this.emit('rolled', {
			reason: `vs ${difficulty} to dodge the flames.`,
			card: this,
			roll: dodgeRoll,
			who: target,
			outcome: dodged
				? `${target.givenName} twists aside and is only singed. Half damage.`
				: `${target.givenName} is caught in the flames.`,
			vs: difficulty,
		});

		return dodged;
	}

	/** Set (or rekindle) the burn on `target`, fed by `player`'s level. */
	ignite(player: any, target: any): void {
		let turnsLeft = isAncientDragon(player) ? ANCIENT_BURN_TURNS : BURN_TURNS;
		const damage = burnDamage(player.level);

		const burning = async ({ card, phase, player: effectPlayer, ring }: any) => {
			if (phase !== ATTACK_PHASE || effectPlayer !== target) return card;

			const stopBurning = () => {
				target.encounterEffects = target.encounterEffects.filter((effect: any) => effect !== burning);
			};

			if (card.isCardClass?.(HEAL)) {
				stopBurning();
				this.emit('narration', { narration: `${target.givenName} beats out the flames.` });
				return card;
			}

			turnsLeft -= 1;
			if (turnsLeft <= 0) stopBurning();
			await subEventDelay(ring?.pacingMultiplier);
			// The hit line would otherwise replay the breath ("Skarn scorches Bram"); a burn is
			// its own line. Set on this card for this one hit and cleared after, as Tsunami does.
			(this as any).flavorText = `🔥 ${target.icon}  ${target.givenName} is still burning: ${damage} fire damage.${turnsLeft <= 0 ? ' The last of the flames go out.' : ''}`;
			let alive: boolean;
			try {
				alive = await target.hit(damage, player, this);
			} finally {
				delete (this as any).flavorText;
			}

			// Burned to nothing before the card could be played: it does nothing, as a held
			// monster's card does (ImmobilizeCard).
			if (!alive) {
				stopBurning();
				card.play = () => Promise.resolve(false);
			}
			return card;
		};

		burning.effectType = BURNING_EFFECT;
		target.encounterEffects = [
			...target.encounterEffects.filter((effect: any) => effect.effectType !== BURNING_EFFECT),
			burning,
		];
	}

	async effect(player: any, target: any, ring?: any): Promise<boolean> {
		const full = BREATH_BASE_DAMAGE + player.level;
		// Breathing on yourself in confusion leaves nowhere to dodge to, and an ancient
		// dragon's fire cannot be dodged at all.
		const dodged = target !== player && !isAncientDragon(player) && this.dodge(player, target);
		await subEventDelay(ring?.pacingMultiplier);

		const alive = await target.hit(dodged ? Math.max(1, Math.floor(full / 2)) : full, player, this);
		if (alive && !dodged) this.ignite(player, target);
		return alive;
	}

	/**
	 * Winded until the breather's next card. A second breath while winded is still that next
	 * card, so the first penalty is given back before the second is taken and they never stack.
	 */
	wind(player: any): void {
		if (player.dead) return;

		const winded = ({ card, phase, player: effectPlayer }: any) => {
			if (phase !== ATTACK_PHASE || effectPlayer !== player) return card;

			player.encounterEffects = player.encounterEffects.filter((effect: any) => effect !== winded);
			player.setModifier('ac', WINDED_AC_PENALTY);
			this.emit('narration', {
				narration: `${player.givenName} has ${player.pronouns.his} breath back.`,
			});
			return card;
		};

		winded.effectType = WINDED_EFFECT;
		player.setModifier('ac', -WINDED_AC_PENALTY);
		player.encounterEffects = [...player.encounterEffects, winded];
		this.emit('narration', {
			narration: `${this.icon} ${player.givenName} is winded, and smoke trails from ${player.pronouns.his} nostrils. (-${WINDED_AC_PENALTY} ac until ${player.pronouns.his} next card.)`,
		});
	}

	/**
	 * `play` runs twice: once to apply encounter effects, then on the per-play clone with
	 * `shouldApplyEffects` false, which is the call that hits each target. Wind the player
	 * once, after that call, so the breath costs one penalty however many it burned.
	 */
	override play(
		player: any,
		proposedTarget?: any,
		ring?: any,
		activeContestants?: any,
		shouldApplyEffects = true
	): Promise<any> {
		const played = super.play(player, proposedTarget, ring, activeContestants, shouldApplyEffects);
		if (shouldApplyEffects) return played;

		return played.then(async (result: any) => {
			this.wind(player);
			await subEventDelay(ring?.pacingMultiplier);
			return result;
		});
	}
}

export default FireBreathCard;
