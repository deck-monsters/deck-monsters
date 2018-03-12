const announceStay = (className, card, { fleeRoll, player, activeContestants }) => {
	if (fleeRoll) {
		const assailants = activeContestants
			.filter(contestant => contestant.monster !== player)
			.map(contestant => contestant.monster.identityWithHp);

		player.environment.channel({
			announce:
`${player.identityWithHp} tries to flee from ${assailants.join(' and ')}, but fails!`
		});
	} else {
		player.environment.channel({
			announce:
`${player.identityWithHp} bravely stays in the ring.`
		});
	}
};

module.exports = announceStay;
