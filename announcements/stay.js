const announceStay = (className, monster, { fleeRoll, player, activeContestants }) => {
	console.log('monster', monster);
	if (fleeRoll) {
		const assailants = activeContestants
			.filter(contestant => contestant.monster !== player)
			.map(contestant => contestant.monster.identityWithHp);

		monster.environment.channel({
			announce:
`${player.identityWithHp} tries to flee from ${assailants.join(' and ')}, but fails!`
		});
	} else {
		monster.environment.channel({
			announce:
`${player.identityWithHp} bravely stays in the ring.`
		});
	}
};

module.exports = announceStay;
