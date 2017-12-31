const announceEffect = (publicChannel, channelManager, className, card, {
	player, target, effectResult
}) => {
	publicChannel({
		announce:
`${target.icon}  ${target.givenName} is currently ${effectResult} ${player.icon}  ${player.givenName}
`
	});
};

module.exports = announceEffect;
