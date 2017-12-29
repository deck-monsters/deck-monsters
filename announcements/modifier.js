const announceModifier = (publicChannel, channelManager, className, monster, {
	amount,
	attr
}) => {
	let dir = 'increased';
	if (amount < 0) {
		dir = 'decreased';
	}

	publicChannel({
		announce:
`${monster.identity}'s ${attr} is now ${monster[attr]} (${dir} by ${Math.abs(amount)})`
	});
};

module.exports = announceModifier;
