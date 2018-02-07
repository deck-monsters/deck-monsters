const announceFightConcludes = (publicChannel, channelManager, className, ring, { deaths, isDraw, rounds }) => {
	publicChannel({
		announce:
`The fight concluded ${isDraw ? 'in a draw' : `with ${deaths} dead`} after ${rounds} ${rounds === 1 ? 'round' : 'rounds'}!

≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡
`
	});

	channelManager.sendMessages();
};

module.exports = announceFightConcludes;
