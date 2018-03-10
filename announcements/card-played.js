const { actionCard } = require('../helpers/card');

const announceCard = (className, card, { player }) => {
	const cardPlayed = actionCard(card);

	player.environment.channel({
		announce:
`${player.identity} lays down the following card:
${cardPlayed}`
	});
};

module.exports = announceCard;
