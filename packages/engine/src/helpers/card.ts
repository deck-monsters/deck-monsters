import wrap from 'word-wrap';

import type { FeedLine } from '../events/types.js';
import { upperFirst } from './upper-first.js';
import { findProbabilityMatch } from './probabilities.js';
import cardOdds from '../card-odds.json' with { type: 'json' };

type CardOdds = Record<string, Record<string, {
	hitChance?: number;
	dpt?: number;
	healChance?: number;
	hpt?: number;
	effectChance?: number;
}>>;

const odds = cardOdds as unknown as CardOdds[];

interface ItemLike {
	probability?: number;
	level?: number;
	name?: string;
	permittedClassesAndTypes?: string[];
	cost?: number;
	targetProp?: string;
	cardClass?: string[];
	description?: string;
	stats?: string;
	icon?: string;
	itemType?: string;
	cardType?: string;
}

interface MonsterLike {
	icon?: string;
	givenName?: string;
	individualDescription?: string;
	stats?: string;
	rankings?: string;
	hp?: number;
	maxHp?: number;
	ac?: number;
	displayLevel?: string;
}

interface CharacterLike {
	icon?: string;
	givenName?: string;
	detailedStats?: string;
	stats?: string;
	rankings?: string;
}

const itemRarity = (item: ItemLike): string =>
	findProbabilityMatch(item.probability ?? 0).icon;

const getItemRequirements = (item: ItemLike): string[] => {
	const requirements = [
		`Level: ${item.level ? item.level : 'Beginner'}`,
		`Usable by: ${item.permittedClassesAndTypes ? item.permittedClassesAndTypes.join(', ') : 'All'}`
	];

	const cardOddsEntry = odds[0]?.[item.name ?? ''];
	if (cardOddsEntry) {
		if (cardOddsEntry.hitChance !== undefined) {
			requirements.push(`Hit chance: ${cardOddsEntry.hitChance}% | DPT: ${cardOddsEntry.dpt}`);
		}
		if (cardOddsEntry.healChance !== undefined) {
			requirements.push(`Heal chance: ${cardOddsEntry.healChance}% | HPT: ${cardOddsEntry.hpt}`);
		}
		if (cardOddsEntry.effectChance !== undefined) {
			requirements.push(`Effect chance: ${cardOddsEntry.effectChance}%`);
		}
	}

	requirements.push(`MSRP: ${item.cost ? item.cost : 'free'}`);
	if (item.targetProp) requirements.push(`Targets: ${item.targetProp}`);
	if (item.cardClass) requirements.push(`Class: ${item.cardClass.join(', ')}`);

	return requirements;
};

interface FormatCardOptions {
	title: string;
	description?: string;
	stats?: string;
	rankings?: string;
	verbose?: boolean;
}

const FRAME_COLUMNS = 32;

function isJoiner(ch: string): boolean {
	return ch === '\u200D' || /\p{Variation_Selector}/u.test(ch);
}

/**
 * Columns a monospace feed actually advances.
 *
 * `word-wrap` counts UTF-16 units. An astral pictograph such as 💪 or 🦄 is two units
 * and two columns, so those lines already meet the frame. A BMP pictograph such as ⏳
 * is one unit and two columns, so a full line paints past the 34-column border (two of
 * them measured 36 columns). A variation selector is one unit and no columns, so 🗡️
 * wraps a column early. Discord renders this same string, and its monospace does the
 * same: pictographs are two columns, selectors are none.
 */
function cardColumnWidth(text: string): number {
	let width = 0;
	for (const ch of text) {
		if (isJoiner(ch)) continue;
		width += /\p{Extended_Pictographic}/u.test(ch) ? 2 : 1;
	}
	return width;
}

function needsDisplayColumns(text: string): boolean {
	for (const ch of text) {
		if (isJoiner(ch)) return true;
		if (ch.length === 1 && /\p{Extended_Pictographic}/u.test(ch)) return true;
	}
	return false;
}

/**
 * Word wrap at `FRAME_COLUMNS` display columns after the one-space indent, the same
 * budget `word-wrap` gives plain text (its `width` excludes the indent). Plain text stays
 * on `word-wrap`: its breaks are the ones every existing card was written against. Only a
 * string whose UTF-16 length is not its display width comes through here.
 *
 * Each authored line is wrapped on its own. Splitting the whole string on `\s+` treated a
 * newline as a space, so a stats block with an emoji lost its line breaks' indent and
 * doubled a blank line (review of PR #406); `word-wrap` keeps them.
 */
function wrapDisplayColumns(text: string): string {
	return text
		.split('\n')
		.map(line => (line.trim() === '' ? '' : wrapDisplayLine(line)))
		.join('\n');
}

function wrapDisplayLine(text: string): string {
	const indent = ' ';
	const limit = indent.length + FRAME_COLUMNS;
	const tokens = text.split(/(\s+)/).filter((token) => token.length > 0);
	const lines: string[] = [];
	let line = indent;

	const commit = () => {
		if (line.length > indent.length) lines.push(line);
		line = indent;
	};

	for (const token of tokens) {
		if (/^\s+$/.test(token)) {
			if (cardColumnWidth(line + token) <= limit) line += token;
			else commit();
			continue;
		}
		if (cardColumnWidth(line + token) <= limit) {
			line += token;
			continue;
		}
		if (line.trim() !== '') commit();
		if (cardColumnWidth(indent + token) <= limit) {
			line = indent + token;
			continue;
		}
		let rest = token;
		while (rest.length > 0) {
			let take = '';
			for (const ch of rest) {
				if (cardColumnWidth(line + take + ch) > limit) break;
				take += ch;
			}
			if (take.length === 0) break;
			line += take;
			commit();
			rest = rest.slice(take.length);
		}
	}
	if (line.length > indent.length) lines.push(line);
	return lines.join('\n');
}

function wrapCardText(text: string): string {
	if (!needsDisplayColumns(text)) return wrap(text, { indent: ' ', width: FRAME_COLUMNS });
	return wrapDisplayColumns(text);
}

export const formatCard = ({
	title,
	description,
	stats,
	rankings,
	verbose
}: FormatCardOptions): string =>
	`
\`\`\`
==================================
${wrapCardText(title)}
----------------------------------${
	!description
		? ''
		: `

${wrapCardText(description)}`
}${
	!verbose || !stats
		? ''
		: `

${wrapCardText(stats)}`
}${
	!verbose || !rankings
		? ''
		: `

${wrapCardText(rankings)}`
}

==================================
\`\`\`
`;

/**
 * Lines-returning sibling of `formatCard`: the same sections, wrapped by the same rules,
 * but as one `card` feed line with no fences and no `===`/`---` rules. Each inner line is
 * trimmed of the frame's indent, blank separator lines are dropped, and the rest are
 * joined with `\n`. Built from the same inputs as the text so the two cannot drift
 * (`announcements/feed-lines.test.ts` checks it). `heading` and `icon` are the title split
 * into the facts a renderer styles on its own; `text` still carries the whole title line.
 */
export const formatCardLine = ({
	title,
	description,
	stats,
	rankings,
	verbose,
	heading,
	icon
}: FormatCardOptions & { heading?: string; icon?: string }): FeedLine => {
	const sections = [
		wrapCardText(title),
		!description ? '' : wrapCardText(description),
		!verbose || !stats ? '' : wrapCardText(stats),
		!verbose || !rankings ? '' : wrapCardText(rankings)
	];
	const text = sections
		.join('\n')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line !== '')
		.join('\n');
	return {
		kind: 'card',
		text,
		title: heading ?? title,
		...(icon ? { icon } : {})
	};
};

export const formatCardAsHTML = (card: ItemLike): string =>
	`
	<article>
		<a name="${card.itemType}"></a>
		<header>
			<h3>${card.icon}  ${card.itemType}  ${itemRarity(card)}</h3>
		</header>
		<section>${card.description}</section>
		<section>${card.stats}</section>
		<section>
			<ul><li>${getItemRequirements(card).join('</li>\n<li>')}</li></ul>
		</section>
		<footer></footer>
	</article>
`;

export const discoveryCard = (card: ItemLike, verbose = true): string =>
	formatCard({
		title: `${card.icon}  ${card.cardType}  ${itemRarity(card)}`,
		description: card.description,
		stats: card.stats,
		rankings: getItemRequirements(card).join('\n'),
		verbose
	});

export const itemCard = (item: ItemLike, verbose = false): string =>
	formatCard({
		title: `${item.icon}  ${item.itemType}  ${itemRarity(item)}`,
		description: item.description,
		stats: item.stats,
		rankings: getItemRequirements(item).join('\n'),
		verbose
	});

export const itemCardLine = (item: ItemLike, verbose = false): FeedLine => {
	const heading = `${item.itemType}  ${itemRarity(item)}`;
	return formatCardLine({
		title: `${item.icon}  ${heading}`,
		description: item.description,
		stats: item.stats,
		rankings: getItemRequirements(item).join('\n'),
		verbose,
		heading,
		icon: item.icon
	});
};

export const itemCardHTML = (item: ItemLike): string => formatCardAsHTML(item);

export const actionCard = (card: ItemLike, verbose?: boolean): string =>
	itemCard(card, verbose);

export const actionCardLine = (card: ItemLike, verbose?: boolean): FeedLine =>
	itemCardLine(card, verbose);

export const actionCardHTML = (card: ItemLike): string => itemCardHTML(card);

export const monsterCard = (monster: MonsterLike, verbose = true): string =>
	formatCard({
		title: `${monster.icon}  ${monster.givenName}`,
		description: verbose
			? upperFirst(monster.individualDescription)
			: monster.stats,
		stats: verbose ? monster.stats : upperFirst(monster.individualDescription),
		rankings: monster.rankings,
		verbose
	});

export const monsterCardLine = (monster: MonsterLike, verbose = true): FeedLine =>
	formatCardLine({
		title: `${monster.icon}  ${monster.givenName}`,
		description: verbose
			? upperFirst(monster.individualDescription)
			: monster.stats,
		stats: verbose ? monster.stats : upperFirst(monster.individualDescription),
		rankings: monster.rankings,
		verbose,
		heading: monster.givenName,
		icon: monster.icon
	});

/**
 * One-line stand-in for `monsterCard`, used when a monster takes a turn it has already
 * taken this fight.
 *
 * The turn banner used to print a full stat card every single turn. The "repeat" form
 * was not actually shorter — `formatCard` only swaps which of description/stats it
 * shows, so a repeat still rendered the whole ~15-line block, and in a two-monster fight
 * (turns alternate, so every turn is a repeat for that contestant) the feed was mostly
 * stat cards. Measured at 19–34 rendered lines per turn.
 *
 * Everything in that block except hp and ac is static for the length of a fight and was
 * already shown when the monster first appeared, so the repeat keeps only the values
 * that actually change. Deliberately not dropped entirely: the web app has the live
 * roster panel, but Discord does not, and this is where those players read current hp.
 */
export const monsterTurnLine = (monster: MonsterLike, team?: string): string => {
	const hp = typeof monster.hp === 'number' && typeof monster.maxHp === 'number'
		? ` — ${monster.hp}/${monster.maxHp} hp`
		: '';
	const ac = typeof monster.ac === 'number' ? ` · ac ${monster.ac}` : '';
	const level = monster.displayLevel ? ` · ${monster.displayLevel}` : '';
	const teamLabel = team ? ` · ${team}` : '';

	return `${monster.icon ?? ''} ${monster.givenName ?? ''}${hp}${ac}${level}${teamLabel}`.trim();
};

/**
 * The `standing` feed line for `monsterTurnLine`: the same text, with the hp/ac/level/team
 * it was built from as fields. Facts that were not in the text (a monster without numeric
 * hp) are omitted rather than guessed.
 */
export const monsterTurnFeedLine = (monster: MonsterLike, team?: string): FeedLine => ({
	kind: 'standing',
	text: monsterTurnLine(monster, team),
	name: monster.givenName ?? '',
	hp: typeof monster.hp === 'number' ? monster.hp : 0,
	maxHp: typeof monster.maxHp === 'number' ? monster.maxHp : 0,
	...(typeof monster.ac === 'number' ? { ac: monster.ac } : {}),
	...(monster.displayLevel ? { level: monster.displayLevel } : {}),
	...(team ? { team } : {})
});

export const characterCard = (character: CharacterLike, verbose = true): string =>
	formatCard({
		title: `${character.icon}  ${character.givenName}`,
		stats: verbose ? character.detailedStats : character.stats,
		rankings: character.rankings,
		verbose: true
	});
