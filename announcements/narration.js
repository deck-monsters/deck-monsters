const announceNarration = (className, item, { environment, channel, channelName, narration }) => {
	if (channel) {
		environment.channelManager.queueMessage({
			announce: narration,
			channel,
			channelName
		});
	} else {
		environment.channel({ announce: narration });
	}
};

module.exports = announceNarration;
