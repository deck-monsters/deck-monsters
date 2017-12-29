const announceXPGain = (publicChannel, channelManager, className, game, {
	contestant,
	creature,
	xpGained,
	killed,
	coinsGained,
	reasons
}) => {
	const { channel, channelName } = contestant;

	let coinsMessage = '';
	if (coinsGained) {
		coinsMessage = ` and ${coinsGained} coins`;
	}

	let killedMessage = '';
	if (killed) {
		killedMessage = ` for killing ${killed.length} ${(killed.length > 1 || killed.length === 0) ? 'monsters' : 'monster'}.`;
	}

	const reasonsMessage = (reasons) ? `

${reasons}` : '';

	channelManager.queueMessage({
		announce: `${creature.identity} gained ${xpGained} XP${killedMessage}${coinsMessage}${reasonsMessage}`,
		channel,
		channelName
	});
};

module.exports = announceXPGain;
