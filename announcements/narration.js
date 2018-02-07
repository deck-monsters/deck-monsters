const announceNarration = (publicChannel, channelManager, className, item, { channel, channelName, narration }) => {
	if (channel) {
		channelManager.queueMessage({
			announce: narration,
			channel,
			channelName
		});
	} else {
		publicChannel({ announce: narration });
	}
};

module.exports = announceNarration;
