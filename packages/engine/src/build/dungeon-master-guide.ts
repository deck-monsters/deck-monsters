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

To hit:    roll 1d20 + attacker modifier vs target stat
A roll of 20 is always a stroke of luck (extra effect).
A roll of 1 is always a curse of loki (bad effect).

Multi-roll attacks (Lucky Strike, Horn Swipe, Rehit): when a card rolls
more than once and keeps only one result, Stroke of Luck / Curse of Loki
apply to the selected roll only — discarded natural 20s/1s do not crit.

Damage:    varies by card (1d4, 1d6, 1d8, 2d4, 2d6...)
Modifiers: STR/DEX/INT bonuses added based on card class

AC boost cards absorb melee damage before HP is reduced.
Stat curses (from cards like Soften, Concussion, Molasses)
cap at -3 per level; further penalties come out of HP instead.
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
