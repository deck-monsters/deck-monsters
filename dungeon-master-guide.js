/* eslint-disable class-methods-use-this, max-len */
const Promise = require('bluebird');

const { actionCard, itemCard } = require('./helpers/card');

const BaseClass = require('./shared/baseClass');

const allCards = require('./cards/helpers/all.js');
const cardList = allCards.map(Card => `${new Card().cardType}`);
const allItems = require('./items/helpers/all.js');
const itemList = allItems.map(Item => `${new Item().itemType}`);

const dungeonMasterGuide = (channel) => {
	const { channelManager, channelName } = channel;

	const header = `
\`\`\`
				██████╗ ███╗   ███╗ ██████╗
				██╔══██╗████╗ ████║██╔════╝
				██║  ██║██╔████╔██║██║  ███╗
				██║  ██║██║╚██╔╝██║██║   ██║
				██████╔╝██║ ╚═╝ ██║╚██████╔╝
				╚═════╝ ╚═╝     ╚═╝ ╚═════╝

	*The Card Catalogue:*

	${cardList.join(', ')}
\`\`\`
`;

	return Promise.resolve()
		.then(() => channelManager.queueMessage({
			announce: header,
			channel,
			channelName
		}))
		.then(() => Promise.each(allCards, Card => channelManager.queueMessage({
			announce: actionCard(new Card(), true),
			channel,
			channelName
		})))
		.then(() => channelManager.queueMessage({
			announce: `\`\`\`
	*The Item Catalogue:*

${itemList.join(', ')}
\`\`\``,
			channel,
			channelName
		}))
		.then(() => Promise.each(allItems, Card => channelManager.queueMessage({
			announce: itemCard(new Card(), true),
			channel,
			channelName
		})))
		.then(() => channelManager.sendMessages());
};

module.exports = dungeonMasterGuide;
