const { actionCard } = require('../helpers/card');

const announceCard = (publicChannel, channelManager, className, card, { player }) => {
	const cardPlayed = actionCard(card);

	publicChannel({
		announce:
`${player.identity} lays down the following card:
${cardPlayed}`
	});
};

module.exports = announceCard;
