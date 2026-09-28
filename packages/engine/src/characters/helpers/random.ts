import { random, sample, shuffle } from '../../helpers/random.js';
import { XP_PER_VICTORY } from '../../helpers/experience.js';
import { BOSS_PERSONALITIES } from '../../helpers/boss-personalities.js';
import Beastmaster from '../beastmaster.js';
import { RING_PATRON_ICON, RING_PATRON_NAME } from '../../constants/lore.js';
import { BOOST, HEAL, HIDE } from '../../constants/card-classes.js';
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
 * A boss holds no filler. This was a hand-written list from the original JavaScript engine
 * (Flee, Harden, Heal, Hit, Whiskey Shot) that newer basics such as Scotch and Basic Shield
 * got past. Owner's choice (roadmap 33): drop by card class instead. Filler is
 * the plain Hit, and any heal, hide, or boost card that is not tied to one monster type, so
 * signature powers such as Ecdysis, Thick Skin, Gloaming Rest, and Horn of Proof stay.
 */
const FILLER_CLASSES = [HEAL, HIDE, BOOST];
const MONSTER_TYPES = [BASILISK, GLADIATOR, JINN, MINOTAUR, WEEPING_ANGEL, UNICORN, DRAGON];
export const isBossFiller = (card: any): boolean => {
	if (card.cardType === 'Hit') return true;
	const classes: string[] = card.cardClass ?? card.constructor?.cardClass ?? [];
	if (!classes.some(cardClass => FILLER_CLASSES.includes(cardClass))) return false;
	const permitted: string[] = card.permittedClassesAndTypes ?? card.constructor?.permittedClassesAndTypes ?? [];
	return !permitted.some(holder => MONSTER_TYPES.includes(holder));
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

	let cleanBossDeck: (deck: any[]) => any[];
	if (isBoss) {
		cleanBossDeck = deck => deck.filter((card: any) => !isBossFiller(card));
	} else {
		cleanBossDeck = deck => deck;
	}

	if (isBoss) {
		// Top up and filter until a refill adds no filler. The last refill used to go
		// unfiltered, so filler came straight back (a Codex review of PR #407).
		character.deck = fillWithoutFiller(cleanBossDeck(_getMinimumDeck()), character, cleanBossDeck);

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
		const extraCards = fillWithoutFiller([], monster, cleanBossDeck);
		monster.cards = [...eligibleCards, ...extraCards].slice(0, monster.cardSlots);
	});

	return character;
};

export { randomCharacter };
export default randomCharacter;
