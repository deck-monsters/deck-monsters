const announceNarration = (className, item, { channel, channelName, narration }) => {
	if (channel) {
		item.environment.channelManager.queueMessage({
			announce: narration,
			channel,
			channelName
		});
	} else {
		item.environment.channel({ announce: narration });
	}
};

module.exports = announceNarration;
