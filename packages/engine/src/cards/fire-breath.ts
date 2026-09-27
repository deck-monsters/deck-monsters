import { BlastCard, type BlastCardOptions } from './blast.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import { DRAGON } from '../constants/creature-types.js';
import { WINDED_EFFECT } from '../constants/effect-types.js';
import { COMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';

export const WINDED_AC_PENALTY = 2;

/*
 * The fire breath the requester asked for (docs/roadmap/30-dragon-pack.md). The
 * description quotes Job 41:21 (1611 King James Bible), on Leviathan. Blast is the model:
 * the same damage to every opponent (3 +1 per level; the spec started a point lower and
 * `sim:monster Dragon` left the Dragon too weak early), rarer, and it leaves the Dragon
 * "winded": 2 AC down until its next card, the same penalty and give-back as the Unicorn's
 * Gloaming Rest. That is the opening 29 asked for: a burst the whole ring can see coming
 * back at it, instead of a better-looking Blast.
 */
export class FireBreathCard extends BlastCard {
	static cardType = 'Fire Breath';
	static permittedClassesAndTypes = [DRAGON];
	static probability = COMMON.probability;
	static description =
		'"His breath kindleth coals, and a flame goeth out of his mouth." Everyone in front of it burns. Then the dragon must breathe in.';
	static level = 0;
	static cost = REASONABLE.cost;
	static defaults = {
		damage: 3,
		levelDamage: 1,
	};
	static flavors = {
		hits: [
			['breathes fire on', 80],
			['scorches', 70],
			['kindles coals around', 50],
			['roasts', 40],
			['very gently toasts', 5],
		],
	};

	constructor({ damage, icon = '🔥', levelDamage }: Partial<BlastCardOptions> = {}) {
		super({ damage, icon, levelDamage });
	}

	override get stats(): string {
		return `Fire Breath: ${this.damage} fire damage +${this.levelDamage} per level of the dragon to every opponent.
Winded afterwards: -${WINDED_AC_PENALTY} ac until your next card.`;
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
