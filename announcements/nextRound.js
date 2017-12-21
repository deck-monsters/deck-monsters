const announceNextRound = (publicChannel, channelManager, className, ring, { round }) => {
	publicChannel({
		announce:
`
🏁       round ${round} complete

###########################################`
	});
};

module.exports = announceNextRound;
