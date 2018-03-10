/* eslint-disable max-len */
const { signedNumber } = require('../helpers/signed-number');

const announceRolled = (className, monster, {
	outcome,
	reason,
	roll,
	vs,
	who
}) => {
	let rollDesc = `${roll.naturalRoll.result}${signedNumber(roll.bonusResult)}${signedNumber(roll.modifier)}`;
	if (roll.primaryDice) rollDesc = `${rollDesc} on ${roll.primaryDice}`;

	const text = `${who.givenName} rolled _${rollDesc}_ ${reason}`;

	const vsMsg = vs ? ` v ${vs}` : '';
	let rollResult = (roll.strokeOfLuck) ? 'Nat 20!' : roll.result;
	rollResult = (roll.curseOfLoki) ? 'Crit Fail!' : rollResult;

	monster.environment.channel({
		announce:
`${text}
🎲 *${rollResult}${vsMsg}*${outcome ? `
    ${outcome}` : ''}
 `
	});
};

module.exports = announceRolled;
