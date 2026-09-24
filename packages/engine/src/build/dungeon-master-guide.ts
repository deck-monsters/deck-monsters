import { actionCard, itemCard } from '../helpers/card.js';
import allCards from '../cards/helpers/all.js';
import allItems from '../items/helpers/all.js';
import allMonsters from '../monsters/helpers/all.js';
import { eachSeries, mapSeries } from '../helpers/promise.js';
import {
	FIGHT_PACING_OPERATOR,
	FIGHT_PACING_PUBLIC,
	HOW_TO_RUN_SESSION,
	OPERATOR_CONCURRENCY,
} from './dm-only-sections.js';
import {
	acRangeAtLevel,
	baseSpawnAcRange,
	baseSpawnHpRange,
	formatNumericRange,
	formatStatLine,
	getMonsterTypeOffsets,
	hpRangeAtLevel,
	STAT_RANGE_FORMULA_NOTE,
} from './monster-stat-ranges.js';
import {
	BASE_DEX,
	BASE_INT,
	BASE_STR,
} from '../constants/stats.js';
import {
	convertPlainTextToMarkdown,
	createAnchorTracker,
	extractLeadingBanner,
	renderCardSection,
	renderTocEntry,
} from './markdown.js';

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
the derived modifier by the same amount. The raw stat floors at 1, so a curse
can move the modifier farther than a raw stat that is already at that floor.
It is not added a second time.
See "Effective STR, DEX, and INT" in Stats Reference.

• Melee accuracy: 1d20 + DEX modifier vs the target's defense (usually AC).
  A card that names another stat rolls against that stat instead.
  A natural 20 is a stroke of luck. A natural 1 is a curse of loki.
  A tie goes to the defender.
• Ordinary melee damage is damage dice plus the STR modifier. Some cards,
  such as Horn Gore, use half the STR modifier instead.
• Forked Stick pin: 1d20 + STR modifier + matchup vs the target's raw DEX.
  Matchup is +2 against a Basilisk or a Gladiator and -2 against a Jinn or a Minotaur.
  Escape: 1d20 + the pinned monster's STR modifier vs the immobilizer's raw
  STR, plus the card's advantage, minus 3 for each turn already pinned.
• DEX saves and DEX defenses use DEX. A DEX curse lowers raw DEX, outgoing
  melee accuracy, and that Forked Stick pin threshold by the same amount.
• Curse and psychic accuracy: 1d20 + INT modifier.
• Healing: heal dice + INT modifier.
• INT damage: the card's INT damage + INT modifier.
• INT defenses are the raw INT those cards roll against.

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

/**
 * Root-file-only (`DMG.md`) Markdown renderer. `generateDungeonMasterGuide` above stays
 * untouched because `dungeonMasterGuide()` announces its sections verbatim in-game; this
 * mirrors its section order but renders each one for GitHub instead of a monospace feed.
 * The formula note and per-monster-type table are rendered from the same structured data
 * `buildStatsReference()` uses, not by regexing that function's plain-text output — see
 * the design note atop `markdown.ts`.
 */
const buildStatsReferenceMarkdown = (): string => {
	const spawnHp = baseSpawnHpRange();
	const spawnAc = baseSpawnAcRange();

	const monsterRows = allMonsters.map((Monster: new (...args: any[]) => any) => {
		const offsets = getMonsterTypeOffsets(Monster);
		const hp = hpRangeAtLevel(offsets.typeHpOffset, 0);
		const ac = acRangeAtLevel(offsets.typeAcOffset, 0);
		const sign = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

		return `| ${offsets.creatureType} | ${offsets.classLabel} | ${formatNumericRange(hp)} | ${formatNumericRange(ac)} | ${sign(offsets.strModifier)} | ${sign(offsets.dexModifier)} | ${sign(offsets.intModifier)} |`;
	});

	return `
## Stats Reference

\`\`\`text
${STAT_RANGE_FORMULA_NOTE}
\`\`\`

Base spawn ranges (type offset 0, before per-type modifiers):

| Stat | Value |
|---|---|
| HP | ${formatNumericRange(spawnHp)} |
| AC | ${formatNumericRange(spawnAc)} |
| STR | ${BASE_STR} |
| DEX | ${BASE_DEX} |
| INT | ${BASE_INT} |

### Per-monster-type modifiers (spawn, level 0)

| Monster | Class | HP | AC | STR | DEX | INT |
|---|---|---|---|---|---|---|
${monsterRows.join('\n')}
`.trim();
};

export const renderDungeonMasterGuideMarkdown = async (): Promise<string> => {
	const { banner, rest } = extractLeadingBanner(DMG_HEADER);
	const parts: string[] = [
		[banner, convertPlainTextToMarkdown(rest)].filter(Boolean).join('\n\n'),
		convertPlainTextToMarkdown(HOW_TO_RUN_SESSION),
		convertPlainTextToMarkdown(FIGHT_PACING_OPERATOR),
		convertPlainTextToMarkdown(ADMIN_COMMANDS),
		buildStatsReferenceMarkdown(),
		convertPlainTextToMarkdown(COMBAT_MATH),
		convertPlainTextToMarkdown(OPERATOR_CONCURRENCY),
	];

	// Instantiate once and derive every name — TOC entry *and* section heading — from
	// that same instance, not the static class property: `cardType`/`itemType` is
	// sometimes an *instance* getter that overrides it (`KalevalaCard#itemType` appends
	// the card's current damage dice: "The Kalevala (1d4)"), so a TOC built from the
	// static `Card.cardType` ("The Kalevala") never matched the instance name the
	// heading below actually rendered — a permanently broken `](#the-kalevala)` link.
	// See card-catalogue.ts's identical fix and docs/roadmap/10b-bugs-fixed.md.
	const cards = allCards.map((Card) => {
		const card = new Card();
		const name = (card as { cardType?: string }).cardType ?? Card.name;
		return { card, name };
	});
	const items = allItems.map((Item) => {
		const item = new Item();
		const name = (item as { itemType?: string }).itemType ?? Item.name;
		return { item, name };
	});

	// One tracker across both lists, in the order the headings below actually render —
	// see the comment on the equivalent tracker in card-catalogue.ts.
	const anchorFor = createAnchorTracker();
	const cardAnchors = cards.map(({ name }) => anchorFor(name));
	const itemAnchors = items.map(({ name }) => anchorFor(name));

	parts.push(
		`## Card Catalog (verbose)\n\n${
			cards.map(({ name }, i) => renderTocEntry(name, () => cardAnchors[i])).join('\n')
		}`
	);
	parts.push(
		(
			await mapSeries(cards, async ({ card, name }) => renderCardSection(name, actionCard(card, true)))
		).join('\n\n')
	);
	parts.push(
		`## Item Catalog\n\n${
			items.map(({ name }, i) => renderTocEntry(name, () => itemAnchors[i])).join('\n')
		}`
	);
	parts.push(
		(
			await mapSeries(items, async ({ item, name }) => renderCardSection(name, itemCard(item, true)))
		).join('\n\n')
	);

	return parts.join('\n\n');
};

export const dungeonMasterGuide = async ({ channel }: { channel: ChannelFn }): Promise<void> =>
	generateDungeonMasterGuide(async section => {
		await channel({ announce: section });
	}, { includeOperatorSections: false });

export default dungeonMasterGuide;
