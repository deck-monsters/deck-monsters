import { HealCard } from './heal.js';
import { REASONABLE } from '../helpers/costs.js';
import { chance } from '../helpers/chance.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import { TIPSY_EFFECT } from '../constants/effect-types.js';
import { capitalize } from '../helpers/capitalize.js';

const { roll } = chance;

/*
 * Tipsy (owner, 2026-10-12): from the third drink in one round, a monster rolls to hold it.
 * One round is one pass through every deck, so a single Whiskey Shot in a deck can never do
 * it; it takes a deck stacked with drinks, or Random Play and Pick Pocket bringing more.
 * It lasts for the drinker's next two cards. Another drink while tipsy restarts the clock
 * rather than stacking or rerolling. Scotch is a Whiskey Shot, so it counts too.
 *
 * What kind of tipsy is a 1d6 on TIPSY_TABLE (owner, 2026-10-14; it was a flat -1 dex and
 * -1 int). A table roll, not a check, so a 1 or a 6 is no crit (helpers/chance.ts).
 */
export const TIPSY_DRINKS = 3;
/** 1d20 + str bonus must reach this to hold the drink. */
export const TIPSY_HOLD_DC = 10;
export interface TipsyKind {
	dex: number;
	int: number;
	/** "<name> is tipsy! <how>": the line that says which way the drink went. */
	how: string;
}
/** 1d6, in face order. 5 is the Ballmer peak: just drunk enough to be sharper. */
export const TIPSY_TABLE: TipsyKind[] = [
	{ dex: 0, int: -1, how: 'a little foggy' },
	{ dex: 0, int: -2, how: 'thoroughly befuddled' },
	{ dex: -1, int: 0, how: 'a little unsteady' },
	{ dex: -2, int: 0, how: 'staggering' },
	{ dex: 1, int: 1, how: 'at the Ballmer peak, sharper for it' },
	{ dex: -2, int: -2, how: 'properly drunk' },
];
const TIPSY_DIE = `1d${TIPSY_TABLE.length}`;

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
/** "-2 dex", "+1 dex and +1 int": only the stats the kind moves. */
const tipsyEffects = ({ dex, int }: TipsyKind): string =>
	[dex ? `${signed(dex)} dex` : '', int ? `${signed(int)} int` : ''].filter(Boolean).join(' and ');
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

${TIPSY_DRINKS} drinks in one round may leave you tipsy for ${TIPSY_CARDS} cards. Roll ${TIPSY_DIE}: ${TIPSY_TABLE.map((kind, i) => `${i + 1}: ${tipsyEffects(kind)}`).join('; ')}`;
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
		// Already tipsy: any further drink restarts the clock, held or not (PR #432 review).
		if (!holds || isTipsy(drinker)) this.makeTipsy(drinker);
	}

	/** Roll 1d6 on TIPSY_TABLE and show the roll. */
	rollTipsyKind(drinker: any): TipsyKind {
		const kindRoll = roll({ primaryDice: TIPSY_DIE });
		const kind = TIPSY_TABLE[kindRoll.result - 1];
		this.emit('rolled', {
			reason: 'to see what kind of tipsy.',
			card: this,
			roll: kindRoll,
			who: drinker,
			outcome: `${capitalize(kind.how)}: ${tipsyEffects(kind)}.`,
		});
		return kind;
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

		const kind = this.rollTipsyKind(drinker);

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
			// Undo exactly what this drink did, whichever way it went.
			if (kind.dex) drinker.setModifier('dex', -kind.dex);
			if (kind.int) drinker.setModifier('int', -kind.int);
			return card;
		};
		tipsy.effectType = TIPSY_EFFECT;
		tipsy.turnStart = 'upkeep';
		tipsy.cardsLeft = TIPSY_CARDS;
		tipsy.kind = kind;

		this.emit('narration', {
			narration: `${this.icon} ${drinker.givenName} is tipsy, ${kind.how}! (${tipsyEffects(kind)} for ${drinker.pronouns.his} next ${TIPSY_CARDS} cards.)`,
			mechanic: 'tipsy',
		});
		drinker.encounterEffects = [...drinker.encounterEffects, tipsy];
		if (kind.dex) drinker.setModifier('dex', kind.dex);
		if (kind.int) drinker.setModifier('int', kind.int);
	}
}

const ordinal = (n: number): string => (n === 3 ? 'third' : n === 4 ? 'fourth' : n === 5 ? 'fifth' : `${n}th`);

export default WhiskeyShotCard;
