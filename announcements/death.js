const announceDeath = (publicChannel, channelManager, className, monster, { assailant, destroyed }) => {
	let announce;

	if (destroyed) {
		announce = `${monster.identityWithHp} has been sent to the land of ${monster.pronouns[2]} ancestors by ${assailant.identityWithHp}

		☠️  R.I.P ${monster.identity}
`;
	} else {
		announce = `💀  ${monster.identityWithHp} is killed by ${assailant.identityWithHp}
`;
	}

	publicChannel({ announce });
};

module.exports = announceDeath;
