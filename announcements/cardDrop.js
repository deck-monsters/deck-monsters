const { actionCard } = require('../helpers/card');

const announceCardDrop = (publicChannel, channelManager, className, game, { contestant, card }) => {
	const { channel, channelName } = contestant;

	const cardDropped = actionCard(card, true);

	const announce = `${contestant.monster.identity} finds a card for ${contestant.character.identity} in the dust of the ring:

${cardDropped}`;

	channelManager.queueMessage({
		announce,
		channel,
		channelName
	});

	publicChannel({
		announce
	});
};

module.exports = announceCardDrop;
