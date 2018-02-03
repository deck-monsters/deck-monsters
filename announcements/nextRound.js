const announceNextRound = (publicChannel, channelManager, className, ring, { round }) => {
	publicChannel({
		announce:
`
⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅

🏁       round ${round + 1}
`
	});
};

module.exports = announceNextRound;
