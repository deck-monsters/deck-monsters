/* eslint-disable class-methods-use-this, max-len */
const Promise = require('bluebird');

const { actionCard, itemCard } = require('./helpers/card');
const allCards = require('./cards/helpers/all.js');
const allItems = require('./items/helpers/all.js');
const generateDocs = require('./helpers/generate-docs');

const cardList = allCards.map(({ cardType }) => cardType);
const itemList = allItems.map(({ itemType }) => itemType);

const generatecardCatalogue = (output) => {
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

*The Card Catalogue:*

${cardList.join('\n')}
`;

	return Promise.resolve()
		.then(() => output(header))
		.then(() => Promise.each(allCards, Card => output(actionCard(new Card(), false))))
		.then(() => output(`
*The Item Catalogue:*

${itemList.join('\n')}
`))
		.then(() => Promise.each(allItems, Item => output(itemCard(new Item(), false))));
};

const cardCatalogue = ({ channel, output }) => generateDocs({ channel, generate: generatecardCatalogue, output });

module.exports = cardCatalogue;
