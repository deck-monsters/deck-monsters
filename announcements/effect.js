const announceEffect = (className, card, {
	player, target, effectResult, narration
}) => {
	player.environment.channel({
		announce:
`${target.icon} ${target.givenName} is currently ${effectResult} ${player.icon} ${player.givenName}.${narration ? ` ${narration}` : ''}
`
	});
};

module.exports = announceEffect;
