import BaseCreature, {
	type CardInstance,
	type ChannelFn,
} from '../creatures/base.js';
import { characterCard, monsterCard } from '../helpers/card.js';
import { HERO } from '../constants/creature-classes.js';
import buyItems from '../items/store/buy.js';
import sellItems from '../items/store/sell.js';

// Lazy-load cards helpers to avoid circular dependency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _getInitialDeck: (arg?: unknown, character?: BaseCharacter) => CardInstance[] = () => [];
let _sortCardsAlphabetically: (cards: CardInstance[]) => CardInstance[] = cards => cards;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _isMatchingItem: (a: any, b: any) => boolean = () => false;

const loadHelpers = async () => {
	const [deckModule, sortModule, matchModule] = await Promise.all([
		import('../cards/helpers/deck.js').catch(() => null),
		import('../cards/helpers/sort.js').catch(() => null),
		import('../items/helpers/is-matching.js').catch(() => null),
	]);

	if (deckModule) {
		_getInitialDeck =
			(deckModule as any).getInitialDeck ??
			(deckModule as any).default ??
			_getInitialDeck;
	}
	if (sortModule) {
		_sortCardsAlphabetically =
			(sortModule as any).sortCardsAlphabetically ??
			(sortModule as any).default ??
			_sortCardsAlphabetically;
	}
	if (matchModule) {
		_isMatchingItem =
			(matchModule as any).default ??
			(matchModule as any).isMatchingItem ??
			_isMatchingItem;
	}
};

export const characterBaseReady = loadHelpers().catch((err) => {
	console.error('[engine] characterBaseReady FAILED — character base helpers will be stubs:', err);
});

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

class BaseCharacter extends BaseCreature {
	constructor(options: Record<string, unknown> = {}) {
		const defaultOptions = { deck: [] };
		super(Object.assign(defaultOptions, options));

		if (this.name === BaseCharacter.name) {
			throw new Error('The BaseCharacter should not be instantiated directly!');
		}
	}

	get cards(): CardInstance[] {
		if (
			this.options.deck === undefined ||
			(this.options.deck as CardInstance[]).length <= 0
		) {
			this.deck = _getInitialDeck(undefined, this);
		}
		return (this.options.deck as CardInstance[]) || [];
	}

	set cards(deck: CardInstance[]) {
		this.setOptions({ deck });
	}

	get deck(): CardInstance[] {
		return this.cards;
	}

	set deck(deck: CardInstance[]) {
		this.cards = deck;
	}

	get detailedStats(): string {
		return `${super.stats}\nCoins: ${this.coins}`;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	canHold(object: { level?: number }): boolean {
		return !object.level || object.level <= this.level;
	}

	addCard(card: CardInstance): void {
		this.deck = _sortCardsAlphabetically([...this.deck, card]);
		this.emit('cardAdded', { card });
	}

	removeCard(cardToRemove: CardInstance): CardInstance | undefined {
		let foundCard: CardInstance | undefined;

		this.deck = this.deck.filter((card: CardInstance) => {
			const shouldKeepCard = foundCard || !_isMatchingItem(card, cardToRemove);
			if (!shouldKeepCard) foundCard = card;
			return shouldKeepCard;
		});

		if (foundCard) this.emit('cardRemoved', { card: foundCard });

		return foundCard;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	get monsters(): any[] {
		return ((this.options as any).monsters as any[]) || [];
	}

	look(channel: ChannelFn, inDetail?: boolean): Promise<void> {
		return Promise.resolve().then(() => {
			channel({ announce: characterCard(this as any, inDetail) });
		});
	}

	lookAtMonsters(channel: ChannelFn, description?: boolean): Promise<void> {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const monstersDisplay = (this.monsters as any[]).reduce(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(acc: string, monster: any) => acc + monsterCard(monster as any, description),
			'',
		);

		if (monstersDisplay) {
			return Promise.resolve().then(() => { channel({ announce: monstersDisplay }); });
		}

		return Promise.reject(
			channel({ announce: 'You do not currently have any monsters.', delay: 'short' }),
		);
	}

	lookAtCards(channel: ChannelFn): Promise<void> {
		const deck: CardInstance[] = (this.deck as CardInstance[]) || [];

		if (deck.length < 1) {
			channel({ announce: "Strangely enough, somehow you don't have any cards.", delay: 'short' });
			return Promise.resolve();
		}

		const sorted = _sortCardsAlphabetically(deck);
		const numbered = sorted
			.map((card: CardInstance, i: number) => `${i + 1}) ${(card as any).itemType || (card as any).name}`)
			.join('\n');

		return Promise.resolve().then(() => { channel({ announce: `Cards:\n${numbered}` }); });
	}

	sellItems(channel: ChannelFn): Promise<void> {
		return sellItems({ character: this as any, channel: channel as any });
	}

	buyItems(channel: ChannelFn): Promise<void> {
		return buyItems({ character: this as any, channel: channel as any });
	}
}

BaseCharacter.class = HERO;

export { BaseCharacter };
export default BaseCharacter;
