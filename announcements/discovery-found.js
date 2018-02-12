const { discoveryCard } = require('../helpers/card');

const { THE_WORLD } = require('../helpers/channel-names');

const announceCardDrop = (publicChannel, channelManager, className, game, { explorer, discovery }) => {
	const { channel, channelName } = explorer;

	const cardDropped = discoveryCard(discovery, true);

	const announce = `${explorer.monster.givenName} finds a ${discovery.name} card!

${cardDropped}`;

	channelManager.queueMessage({
		announce,
		channel,
		channelName
	});

	publicChannel({
		announce,
		channelName: THE_WORLD
	});
};

module.exports = announceCardDrop;