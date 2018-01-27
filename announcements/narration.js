const announceNarration = (publicChannel, channelManager, className, item, { channel, channelName, flush, narration }) => {
	if (channel) {
		channelManager.queueMessage({
			announce: narration,
			channel,
			channelName
		});
	} else {
		publicChannel({ announce: narration });
	}

	if (flush) channelManager.sendMessages();
};

module.exports = announceNarration;
