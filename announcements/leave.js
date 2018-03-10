const announceLeave = (className, monster, { activeContestants }) => {
	const assailants = activeContestants
		.filter(contestant => contestant.monster !== monster)
		.map(contestant => contestant.monster.identityWithHp);

	monster.environment.channel({
		announce:
`${monster.identityWithHp} flees from ${assailants.join(' and ')}
`
	});
};

module.exports = announceLeave;
