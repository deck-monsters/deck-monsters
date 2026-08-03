/* eslint-disable max-len */
import { actionCard, itemCard } from '../packages/engine/src/helpers/card.js';
import { all as allCards } from '../packages/engine/src/cards/helpers/all.js';
import allItems from '../packages/engine/src/items/helpers/all.js';
import { eachSeries } from '../packages/engine/src/helpers/promise.js';
import generateDocs from './generate-docs.js';

const cardList = allCards.map(({ cardType }) => cardType);
const itemList = allItems.map(({ itemType }) => itemType);

const generateDungeonMasterGuide = (output) => {
	const header =
`
\`\`\`
			██████╗ ███╗   ███╗ ██████╗
			██╔══██╗████╗ ████║██╔════╝
			██║  ██║██╔████╔██║██║  ███╗
			██║  ██║██║╚██╔╝██║██║   ██║
			██████╔╝██║ ╚═╝ ██║╚██████╔╝
			╚═════╝ ╚═╝     ╚═╝ ╚═════╝

*Dungeon Master Guide (Game Master Reference):*
Full card stats, modifier math, damage-per-turn tables, and probability breakdowns.

Multi-roll attacks (Lucky Strike, Horn Swipe, Rehit): when a card rolls
more than once and keeps only one result, Stroke of Luck / Curse of Loki
apply to the selected roll only — discarded natural 20s/1s do not crit.

${cardList.join('\n')}
\`\`\`
`;

	return Promise.resolve()
		.then(() => output(header))
		.then(() => eachSeries(allCards, Card => output(actionCard(new Card(), true))))
		.then(() => output(`\`\`\`
*The Item Catalogue:*

${itemList.join('\n')}
\`\`\``))
		.then(() => eachSeries(allItems, Item => output(itemCard(new Item(), true))));
};

const dungeonMasterGuide = ({ channel, output } = {}) => generateDocs({ channel, generate: generateDungeonMasterGuide, output });

export default dungeonMasterGuide;
