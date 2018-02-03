const { monsterCard } = require('../helpers/card');

const announceTurnBegin = (publicChannel, channelManager, className, ring, { contestant }) => {
	const { monster } = contestant;

	publicChannel({
		announce:
`*It's ${contestant.character.givenName}'s turn.*

${contestant.character.identity} plays the following monster:
${monsterCard(monster, contestant.lastMonsterPlayed !== monster)}`
	});

	contestant.lastMonsterPlayed = monster;
};

module.exports = announceTurnBegin;
