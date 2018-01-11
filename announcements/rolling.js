const { signedNumber } = require('../helpers/signed-number');

const announceRolling = (publicChannel, channelManager, className, monster, {
	reason,
	roll,
	player,
	target,
	vs
}) => {
	let title = roll.primaryDice;
	if (roll.bonusDice) {
		title += signedNumber(roll.bonusDice);
	}
	if (roll.modifier) {
		title += signedNumber(roll.modifier);
	}

	publicChannel({
		announce:
`🎲 ${player.icon} ${title} vs ${target.icon} ${vs}  ${player.identity} rolls ${title} ${reason}`
	});
};

module.exports = announceRolling;
