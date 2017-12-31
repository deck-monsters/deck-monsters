const announceContestantLeave = (publicChannel, channelManager, className, ring, { contestant }) => {
	const { character, monster } = contestant;

	publicChannel({
		announce:
`${monster.givenName} was summoned from the ring by ${character.identity}.`
	});
};

module.exports = announceContestantLeave;
