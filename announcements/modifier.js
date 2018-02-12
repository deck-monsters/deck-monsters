/* eslint-disable max-len */
const { signedNumber } = require('../helpers/signed-number');

const announceModifier = (publicChannel, channelManager, className, monster, {
	amount,
	attr,
	prevValue
}) => {
	const newValue = monster[attr];
	const totalMod = monster.encounterModifiers[attr];
	const difference = newValue - prevValue;

	let dir = 'increased';
	if (amount < 0) {
		dir = 'decreased';
	}

	const total = (totalMod !== amount) ? `,${signedNumber(totalMod)} total` : '';

	if (difference === 0) {
		publicChannel({
			announce:
			`${monster.identity}'s ${attr} could not be ${dir} and remains the same.`
		});
	} else if (difference !== amount) {
		publicChannel({
			announce:
			`${monster.identity}'s ${attr} could not be ${dir} by ${Math.abs(amount)}, ${monster.pronouns.his} ${attr} is now ${newValue} (${dir} by ${Math.abs(difference)}${total})`
		});
	} else {
		publicChannel({
			announce:
			`${monster.identity}'s ${attr} is now ${newValue} (${dir} by ${Math.abs(amount)}${total})`
		});
	}
};

module.exports = announceModifier;
