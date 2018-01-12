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
	let rollResult = (roll.strokeOfLuck) ? 'Natural 20!' : roll.result;
	rollResult = (roll.curseOfLoki) ? 'Critical Failure!' : rollResult;
	const vsMsg = vs ? ` _vs_ *${vs}* ${target.icon}` : '';

	publicChannel({
		announce:
`🎲 ${player.icon} *${rollResult}*${vsMsg}  (_${player.identity} rolled a ${roll.result} (natural ${roll.naturalRoll.result}${signedNumber(roll.bonusResult)}${signedNumber(roll.modifier)}) ${reason}_)
    ${outcome}`
	});
};

module.exports = announceRolled;
