/* eslint-disable max-len */

const { monsterCard } = require('../helpers/card');
const { getFlavor } = require('../helpers/flavor');

const announceContestant = (className, ring, { contestant }) => {
	const { character, monster } = contestant;

	monster.environment.channel({
		announce:
`A${getFlavor('monsterAdjective').text} ${monster.creatureType} has entered the ring at the behest of ${character.icon} ${character.givenName}.
${monsterCard(monster)}`
	});
};

module.exports = announceContestant;
