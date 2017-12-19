const { randomCharacter } = require('../characters');

const bossChannel = () => Promise.resolve();
const bossChannelName = 'BOSS';

function randomContestant () {
	const character = randomCharacter({ isBoss: true });
	const monster = character.monsters[0];
	const { canHold } = monster;

	monster.canHold = object => canHold.call(monster, object) && !object.noBosses;

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
