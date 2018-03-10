const announceHeal = (className, monster, { amount }) => {
	monster.environment.channel({
		announce:
`${monster.icon} 💊 ${monster.givenName} healed ${amount} hp and has *${monster.hp} hp*.`
	});
};

module.exports = announceHeal;
