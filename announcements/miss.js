const announceMiss = (publicChannel, channelManager, className, card, {
	attackResult, curseOfLoki, player, target
}) => {
	let action = 'is blocked by';
	let flavor = '';
	let icon = '🛡';

	if (curseOfLoki) {
		action = 'misses';
		flavor = 'horribly';
		icon = '💨';
	} else if (target.dead) {
		action = 'stops mercilessly beating the dead body of';
		switch (player.gender) {
			case 'female':
				icon = '💃';
				break;
			case 'male':
				icon = '🙇‍';
				break;
			default:
				icon = '⚰️';
		}
	} else if (attackResult > 5) {
		action = 'is barely blocked by';
		icon = '⚔️';
	}

	const targetIdentifier = target === player ? `${target.pronouns.him}self` : target.givenName;

	publicChannel({
		announce:
`${player.icon} ${icon} ${target.icon}    ${player.givenName} ${action} ${targetIdentifier} ${flavor}
`
	});
};

module.exports = announceMiss;
