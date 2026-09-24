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
	// Instantiate once and derive every name — TOC entry *and* section heading — from
	// that same instance. `cardType`/`itemType` is sometimes an *instance* getter that
	// overrides the static class property: `KalevalaCard#itemType` appends the card's
	// current damage dice ("The Kalevala (1d4)"), so the static `Card.cardType` used to
	// build the TOC ("The Kalevala") never matched the instance name the heading below
	// actually rendered — a permanently broken `](#the-kalevala)` link. See
	// docs/roadmap/10b-bugs-fixed.md.
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

	// One tracker, fed in the exact order headings will render below (cards, then
	// items): a card and an item can share a display name, and GitHub's own slugger
	// appends `-1`/`-2` to whichever repeats. Anything built from a name has to walk the
	// same order to link to the anchor GitHub actually assigns.
	const anchorFor = createAnchorTracker();
	const cardAnchors = cards.map(({ name }) => anchorFor(name));
	const itemAnchors = items.map(({ name }) => anchorFor(name));

	await output(`${CARD_CATALOGUE_HEADER}\n\n## Contents\n\n### Card List\n\n${
		cards.map(({ name }, i) => renderTocEntry(name, () => cardAnchors[i])).join('\n')
	}`);
	await output(`### Item List\n\n${
		items.map(({ name }, i) => renderTocEntry(name, () => itemAnchors[i])).join('\n')
	}`);

	await output('## Cards');
	await eachSeries(cards, ({ card, name }) => output(renderCardSection(name, actionCard(card, false))));
	await output('## Items');
	await eachSeries(items, ({ item, name }) => output(renderCardSection(name, itemCard(item, false))));
};

export default generateCardCatalogue;
