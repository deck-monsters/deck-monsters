const announceNextRound = (className, ring, { round }) => {
	ring.channel({
		announce:
`
⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅

🏁       round ${round + 1}
`
	});
};

module.exports = announceNextRound;
