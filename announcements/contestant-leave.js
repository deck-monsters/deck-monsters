const announceContestantLeave = (className, ring, { contestant }) => {
	const { character, monster } = contestant;

	ring.channel({
		announce:
`${monster.givenName} was summoned from the ring by ${character.identity}.`
	});
};

module.exports = announceContestantLeave;
