/* eslint-disable class-methods-use-this, max-len */
const { actionCard, itemCard } = require('./helpers/card');

const BaseClass = require('./shared/baseClass');

const allCards = require('./cards/helpers/all.js');
const allItems = require('./items/helpers/all.js');
const cardCatalogue = allCards.reduce((catalogue, Card) => catalogue + `${actionCard(new Card(), true)}\n\n`, '');
const itemCatalogue = allItems.reduce((catalogue, Card) => catalogue + `${itemCard(new Card(), true)}\n\n`, '');


class DungeonMasterGuide extends BaseClass {
	look (channel) {
		return Promise
			.resolve()
			.then(() => channel({
				announce: `
\`\`\`
				██████╗ ███╗   ███╗ ██████╗
				██╔══██╗████╗ ████║██╔════╝
				██║  ██║██╔████╔██║██║  ███╗
				██║  ██║██║╚██╔╝██║██║   ██║
				██████╔╝██║ ╚═╝ ██║╚██████╔╝
				╚═════╝ ╚═╝     ╚═╝ ╚═════╝

	*The Card Catalogue:*
\`\`\`

${cardCatalogue}

\`\`\`
	*The Item Catalogue:*
\`\`\`

${itemCatalogue}
`
			}));
	}
}

DungeonMasterGuide.eventPrefix = 'dungeonMasterGuide';

module.exports = DungeonMasterGuide;
