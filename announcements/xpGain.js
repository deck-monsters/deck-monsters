const announceXPGain = (publicChannel, channelManager, className, game, {
	contestant,
	creature,
	xpGained,
	killed,
	coinsGained
}) => {
	const { channel, channelName } = contestant;

	let coinsMessage = '';
	if (coinsGained) {
		coinsMessage = ` and ${coinsGained} coins`;
	}

	let killedMessage = '';
	if (killed) {
		killedMessage = ` for killing ${killed.length} ${killed.length > 1 ? 'monsters' : 'monster'}.`;
	}

	channelManager.queueMessage({
		announce: `${creature.identity} gained ${xpGained} XP${killedMessage}${coinsMessage}`,
		channel,
		channelName
	});
};

module.exports = announceXPGain;
