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

	const vsMsg = vs ? ` _vs_ *${vs}* ${target.icon}` : '';

	publicChannel({
		announce:
`👋🎲 ${player.icon} *${title}*${vsMsg}  (_${player.identity} rolls ${title} ${reason}_)`
	});
};

module.exports = announceRolling;
