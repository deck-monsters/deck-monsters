const { MAIN_RING } = require('../helpers/channel-names');

const announceNarration = (publicChannel, channelManager, className, item, { channel, channelName, narration }, publicChannelName = MAIN_RING) => {
	if (channel) {
		channelManager.queueMessage({
			announce: narration,
			channel,
			channelName
		});
	} else {
		publicChannel({ announce: narration, channelName: publicChannelName });
	}
};

module.exports = announceNarration;
