const { monsterCard } = require('../helpers/card');

const announceTurnBegin = (className, ring, { contestant }) => {
	const { monster } = contestant;

	ring.channel({
		announce:
`*It's ${contestant.character.givenName}'s turn.*

${contestant.character.identity} plays the following monster:
${monsterCard(monster, contestant.lastMonsterPlayed !== monster)}`
	});

	contestant.lastMonsterPlayed = monster;
};

module.exports = announceTurnBegin;
