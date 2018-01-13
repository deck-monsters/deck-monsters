/* eslint-disable max-len */
const { signedNumber } = require('../helpers/signed-number');

const announceRolled = (publicChannel, channelManager, className, monster, {
	reason,
	roll,
	// player,
	// target,
	vs,
	outcome
}) => {
	const title = roll.primaryDice || '';
	const text = `(_${roll.naturalRoll.result}${signedNumber(roll.bonusResult)}${signedNumber(roll.modifier)} on ${title}_) ${reason}`;


	const vsMsg = vs ? ` v ${vs}` : '';
	let rollResult = (roll.strokeOfLuck) ? 'Nat 20!' : roll.result;
	rollResult = (roll.curseOfLoki) ? 'Crit Fail!' : rollResult;
	// let spacingCount = 17 - `${rollResult}`.length;
	// spacingCount = vs ? spacingCount - vsMsg.length : spacingCount;

	// let spacing = '';
	// for (let i = 0; i < spacingCount; i++) {
	// 	spacing += ' ';
	// }

	publicChannel({
		announce:
`${text}
🎲 *${rollResult}${vsMsg}*
    ${outcome}`
	});
};

module.exports = announceRolled;
