const announceEndOfDeck = (className, ring, { contestant }) => {
	const { monster, environment } = contestant;

	environment.channel({
		announce:
`${monster.identity} is out of cards.`
	});
};

module.exports = announceEndOfDeck;
