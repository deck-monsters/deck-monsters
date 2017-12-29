const announceStay = (publicChannel, channelManager, className, monster, { fleeRoll, player, activeContestants }) => {
	if (fleeRoll) {
		const assailants = activeContestants
			.filter(contestant => contestant.monster !== player)
			.map(contestant => contestant.monster.identityWithHp);

		publicChannel({
			announce:
`${player.identityWithHp} tries to flee from ${assailants.join(' and ')}, but fails!`
		});
	} else {
		publicChannel({
			announce:
`${player.identityWithHp} bravely stays in the ring.`
		});
	}
};

module.exports = announceStay;
