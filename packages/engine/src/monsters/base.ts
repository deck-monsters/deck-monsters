import BaseCreature, {
	type CardInstance,
	type ItemInstance,
	type ChannelFn,
	type Encounter,
} from '../creatures/base.js';
import { actionCard, monsterCard } from '../helpers/card.js';
import { signedNumber } from '../helpers/signed-number.js';
import { getStrategyDescription } from '../helpers/targeting-strategies.js';

// Lazy-load cards helpers to avoid circular dependency issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _getUniqueCards: (cards: CardInstance[]) => CardInstance[] = (cards: any[]) => cards;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sortCardsAlphabetically: (cards: CardInstance[]) => CardInstance[] = (cards: any[]) => cards;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _isMatchingItem: (a: any, b: any) => boolean = () => false;

const loadCardHelpers = async () => {
	const [cardsModule, isMatchingModule] = await Promise.all([
		import('../cards/helpers/unique-cards.js').catch(() => null),
		import('../items/helpers/is-matching.js').catch(() => null),
	]);

	if (cardsModule) {
		_getUniqueCards =
			(cardsModule as any).getUniqueCards ??
			(cardsModule as any).default ??
			_getUniqueCards;
	}

	// sortCardsAlphabetically may live in cards/helpers/sort
	const sortModule = await import('../cards/helpers/sort.js').catch(() => null);
	if (sortModule) {
		_sortCardsAlphabetically =
			(sortModule as any).sortCardsAlphabetically ??
			(sortModule as any).default ??
			_sortCardsAlphabetically;
	}

	if (isMatchingModule) {
		_isMatchingItem =
			(isMatchingModule as any).default ??
			(isMatchingModule as any).isMatchingItem ??
			_isMatchingItem;
	}
};

loadCardHelpers().catch(() => {
	// Cards helpers may not exist yet during generation; stubs remain in place
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CARD_SLOTS = 9;
const DEFAULT_ITEM_SLOTS = 3;

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

class BaseMonster extends BaseCreature {
	constructor(options: Record<string, unknown> = {}) {
		super(options);

		if (this.name === BaseMonster.name) {
			throw new Error('The BaseMonster should not be instantiated directly!');
		}
	}

	get hand(): CardInstance[] {
		return this.cards;
	}

	set hand(hand: CardInstance[]) {
		this.cards = hand;
	}

	get cardSlots(): number {
		return DEFAULT_CARD_SLOTS;
	}

	set cardSlots(cardSlots: number) {
		this.setOptions({ cardSlots });
	}

	// eslint-disable-next-line class-methods-use-this
	get itemSlots(): number {
		return DEFAULT_ITEM_SLOTS;
	}

	get stats(): string {
		const bonuses: string[] = [];

		const dexMod = (this.options.dexModifier ?? 0) as number;
		const strMod = (this.options.strModifier ?? 0) as number;
		const intMod = (this.options.intModifier ?? 0) as number;

		if (dexMod !== 0) {
			bonuses.push(`${signedNumber(dexMod)} dex ${dexMod > 0 ? 'bonus' : 'penalty'}`.trim());
		}
		if (strMod !== 0) {
			bonuses.push(`${signedNumber(strMod)} str ${strMod > 0 ? 'bonus' : 'penalty'}`.trim());
		}
		if (intMod !== 0) {
			bonuses.push(`${signedNumber(intMod)} int ${intMod > 0 ? 'bonus' : 'penalty'}`.trim());
		}

		const strategyLine = !this.targetingStrategy
			? ''
			: `\nStrategy: ${getStrategyDescription(this.targetingStrategy)}`;

		return `${super.stats}

ac: ${this.ac} | hp: ${this.hp}/${this.maxHp}
dex: ${this.dex} | str: ${this.str} | int: ${this.int}
${bonuses.join('\n')}${strategyLine}`;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	canHold(object: { level?: number; permittedClassesAndTypes?: string[] }): boolean {
		const appropriateLevel = !object.level || object.level <= this.level;
		const appropriateClassOrType =
			!object.permittedClassesAndTypes ||
			object.permittedClassesAndTypes.includes(this.class as string) ||
			object.permittedClassesAndTypes.includes(this.creatureType as string);

		return appropriateLevel && appropriateClassOrType;
	}

	resetCards({ matchCard }: { matchCard?: CardInstance } = {}): void {
		const shouldReset =
			!matchCard || !!this.cards.find(card => _isMatchingItem(card, matchCard));

		if (shouldReset) this.cards = [];
	}

	get emptyHanded(): boolean {
		return !!((this.encounter ?? {}) as Record<string, unknown>).emptyHanded;
	}

	set emptyHanded(emptyHanded: boolean) {
		this.encounter = {
			...this.encounter,
			emptyHanded,
		} as any; // eslint-disable-line @typescript-eslint/no-explicit-any
	}

	startEncounter(ring: unknown): void {
		super.startEncounter(ring);
		this.items.forEach(
			(item: ItemInstance) =>
				item.onStartEncounter &&
				item.onStartEncounter({ monster: this, ring }),
		);
	}

	endEncounter(): Encounter {
		this.items.forEach(
			(item: ItemInstance) =>
				item.onEndEncounter &&
				item.onEndEncounter({ monster: this, ring: (this.encounter as any)?.ring }),
		);
		return super.endEncounter();
	}

	look(channel: ChannelFn, inDetail?: boolean): Promise<void> {
		return Promise.resolve()
			.then(() => channel({ announce: monsterCard(this as any, true) }))
			.then(() => inDetail && (this.lookAtCards(channel, inDetail) as any));
	}

	lookAtCards(channel: ChannelFn, inDetail?: boolean): Promise<void> {
		let cards: CardInstance[] = [...this.cards];

		if (!inDetail) {
			const sortedDeck = _sortCardsAlphabetically(cards);
			cards = _getUniqueCards(sortedDeck);
		}

		let announce: string;

		if (cards.length > 0) {
			announce = cards.reduce(
				(previousCards: string, card: CardInstance) => previousCards + actionCard(card as any),
				'Cards:\n',
			);
		} else {
			announce = `${this.givenName}'s hand is empty.`;
		}

		return Promise.resolve().then(() => { channel({ announce }); });
	}
}

export { BaseMonster };
export default BaseMonster;
