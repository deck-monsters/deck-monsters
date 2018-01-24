const { randomCharacter } = require('../characters');

const bossChannel = () => Promise.resolve();
const bossChannelName = 'BOSS';

function randomContestant ({ isBoss = true, ...options } = {}) {
	const character = randomCharacter({ isBoss, ...options });
	const monster = character.monsters[0];

	return {
		monster,
		character,
		channel: bossChannel,
		channelName: bossChannelName,
		isBoss
	};
}

module.exports = {
	randomContestant
};
