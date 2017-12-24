const { randomCharacter } = require('../characters');

const bossChannel = () => Promise.resolve();
const bossChannelName = 'BOSS';

function randomContestant (options) {
	const character = randomCharacter({ isBoss: true, ...options });
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
