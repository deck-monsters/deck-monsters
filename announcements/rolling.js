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
	const conciseText = vs ? ` _v_ ${target.givenName}` : '';
	// const text = (player.settings && player.settings.verbose) ? ` ${reason}` : `${player.givenName} ${conciseText}`;

	let spacingCount = 17 - title.length;
	spacingCount = vs ? spacingCount - vsMsg.length : spacingCount;

	let spacing = '';
	for (let i = 0; i < spacingCount; i++) {
		spacing += ' ';
	}

	publicChannel({
		announce:
`👋 \`${title}${vsMsg}${spacing}\`${text}`
	});
};

module.exports = announceRolling;
