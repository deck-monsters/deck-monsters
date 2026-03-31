/* eslint-disable class-methods-use-this, max-len */
const { actionCard, itemCard } = require('../helpers/card');
const allCards = require('../cards/helpers/all.js');
const allItems = require('../items/helpers/all.js');
const generateDocs = require('./generate-docs');
const { eachSeries } = require('../helpers/promise');

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

*The Card Catalogue:*

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

const dungeonMasterGuide = ({ channel, output }) => generateDocs({ channel, generate: generateDungeonMasterGuide, output });

module.exports = dungeonMasterGuide;
