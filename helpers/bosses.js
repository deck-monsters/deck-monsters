const { randomCharacter } = require('../characters');

const bossChannel = () => Promise.resolve();
const bossChannelName = 'BOSS';

const BOSS_TEAM = 'Boss';

function randomContestant ({ isBoss = true, ...options } = {}) {
	let team;
	if (isBoss) team = BOSS_TEAM;

	const character = randomCharacter({ isBoss, team, ...options });
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
