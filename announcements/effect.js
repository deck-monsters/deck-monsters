const announceEffect = (publicChannel, channelManager, className, card, {
	player, target, effectResult, narration
}) => {
	publicChannel({
		announce:
`${target.icon} ${target.givenName} is currently ${effectResult} ${player.icon} ${player.givenName}.${narration ? ` ${narration}` : ''}
`
	});
};

module.exports = announceEffect;
