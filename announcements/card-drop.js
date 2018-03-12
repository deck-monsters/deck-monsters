const { actionCard } = require('../helpers/card');

const announceCardDrop = (className, game, { contestant, card }) => {
	const { channel, channelName } = contestant;

	const cardDropped = actionCard(card, true);

	const announce = `${contestant.monster.identity} finds a card for ${contestant.character.identity} in the dust of the ring:

${cardDropped}`;

	game.environment.channelManager.queueMessage({
		announce,
		channel,
		channelName
	});

	game.environment.channel({
		announce
	});
};

module.exports = announceCardDrop;
