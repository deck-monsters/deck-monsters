const { signedNumber } = require('../helpers/signed-number');

const announceRolling = (publicChannel, channelManager, className, monster, {
	reason,
	roll,
	player,
	target,
	vs
}) => {
	let title = roll.primaryDice || '';
	if (roll.bonusDice) {
		title += signedNumber(roll.bonusDice);
	}
	if (roll.modifier) {
		title += signedNumber(roll.modifier);
	}

	const vsMsg = vs ? ` v ${vs}` : '';
	const vsIcon = vs ? ` _v_ ${target.icon}` : '';
	const verbose = (player.settings && player.settings.verbose) ? `  (_${player.identity} rolls ${title} ${reason}_)` : '';

	let spacingCount = 15 - title.length;
	spacingCount = vs ? spacingCount - vsMsg.length : spacingCount;

	let spacing = '';
	for (let i = 0; i < spacingCount; i++) {
		spacing += ' ';
	}

	publicChannel({
		announce:
`👋 \`${title}${vsMsg}${spacing}\`${player.icon}${vsIcon}${verbose}`
	});
};

module.exports = announceRolling;
