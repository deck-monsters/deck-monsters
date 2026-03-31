/* eslint-disable max-len */
import { actionCard, itemCard } from '../packages/engine/src/helpers/card.js';
import { all as allCards } from '../packages/engine/src/cards/helpers/all.js';
import allItems from '../packages/engine/src/items/helpers/all.js';
import { eachSeries } from '../packages/engine/src/helpers/promise.js';
import generateDocs from './generate-docs.js';

const cardList = allCards.map(({ cardType }) => cardType);
const itemList = allItems.map(({ itemType }) => itemType);

const generateCardCatalogue = (output) => {
	const header =
`
\`\`\`
			.------..------..------..------..------.
			|C.--. ||A.--. ||R.--. ||D.--. ||S.--. |
			| :/\\: || (\\/) || :(): || :/\\: || :/\\: |
			| :\\/: || :\\/: || ()() || (__) || :\\/: |
			| '--'C|| '--'A|| '--'R|| '--'D|| '--'S|
			\`------'\`------'\`------'\`------'\`------'
\`\`\`

*The Card Catalogue (Player Reference):*
Cards available in the game — name, description, cost, and rarity.

${cardList.join('\n')}
`;

	return Promise.resolve()
		.then(() => output(header))
		.then(() => eachSeries(allCards, Card => output(actionCard(new Card(), false))))
		.then(() => output(`
*The Item Catalogue:*

${itemList.join('\n')}
`))
		.then(() => eachSeries(allItems, Item => output(itemCard(new Item(), false))));
};

const cardCatalogue = ({ channel, output } = {}) => generateDocs({ channel, generate: generateCardCatalogue, output });

export default cardCatalogue;
