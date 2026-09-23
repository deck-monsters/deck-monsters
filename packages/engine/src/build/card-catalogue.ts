import { actionCard, itemCard } from '../helpers/card.js';
import allCards from '../cards/helpers/all.js';
import allItems from '../items/helpers/all.js';
import { eachSeries } from '../helpers/promise.js';
import { renderCardSection, renderTocEntry } from './markdown.js';

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
 */
export const generateCardCatalogue = async (output: DocOutputFn): Promise<void> => {
	const cardNames = allCards.map((Card: { cardType?: string }) => Card.cardType ?? '');
	const itemNames = allItems.map((Item: { itemType?: string }) => Item.itemType ?? '');

	await output(`${CARD_CATALOGUE_HEADER}\n\n### Cards\n\n${cardNames.map(renderTocEntry).join('\n')}`);
	await output(`### Items\n\n${itemNames.map(renderTocEntry).join('\n')}`);

	await eachSeries(allCards, Card => {
		const card = new Card();
		return output(renderCardSection(card.cardType ?? Card.name, actionCard(card, false)));
	});
	await output('## The Item Catalogue');
	await eachSeries(allItems, Item => {
		const item = new Item();
		return output(renderCardSection(item.itemType ?? Item.name, itemCard(item, false)));
	});
};

export default generateCardCatalogue;
