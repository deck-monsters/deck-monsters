const announceStay = (publicChannel, channelManager, className, monster, { fleeRoll, player, target }) => {
	if (fleeRoll) {
		publicChannel({
			announce:
`${player.identityWithHp} tries to flee from ${target.identityWithHp}, but fails!`
		});
	} else {
		publicChannel({
			announce:
`${player.identityWithHp} bravely stays in the ring.`
		});
	}
};

module.exports = announceStay;
