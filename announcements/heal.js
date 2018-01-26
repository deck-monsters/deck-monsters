const announceHeal = (publicChannel, channelManager, ring, className, monster, { amount }) => {
	if (ring.monsterIsInRing(monster)) {
		publicChannel({
			announce:
`${monster.icon} 💊 ${monster.givenName} healed ${amount} hp and has *${monster.hp} hp*.`
		});
	}
};

module.exports = announceHeal;
