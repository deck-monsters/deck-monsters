const announceHeal = (publicChannel, channelManager, ring, className, monster, { amount }) => {
	if (ring.monsterIsInRing(monster)) {
		publicChannel({
			announce:
`${monster.icon} 💊      ${monster.givenName} heals ${amount} hp
${monster.icon}  ${monster.givenName} now has ${monster.hp}HP.`
		});
	}
};

module.exports = announceHeal;
