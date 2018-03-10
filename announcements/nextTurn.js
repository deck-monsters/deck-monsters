const announceNextTurn = (className, ring, { contestants, round, turn }) => {
	ring.channel({
		announce:
`
⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅

round ${round}, turn ${turn + 1}

${contestants.map(contestant => contestant.monster.identityWithHp).join(' vs ')}

`

	});
};

module.exports = announceNextTurn;
