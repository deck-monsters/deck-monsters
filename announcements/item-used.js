const { itemCard } = require('../helpers/card');

const announceItem = (publicChannel, channelManager, className, item, { channel, channelName, character, monster }) => {
	const itemUsed = itemCard(item, true);
	const targetStr = monster ? monster.givenName : `${character.pronouns.him}self`;
	const announce = `${character.identity} uses the following item on ${targetStr}:
${itemUsed}`;

	if (channel) {
		channelManager.queueMessage({
			announce,
			channel,
			channelName
		});
	}

	if (!channel || (monster && monster.inEncounter)) publicChannel({ announce });
};

module.exports = announceItem;
