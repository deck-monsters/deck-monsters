import { CloakOfInvisibilityCard } from './cloak-of-invisibility.js';
import { subEventDelay } from '../helpers/delay-times.js';
import { agree } from '../helpers/pronouns.js';
import { capitalize } from '../helpers/capitalize.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import { DRAGON } from '../constants/creature-types.js';
import { FURY_EFFECT, INVISIBILITY_EFFECT } from '../constants/effect-types.js';
import { RARE } from '../helpers/probabilities.js';
import { PRICEY } from '../helpers/costs.js';
import { empowerMelee } from './helpers/empower-melee.js';

export const FURY_DAMAGE_DICE = '1d6';

export const isFurious = (monster: any): boolean =>
	!!monster?.encounterEffects?.some((effect: any) => effect.effectType === FURY_EFFECT);

/*
 * The requester likes dragons whose colour follows their mood; the owner chose "mood
 * follows HP" (docs/archive/roadmap/30-dragon-pack.md). The mood is read from HP when the card is
 * played, and said out loud, so it is never a hidden roll:
 *   - calm (above half HP, i.e. not `bloodied`): hide exactly as Cloak of Invisibility does,
 *     with Cloak's answers (area cards, and the 1d20 search against INT);
 *   - furious (bloodied): no hiding, and any hiding already on is stripped; the next melee
 *     hit, whenever it comes, does +1d6 damage.
 * The description plays on Pliny's chameleon (Natural History book 8, in Holland's 1601
 * English), which takes the colour of whatever it is near.
 */
export class MoodScalesCard extends CloakOfInvisibilityCard {
	static cardType = 'Mood Scales';
	static permittedClassesAndTypes = [DRAGON];
	static probability = RARE.probability;
	static description =
		"Pliny's chameleon taketh the colour of whatsoever it is next unto. A dragon's scales take the colour of its temper.";
	static level = 1;
	static cost = PRICEY.cost;
	static notForSale = true;

	constructor({ icon = '🦎' }: Record<string, any> = {}) {
		super({ icon });
	}

	override get stats(): string {
		return `Calm (above half your hp): your scales match the rocks and sea, and you are hidden until you play a card that targets another player, or for the next 2 cards you play (1d20 vs your int for an opponent to find you).
Furious (half your hp or less): your scales blaze red and you cannot hide, but your next melee hit does +${FURY_DAMAGE_DICE} damage.`;
	}

	override hideNarration(target: any): string {
		return `${this.icon} ${target.givenName} is calm. ${capitalize(target.pronouns.his)} scales turn the colour of the rocks and the sea, and ${target.pronouns.he} ${agree(target.pronouns, 'fades', 'fade')} from sight.`;
	}

	override concealNarration(target: any): string {
		return `${target.givenName} holds very still, and the colours deepen.`;
	}

	override revealNarration(target: any): string {
		return `${target.givenName}'s scales flush with colour again.`;
	}

	/** Arm the fury: the next melee hit the monster makes, however many cards away. */
	enrage(target: any): void {
		const fury = ({ card, phase, player }: any) => {
			if (phase !== ATTACK_PHASE || player !== target) return card;
			if (!empowerMelee(card, target, { damageDice: FURY_DAMAGE_DICE })) return card;

			target.encounterEffects = target.encounterEffects.filter((effect: any) => effect !== fury);
			this.emit('narration', {
				narration: `${target.givenName} strikes in a fury!`,
			});
			return card;
		};

		fury.effectType = FURY_EFFECT;
		target.encounterEffects = [
			...target.encounterEffects.filter((effect: any) => effect.effectType !== INVISIBILITY_EFFECT),
			fury,
		];
	}

	override async effect(player: any, target: any, ring?: any): Promise<boolean> {
		if (!target.bloodied) return super.effect(player, target);

		if (isFurious(target)) {
			this.emit('narration', {
				narration: `${target.givenName} is already furious, and glows a little redder.`,
			});
			return true;
		}

		this.enrage(target);
		this.emit('narration', {
			narration: `${this.icon} ${target.givenName} is furious! ${capitalize(target.pronouns.his)} scales blaze red, and there is no hiding now. (Next melee hit: +${FURY_DAMAGE_DICE} damage.)`,
		});
		await subEventDelay(ring?.pacingMultiplier);
		return true;
	}
}

export default MoodScalesCard;
