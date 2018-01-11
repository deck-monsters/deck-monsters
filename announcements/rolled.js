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
	let rollResult = (roll.naturalRoll.result === 20) ? 'Natural 20!' : roll.result;
	rollResult = (roll.naturalRoll.result === 1) ? 'Critical Failure!' : rollResult;
	const vsMsg = vs ? ` vs ${vs}${target.icon}` : '';

	publicChannel({
		announce:
`🎲 ${player.icon}${rollResult}${vsMsg}  ${player.identity} rolled a ${roll.result} (natural ${roll.naturalRoll.result}${signedNumber(roll.bonusResult)}${signedNumber(roll.modifier)}) ${reason}
    ${outcome}`
	});
};

module.exports = announceRolled;
