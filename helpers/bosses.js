const { randomCharacter } = require('../characters');

const bossChannel = () => Promise.resolve();
const bossChannelName = 'BOSS';

function randomContestant () {
	const character = randomCharacter({ isBoss: true });
	const monster = character.monsters[0];

	return {
		monster,
		character,
		channel: bossChannel,
		channelName: bossChannelName
	};
}

module.exports = {
	randomContestant
};
