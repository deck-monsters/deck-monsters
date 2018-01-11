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
	const rollResult = (roll.naturalRoll.result === 20) ? 'Natural 20!' : roll.result;


	publicChannel({
		announce:
`🎲 ${player.icon} ${rollResult} vs ${target.icon} ${vs}  ${player.identity} rolled a ${roll.result} (natural ${roll.naturalRoll.result}${signedNumber(roll.bonusResult)}${signedNumber(roll.modifier)}) ${reason}
    ${outcome}`
	});
};

module.exports = announceRolled;
