const announceEndOfDeck = (publicChannel, channelManager, className, ring, { contestant }) => {
	const { monster } = contestant;

	publicChannel({
		announce:
`${monster.identity} is out of cards.`
	});
};

module.exports = announceEndOfDeck;
