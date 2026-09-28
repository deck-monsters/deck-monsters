import { random, sample, shuffle } from '../../helpers/random.js';
import { XP_PER_VICTORY } from '../../helpers/experience.js';
import { BOSS_PERSONALITIES } from '../../helpers/boss-personalities.js';
import Beastmaster from '../beastmaster.js';
import { RING_PATRON_ICON, RING_PATRON_NAME } from '../../constants/lore.js';
import { HEAL } from '../../constants/card-classes.js';
import {
	BASILISK,
	DRAGON,
	GLADIATOR,
	JINN,
	MINOTAUR,
	UNICORN,
	WEEPING_ANGEL,
} from '../../constants/creature-types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

let _randomColor: () => [string, string] = () => ['', 'gray'];
let _randomEmoji: () => string = () => '🎲';
let _allMonsters: any[] = [];
let _fillDeck: AnyFn = (deck: unknown[]) => deck;
let _getMinimumDeck: AnyFn = () => [];

const loadHelpers = async () => {
	const [colorModule, emojiModule, monstersModule, deckModule] = await Promise.all([
		import('grab-color-names').catch(() => null),
		import('node-emoji').catch(() => null),
		import('../../monsters/helpers/all.js').catch(() => null),
		import('../../cards/helpers/deck.js').catch(() => null),
	]);

	if (colorModule) {
		// grab-color-names is CommonJS: under ESM `import()` its functions sit on `default`,
		// and the named export this used to read was always undefined. The fallback won every
		// time, so every generated boss was "gray" — invisible until roadmap 24 started
		// colouring sprites from it. Same default-or-namespace shape as node-emoji below.
		const colors = (colorModule as any).default ?? colorModule;
		_randomColor = colors?.randomColor ?? _randomColor;
	}
	if (emojiModule) {
		const emoji = (emojiModule as any).default ?? emojiModule;
		if (emoji?.random) {
			_randomEmoji = () => emoji.random().emoji;
		}
	}
	if (monstersModule) {
		_allMonsters =
			(monstersModule as any).default ??
			(monstersModule as any).allMonsters ??
			_allMonsters;
	}
	if (deckModule) {
		_fillDeck = (deckModule as any).fillDeck ?? _fillDeck;
		_getMinimumDeck = (deckModule as any).getMinimumDeck ?? _getMinimumDeck;
	}
};

/** Resolves once all dynamic helpers (monsters, colors, emoji, deck) are loaded.
 *  Await this in test `before` hooks when tests depend on randomCharacter() producing a
 *  fully-populated character with monsters.
 */
export const helpersReady = loadHelpers().catch((err) => {
	console.error('[engine] randomCharacter helpersReady FAILED — random characters will be empty:', err);
});

export interface RandomCharacterOptions {
	battles?: { total: number; wins: number; losses: number };
	isBoss?: boolean;
	Monsters?: any[];
	name?: string;
	gender?: string;
	icon?: string;
	[key: string]: unknown;
}

/**
 * What a boss may hold (owner, roadmap 33). The original engine dropped a hand-written list
 * (Flee, Harden, Heal, Hit, Whiskey Shot) from boss decks, and its last refill let some back:
 * on main about 17% of boss hand slots were basics, a third of boss hands held a heal, and
 * none held Flee. The intent was bosses that press the attack rather than run or stall, not
 * bosses with no basic cards. So: a boss never holds Flee, and a hand holds at most
 * `BOSS_MAX_HEALS` plain heals (a heal card any monster can hold: Heal, Whiskey Shot, Scotch,
 * Revive). Plain Hits, boosts, and shields are held like any other card; monster-specific
 * heals such as Gloaming Rest and Horn of Proof are powers, not stalling, and are uncapped.
 */
export const BOSS_MAX_HEALS = 1;
const MONSTER_TYPES = [BASILISK, GLADIATOR, JINN, MINOTAUR, WEEPING_ANGEL, UNICORN, DRAGON];
const cardClasses = (card: any): string[] => card.cardClass ?? card.constructor?.cardClass ?? [];
const permittedHolders = (card: any): string[] =>
	card.permittedClassesAndTypes ?? card.constructor?.permittedClassesAndTypes ?? [];

/** A heal any monster could hold, which a boss may carry only `BOSS_MAX_HEALS` of. */
export const isPlainHeal = (card: any): boolean =>
	cardClasses(card).includes(HEAL) && !permittedHolders(card).some(holder => MONSTER_TYPES.includes(holder));

/**
 * The original engine's weak list, kept as it behaved on main: filtered out of the starting
 * deck and the first refill, then one more refill tops the deck up. That leaves basics in a
 * boss hand at about 17% of slots. Filtering every refill left none; filtering none gave 3.3
 * plain Hits a hand. The owner's intent is less filler, not none.
 */
const BOSS_WEAK_TYPES = ['Flee', 'Harden', 'Heal', 'Hit', 'Whiskey Shot'];
const isBossWeak = (card: any): boolean => BOSS_WEAK_TYPES.includes(card.cardType);

/** Never in a boss deck: a boss does not run. */
export const isBossBanned = (card: any): boolean => card.cardType === 'Flee';

/** A boss hand from its shuffled options: at most `BOSS_MAX_HEALS` plain heals, in order. */
export const pickBossHand = (options: any[], slots: number): any[] => {
	const hand: any[] = [];
	let heals = 0;
	for (const card of options) {
		if (hand.length >= slots) break;
		if (isBossBanned(card)) continue;
		if (isPlainHeal(card)) {
			if (heals >= BOSS_MAX_HEALS) continue;
			heals += 1;
		}
		hand.push(card);
	}
	return hand;
};

/**
 * `fillDeck` tops a deck up to its minimum; `clean` drops what a boss must not hold (a no-op
 * for a player). Repeat until a refill adds nothing `clean` removes, with a bound so a pool
 * made only of filler still returns.
 */
const fillWithoutFiller = (deck: any[], creature: any, clean: (deck: any[]) => any[]): any[] => {
	let current = deck;
	for (let attempt = 0; attempt < 50; attempt += 1) {
		const filled = _fillDeck([...current], {}, creature);
		const kept = clean(filled);
		if (kept.length === filled.length) return filled;
		current = kept;
	}
	return current;
};

const randomCharacter = ({
	battles,
	isBoss,
	Monsters,
	...options
}: RandomCharacterOptions = {}): Beastmaster => {
	const resolvedBattles = battles ?? {
		total: random(0, 180),
		wins: 0,
		losses: 0,
	};

	if (!resolvedBattles.wins) resolvedBattles.wins = random(0, resolvedBattles.total);
	if (!resolvedBattles.losses)
		resolvedBattles.losses = resolvedBattles.total - resolvedBattles.wins;

	const icon = _randomEmoji();
	const xp = XP_PER_VICTORY * resolvedBattles.wins;

	const MonsterClasses = Monsters ?? (_allMonsters.length ? [sample(_allMonsters as any[])] : []);

	const monsters = MonsterClasses.map((Monster: any) => {
		// [hex, name]. The name reads well in prose ("a cabaret basilisk") but most of the
		// library's 1,500+ names ("Sazerac", "Kilamanjaro") are not colour words the web can
		// read, so the hex travels with it for the sprite palette.
		const [colorHex, colorName] = _randomColor();
		const monster = new Monster({
			battles: resolvedBattles,
			color: colorName.toLowerCase(),
			...(/^[0-9a-f]{6}$/i.test(colorHex) ? { colorHex: `#${colorHex.toLowerCase()}` } : {}),
			isBoss,
			xp,
			...options,
		});

		if (isBoss) {
			const { canHold } = monster;
			monster.canHold = (object: any) =>
				canHold.call(monster, object) && !object.noBosses;
			// Each boss draws a temperament (helpers/boss-personalities.ts); they used to share
			// TARGET_HUMAN_PLAYER_WEAK and all act alike.
			monster.targetingStrategy = sample([...BOSS_PERSONALITIES])!.strategy;
		}

		return monster;
	});

	/*
	 * Every boss belongs to the house, so the house is who it is generated as — not a
	 * beastmaster invented on the spot and then papered over at each announcement.
	 *
	 * #102 fixed boss arrivals and departures by substituting the patron at those two call
	 * sites, which left every *other* line still printing the invented name: the turn banner
	 * read "It's Hopewing's turn." with a boss in the ring, and fight summaries recorded the
	 * same. Naming the character itself means `givenName` and `icon` are already right
	 * wherever they are read, including sites nobody has thought of yet.
	 *
	 * An explicit name or icon still wins, so a caller can stage a named antagonist.
	 * Only the owner is named this way — the boss monster keeps its own generated name.
	 */
	const bossOwnerIdentity = isBoss
		? {
				name: options.name ?? RING_PATRON_NAME,
				icon: options.icon ?? RING_PATRON_ICON,
			}
		: {};

	const character = new Beastmaster({
		battles: resolvedBattles,
		icon,
		isBoss,
		monsters,
		xp,
		...options,
		...bossOwnerIdentity,
	});

	const cleanBossDeck = (deck: any[]): any[] =>
		isBoss ? deck.filter((card: any) => !isBossBanned(card)) : deck;

	if (isBoss) {
		// Top up and filter until a refill adds no banned card. The last refill used to go
		// unfiltered, so the filter was partly undone (a Codex review of PR #407).
		const withoutWeak = (deck: any[]) => deck.filter((card: any) => !isBossWeak(card));
		let deck = withoutWeak(_getMinimumDeck());
		deck = withoutWeak(_fillDeck(deck, {}, character));
		// The last top-up may bring basics back, but never Flee (a Codex review of PR #407
		// found this refill unfiltered).
		character.deck = fillWithoutFiller(deck, character, cleanBossDeck);

		character.deck.forEach((card: any) => {
			if (typeof card.levelUp === 'function') {
				card.levelUp(random(0, 6));
			}
		});
	}

	monsters.forEach((monster: any) => {
		const eligibleCards = shuffle(
			character.deck.filter((card: any) => monster.canHoldCard(card)),
		);
		if (!isBoss) {
			const extraCards = _fillDeck([], {}, monster);
			monster.cards = [...eligibleCards, ...extraCards].slice(0, monster.cardSlots);
			return;
		}
		// The hand's extra cards (and any top-up the heal cap needs) pass the same rules.
		let hand = pickBossHand([...eligibleCards, ..._fillDeck([], {}, monster)], monster.cardSlots);
		for (let attempt = 0; hand.length < monster.cardSlots && attempt < 20; attempt += 1) {
			hand = pickBossHand([...hand, ..._fillDeck([], {}, monster)], monster.cardSlots);
		}
		monster.cards = hand;
	});

	return character;
};

export { randomCharacter };
export default randomCharacter;
