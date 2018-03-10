const { discoveryCard } = require('../helpers/card');

const { THE_WORLD } = require('../helpers/channel-names');

const announceCardDrop = (className, game, { explorer, discovery }) => {
	const { channel, channelName, environment } = explorer;

	const cardDropped = discoveryCard(discovery, true);

	const announce = `${explorer.monster.givenName} finds a ${discovery.name} card!

${cardDropped}`;

	environment.channelManager.queueMessage({
		announce,
		channel,
		channelName
	});

	environment.channel({
		announce,
		channelName: THE_WORLD
	});
};

module.exports = announceCardDrop;
