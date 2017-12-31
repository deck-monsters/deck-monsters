const announceLeave = (publicChannel, channelManager, className, monster, { activeContestants }) => {
	const assailants = activeContestants
		.filter(contestant => contestant.monster !== monster)
		.map(contestant => contestant.monster.identityWithHp);

	publicChannel({
		announce:
`${monster.identityWithHp} flees from ${assailants.join(' and ')}
`
	});
};

module.exports = announceLeave;
