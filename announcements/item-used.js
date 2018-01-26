const { itemCard } = require('../helpers/card');

const announceItem = (publicChannel, channelManager, className, item, { channel, character, monster }) => {
	const itemUsed = itemCard(item);
	const targetStr = monster ? monster.givenName : `${character.pronouns.him}self`;
	const announce = `${character.identity} uses the following item on ${targetStr}:
${itemUsed}`;

	if (channel) channel({ announce });
	if (!channel || (monster && monster.inEncounter)) publicChannel({ announce });
};

module.exports = announceItem;
