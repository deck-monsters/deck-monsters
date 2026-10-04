import { itemCard } from '../helpers/card.js';
import allItems from '../items/helpers/all.js';
import { renderCardSection } from './markdown.js';

/**
 * ITEMS.md is authored by hand; only the text between these markers is generated
 * (roadmap 44). HTML comments are invisible on GitHub and skipped by the Help page's
 * Markdown renderer (`apps/web/src/lib/markdown.tsx`). `scripts/check-docs.mjs` treats
 * ITEMS.md as authored prose and needs no change for them.
 */
export const ITEMS_START_MARKER = '<!-- generated:every-item:start -->';
export const ITEMS_END_MARKER = '<!-- generated:every-item:end -->';

export const ITEMS_HEADING = 'Every item';
export const ITEMS_INTRO =
	'Each item with its full card. Generated from the game; the rules above explain how to use them.';

/** The generated block, markers included: heading, intro, then every item's full card. */
export const renderItemsSection = (): string => {
	const items = allItems
		.map(Item => {
			const item = new Item();
			const name = (item as { itemType?: string }).itemType ?? Item.name;
			return { item, name };
		})
		.sort((a, b) => a.name.localeCompare(b.name));

	return [
		ITEMS_START_MARKER,
		'',
		`## ${ITEMS_HEADING}`,
		'',
		ITEMS_INTRO,
		'',
		items.map(({ item, name }) => renderCardSection(name, itemCard(item, true))).join('\n\n'),
		'',
		ITEMS_END_MARKER,
	].join('\n');
};

/**
 * Returns `existing` (the authored ITEMS.md) with only the generated block replaced. With no
 * markers yet, the block is appended once at the end. A lone or misordered marker throws
 * rather than guess where authored text ends.
 */
export const spliceItemsGuide = (existing: string): string => {
	const text = existing.replace(/\r\n/g, '\n');
	const block = renderItemsSection();
	const start = text.indexOf(ITEMS_START_MARKER);
	const end = text.indexOf(ITEMS_END_MARKER);

	if (start === -1 && end === -1) return `${text.replace(/\n+$/, '')}\n\n${block}\n`;
	if (start === -1 || end === -1 || end < start) {
		throw new Error('ITEMS.md has a lone or misordered generated-section marker; fix it by hand.');
	}
	return `${text.slice(0, start)}${block}${text.slice(end + ITEMS_END_MARKER.length)}`;
};
