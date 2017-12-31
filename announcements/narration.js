const announceNarration = (publicChannel, channelManager, className, card, { narration }) => {
	publicChannel({ announce: narration });
};

module.exports = announceNarration;
