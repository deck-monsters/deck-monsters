import { actionCard, itemCard } from '../helpers/card.js';
import allCards from '../cards/helpers/all.js';
import allItems from '../items/helpers/all.js';
import { eachSeries } from '../helpers/promise.js';
import { createAnchorTracker, renderCardSection, renderTocEntry } from './markdown.js';

export type DocOutputFn = (section: string) => Promise<void> | void;

const CARD_CATALOGUE_HEADER = `
## The Card Catalogue (Player Reference)

Name, description, and rarity for every card and item in the game. For item rules —
timing, inventory limits, targeting strategies and the shop — see [ITEMS.md](ITEMS.md).
`.trim();

/**
 * Root-file-only (`CARDS.md`) renderer: `generateCardCatalogue` is not used in-game, so
 * unlike `dungeon-master-guide.ts` it renders straight to Markdown — a `##`/`###`-
 * headed, anchor-linked catalogue instead of the plain name list + `\`\`\`` frame per
 * card that used to collapse into a run-on paragraph on GitHub (see
 * `docs/roadmap/10b-bugs-fixed.md`). Each card/item still gets its original ASCII stat
 * frame (from `actionCard`/`itemCard`), just tagged as a ` ```text ` fence under its own
 * heading so it is individually linkable from the table of contents.
 *
 * Heading hierarchy is deliberate: `## Contents` holds both index lists (as `###`
 * sub-lists) so they read as one section, then `## Cards` and `## Items` are each their
 * own top-level section with one `###` per entry underneath. Putting the "Items" index
 * directly above the first card heading (as an earlier version of this file did) leaves
 * every card looking, on GitHub's own outline, like it belongs under "Items" — nothing
 * at `##` level marks where the index ends and the actual cards begin.
 */
export const generateCardCatalogue = async (output: DocOutputFn): Promise<void> => {
	const cardNames = allCards.map((Card: { cardType?: string }) => Card.cardType ?? '');
	const itemNames = allItems.map((Item: { itemType?: string }) => Item.itemType ?? '');

	// One tracker, fed in the exact order headings will render below (cards, then
	// items): a card and an item can share a display name, and GitHub's own slugger
	// appends `-1`/`-2` to whichever repeats. Anything built from a name has to walk the
	// same order to link to the anchor GitHub actually assigns.
	const anchorFor = createAnchorTracker();
	const cardAnchors = cardNames.map(anchorFor);
	const itemAnchors = itemNames.map(anchorFor);

	await output(`${CARD_CATALOGUE_HEADER}\n\n## Contents\n\n### Card List\n\n${
		cardNames.map((name, i) => renderTocEntry(name, () => cardAnchors[i])).join('\n')
	}`);
	await output(`### Item List\n\n${
		itemNames.map((name, i) => renderTocEntry(name, () => itemAnchors[i])).join('\n')
	}`);

	await output('## Cards');
	await eachSeries(allCards, Card => {
		const card = new Card();
		return output(renderCardSection(card.cardType ?? Card.name, actionCard(card, false)));
	});
	await output('## Items');
	await eachSeries(allItems, Item => {
		const item = new Item();
		return output(renderCardSection(item.itemType ?? Item.name, itemCard(item, false)));
	});
};

export default generateCardCatalogue;
