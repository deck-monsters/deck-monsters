/* eslint-disable max-len */
const { signedNumber } = require('../helpers/signed-number');

const announceRolled = (publicChannel, channelManager, className, monster, {
	reason,
	roll,
	player,
	target,
	vs,
	outcome
}) => {
	let rollResult = (roll.strokeOfLuck) ? 'Nat 20!' : roll.result;
	rollResult = (roll.curseOfLoki) ? 'Crit Fail!' : rollResult;

	const vsMsg = vs ? ` v ${vs}` : '';
	const vsIcon = vs ? ` _v_ ${target.icon}` : '';
	const verbose = (player.settings && player.settings.verbose) ? `  (_${player.identity} rolled a ${roll.result} (natural ${roll.naturalRoll.result}${signedNumber(roll.bonusResult)}${signedNumber(roll.modifier)}) ${reason}_)` : '';

	let spacingCount = 15 - `${rollResult}`.length;
	spacingCount = vs ? spacingCount - vsMsg.length : spacingCount;

	let spacing = '';
	for (let i = 0; i < spacingCount; i++) {
		spacing += ' ';
	}

	publicChannel({
		announce:
`🎲 \`${rollResult}${vsMsg}${spacing}\`${player.icon}${vsIcon}${verbose}
    ${outcome}`
	});
};

module.exports = announceRolled;
