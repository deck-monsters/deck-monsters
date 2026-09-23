import { actionCard, itemCard } from '../helpers/card.js';
import allCards from '../cards/helpers/all.js';
import allItems from '../items/helpers/all.js';
import allMonsters from '../monsters/helpers/all.js';
import { eachSeries } from '../helpers/promise.js';
import {
	FIGHT_PACING_OPERATOR,
	FIGHT_PACING_PUBLIC,
	HOW_TO_RUN_SESSION,
	OPERATOR_CONCURRENCY,
} from './dm-only-sections.js';
import {
	baseSpawnAcRange,
	baseSpawnHpRange,
	formatNumericRange,
	formatStatLine,
	getMonsterTypeOffsets,
	STAT_RANGE_FORMULA_NOTE,
} from './monster-stat-ranges.js';
import {
	BASE_DEX,
	BASE_INT,
	BASE_STR,
} from '../constants/stats.js';

type ChannelFn = (opts: { announce: string }) => Promise<unknown>;
export type DocOutputFn = (section: string) => Promise<void> | void;

export type DmgGuideOptions = {
	includeOperatorSections?: boolean;
};

const DMG_HEADER = `
╔══════════════════════════════════╗
║     DUNGEON MASTER GUIDE         ║
║     Deck Monsters                ║
╚══════════════════════════════════╝

Full card stats, modifier math, damage-per-turn tables, and probability breakdowns.
`.trim();

const ADMIN_COMMANDS = `
── Admin Commands ────────────────────

Run any command as another player (admin only):
  [command] as [player name]
  Example: spawn monster as Alice

Reset the room's game state from the Room Settings page (gear icon in the header).
`.trim();

const buildStatsReference = (): string => {
	const spawnHp = baseSpawnHpRange();
	const spawnAc = baseSpawnAcRange();
	const monsterLines = allMonsters
		.map((Monster: new (...args: any[]) => any) => formatStatLine(getMonsterTypeOffsets(Monster), 0))
		.join('\n');

	return `
── Stats Reference ───────────────────

${STAT_RANGE_FORMULA_NOTE}

Base spawn ranges (type offset 0, before per-type modifiers):
  HP: ${formatNumericRange(spawnHp)}
  AC: ${formatNumericRange(spawnAc)}
  STR: ${BASE_STR}  DEX: ${BASE_DEX}  INT: ${BASE_INT}

Per-monster-type modifiers (spawn, level 0):
${monsterLines}
`.trim();
};

const COMBAT_MATH = `
── Combat Math ───────────────────────

A temporary STR, DEX, or INT change is added once. It moves the raw stat and
the derived modifier by the same amount. It is not added a second time.
See "Effective STR, DEX, and INT" in Stats Reference.

Melee accuracy: 1d20 + DEX modifier vs the target's defense (usually AC).
  A card that names another stat rolls against that stat instead.
  A natural 20 is a stroke of luck. A natural 1 is a curse of loki.
  A tie goes to the defender.
Melee damage: damage dice + STR modifier.
Forked Stick pin: 1d20 + STR modifier vs the target's raw DEX.
  Escape: 1d20 + the pinned monster's STR modifier vs the immobilizer's raw
  STR, plus the card's advantage, minus 3 for each turn already pinned.
DEX saves and DEX defenses use DEX. A DEX curse lowers raw DEX, outgoing
  melee accuracy, and that Forked Stick pin threshold by the same amount.
Curse and psychic accuracy: 1d20 + INT modifier.
Healing: heal dice + INT modifier.
INT damage: the card's INT damage + INT modifier.
INT defenses are the raw INT those cards roll against.

AC stays defense. Cards roll against AC. An AC boost absorbs melee damage
before HP is reduced. AC has no attack modifier.

Multi-roll attacks (Lucky Strike, Horn Swipe, Rehit): when a card rolls
more than once and keeps only one result, Stroke of Luck / Curse of Loki
apply to the selected roll only — discarded natural 20s/1s do not crit.

Damage dice vary by card (1d4, 1d6, 1d8, 2d4, 2d6...).
Encounter deltas on STR, DEX, INT, and AC are capped at level + 1. Curse
overflow past that cap comes out of HP instead.
`.trim();

export const collectDungeonMasterGuideSections = async (
	options: DmgGuideOptions = {}
): Promise<string[]> => {
	const sections: string[] = [];
	const output: DocOutputFn = section => {
		sections.push(section);
	};

	await generateDungeonMasterGuide(output, options);

	return sections;
};

export const collectDungeonMasterGuideMarkdown = async (
	options: DmgGuideOptions = {}
): Promise<string> => (await collectDungeonMasterGuideSections(options)).join('\n');

export const generateDungeonMasterGuide = async (
	output: DocOutputFn,
	{ includeOperatorSections = false }: DmgGuideOptions = {}
): Promise<void> => {
	await output(DMG_HEADER);

	if (includeOperatorSections) {
		await output(HOW_TO_RUN_SESSION);
		await output(FIGHT_PACING_OPERATOR);
	} else {
		await output(FIGHT_PACING_PUBLIC);
	}

	await output(ADMIN_COMMANDS);
	await output(buildStatsReference());
	await output(COMBAT_MATH);

	if (includeOperatorSections) {
		await output(OPERATOR_CONCURRENCY);
	}

	const cardList = allCards.map((Card: { cardType?: string }) => Card.cardType ?? '').join('\n');
	const itemList = allItems.map((Item: { itemType?: string }) => Item.itemType ?? '').join(', ');

	await output(`── Card Catalog (verbose) ────────────\n${cardList}`);
	await eachSeries(allCards, Card => output(actionCard(new Card(), true)));
	await output(`── Item Catalog ──────────────────────\n${itemList}`);
	await eachSeries(allItems, Item => output(itemCard(new Item(), true)));
};

export const dungeonMasterGuide = async ({ channel }: { channel: ChannelFn }): Promise<void> =>
	generateDungeonMasterGuide(async section => {
		await channel({ announce: section });
	}, { includeOperatorSections: false });

export default dungeonMasterGuide;
