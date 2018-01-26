const announceNarration = (publicChannel, channelManager, className, item, { channel, narration }) => {
	(channel || publicChannel)({ announce: narration });
};

module.exports = announceNarration;
