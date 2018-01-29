/* eslint-disable max-len */

const announceModifier = (publicChannel, channelManager, className, monster, {
	amount,
	attr,
	prevValue
}) => {
	const newValue = monster[attr];
	const difference = newValue - prevValue;

	let dir = 'increased';
	if (amount < 0) {
		dir = 'decreased';
	}

	if (difference === 0) {
		publicChannel({
			announce:
			`${monster.identity}'s ${attr} could not be ${dir} and remains the same.`
		});
	} else if (difference !== amount) {
		publicChannel({
			announce:
			`${monster.identity}'s ${attr} could not be ${dir} by ${Math.abs(amount)}, ${monster.pronouns.his} ${attr} is now ${newValue} (${dir} by ${Math.abs(difference)})`
		});
	} else {
		publicChannel({
			announce:
			`${monster.identity}'s ${attr} is now ${newValue} (${dir} by ${Math.abs(amount)})`
		});
	}
};

module.exports = announceModifier;
