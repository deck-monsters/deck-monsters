const announceEndOfDeck = (className, ring, { contestant }) => {
	const { monster } = contestant;

	ring.environment.channel({
		announce:
`${monster.identity} is out of cards.`
	});
};

module.exports = announceEndOfDeck;
