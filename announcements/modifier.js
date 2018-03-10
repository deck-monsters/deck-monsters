/* eslint-disable max-len */
const { signedNumber } = require('../helpers/signed-number');

const announceModifier = (className, monster, {
	amount,
	attr,
	prevValue
}) => {
	const { channel } = monster.environment;
	const newValue = monster[attr];
	const totalMod = monster.encounterModifiers[attr];
	const difference = newValue - prevValue;

	let dir = 'increased';
	if (amount < 0) {
		dir = 'decreased';
	}

	const total = (totalMod !== amount) ? `,${signedNumber(totalMod)} total` : '';

	if (difference === 0) {
		channel({
			announce:
			`${monster.identity}'s ${attr} could not be ${dir} and remains the same.`
		});
	} else if (difference !== amount) {
		channel({
			announce:
			`${monster.identity}'s ${attr} could not be ${dir} by ${Math.abs(amount)}, ${monster.pronouns.his} ${attr} is now ${newValue} (${dir} by ${Math.abs(difference)}${total})`
		});
	} else {
		channel({
			announce:
			`${monster.identity}'s ${attr} is now ${newValue} (${dir} by ${Math.abs(amount)}${total})`
		});
	}
};

module.exports = announceModifier;
