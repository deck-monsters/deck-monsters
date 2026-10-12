import { HealCard } from './heal.js';
import { REASONABLE } from '../helpers/costs.js';
import { chance } from '../helpers/chance.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import { TIPSY_EFFECT } from '../constants/effect-types.js';

const { roll } = chance;

/*
 * Tipsy (owner, 2026-10-12): from the third drink in one round, a monster rolls to hold it.
 * One round is one pass through every deck, so a single Whiskey Shot in a deck can never do
 * it; it takes a deck stacked with drinks, or Random Play and Pick Pocket bringing more.
 * The owner chose the mild version: -1 dex (to hit) and -1 int, for the drinker's next two
 * cards. Another drink while tipsy restarts the clock rather than stacking. Scotch is a
 * Whiskey Shot, so it counts too.
 */
export const TIPSY_DRINKS = 3;
/** 1d20 + str bonus must reach this to hold the drink. */
export const TIPSY_HOLD_DC = 10;
export const TIPSY_PENALTY = 1;
export const TIPSY_CARDS = 2;

export const isTipsy = (monster: any): boolean =>
	!!monster?.encounterEffects?.some((effect: any) => effect.effectType === TIPSY_EFFECT);

export class WhiskeyShotCard extends HealCard {
	static cardType = 'Whiskey Shot';
	static description = "1 shot of whiskey for your health. Doctor's orders.";
	static level = 2;
	static cost = REASONABLE.cost;
	static defaults = {
		...HealCard.defaults,
		healthDice: '1d8',
	};

	constructor({ healthDice, icon = '🥃', ...rest }: Record<string, any> = {}) {
		super({ healthDice, icon, ...rest });
	}

	override get stats(): string {
		return `${super.stats}

${TIPSY_DRINKS} drinks in one round may leave you tipsy: -${TIPSY_PENALTY} dex and int for ${TIPSY_CARDS} cards`;
	}

	override async effect(player: any, target: any, ring?: any, activeContestants?: any): Promise<any> {
		const result = await super.effect(player, target, ring, activeContestants);
		if (!target.dead) this.drink(target);
		return result;
	}

	/** Count the drink for this round, and from the third, roll to hold it. */
	drink(drinker: any): void {
		const round = typeof drinker.round === 'number' ? drinker.round : 1;
		const previous = drinker.encounterModifiers.drinks;
		const count = previous?.round === round ? previous.count + 1 : 1;
		drinker.encounterModifiers.drinks = { round, count };
		if (count < TIPSY_DRINKS) return;

		const holdRoll = roll({ primaryDice: '1d20', modifier: drinker.strModifier });
		const holds = holdRoll.result >= TIPSY_HOLD_DC;
		this.emit('rolled', {
			success: holds,
			reason: `vs ${TIPSY_HOLD_DC} to hold ${drinker.pronouns.his} ${ordinal(count)} drink this round.`,
			card: this,
			roll: holdRoll,
			who: drinker,
			outcome: holds ? `${drinker.givenName} holds ${drinker.pronouns.his} drink.` : 'Hic!',
			vs: TIPSY_HOLD_DC,
		});
		if (!holds) this.makeTipsy(drinker);
	}

	makeTipsy(drinker: any): void {
		const existing = drinker.encounterEffects.find((effect: any) => effect.effectType === TIPSY_EFFECT);
		if (existing) {
			existing.cardsLeft = TIPSY_CARDS;
			this.emit('narration', {
				narration: `${this.icon} ${drinker.givenName} is still tipsy, and now for ${TIPSY_CARDS} more cards.`,
			});
			return;
		}

		// Upkeep, like winded: it counts the drinker's turns, held ones included, and sobers up
		// at the start of the third, before that card's box (cards/base.ts, "Turn order").
		const tipsy: any = ({ card, phase, player }: any) => {
			if (phase !== ATTACK_PHASE || player !== drinker) return card;
			if (tipsy.cardsLeft > 0) {
				tipsy.cardsLeft -= 1;
				return card;
			}
			drinker.encounterEffects = drinker.encounterEffects.filter((effect: any) => effect !== tipsy);
			// Say why before the stat lines, as winded does.
			this.emit('narration', { narration: `${drinker.givenName} sobers up.` });
			drinker.setModifier('dex', TIPSY_PENALTY);
			drinker.setModifier('int', TIPSY_PENALTY);
			return card;
		};
		tipsy.effectType = TIPSY_EFFECT;
		tipsy.turnStart = 'upkeep';
		tipsy.cardsLeft = TIPSY_CARDS;

		this.emit('narration', {
			narration: `${this.icon} ${drinker.givenName} is tipsy! (-${TIPSY_PENALTY} dex and -${TIPSY_PENALTY} int for ${drinker.pronouns.his} next ${TIPSY_CARDS} cards.)`,
			mechanic: 'tipsy',
		});
		drinker.encounterEffects = [...drinker.encounterEffects, tipsy];
		drinker.setModifier('dex', -TIPSY_PENALTY);
		drinker.setModifier('int', -TIPSY_PENALTY);
	}
}

const ordinal = (n: number): string => (n === 3 ? 'third' : n === 4 ? 'fourth' : n === 5 ? 'fifth' : `${n}th`);

export default WhiskeyShotCard;
