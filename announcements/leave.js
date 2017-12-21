const announceLeave = (publicChannel, channelManager, className, monster, { assailant }) => {
	publicChannel({
		announce:
`${monster.identityWithHp} flees from ${assailant.identityWithHp}
`
	});
};

module.exports = announceLeave;
