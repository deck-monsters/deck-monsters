const wrap = require('word-wrap');
const upperFirst = require('lodash.upperfirst');

const formatCard = ({
	title, description, stats, rankings
}) => (
	`
\`\`\`
==================================
${wrap(title, { indent: '| ', width: 31 })}
----------------------------------${
	!description ? '' :
		`
|
${wrap(description, { indent: '| ', width: 31 })}`
	}${
		!stats ? '' :
			`
|
${wrap(stats, { indent: '| ', width: 31 })}`
	}${
		!rankings ? '' :
			`
|
${wrap(rankings, { indent: '| ', width: 31 })}`
	}
|
==================================
\`\`\`
`.replace(/^\s*[\r\n]/gm, '')
);

const cardRarity = (card) => {
	if (card.probability >= 80) {
		return '•';
	} else if (card.probability >= 60) {
		return '○';
	} else if (card.probability >= 40) {
		return '◆';
	} else if (card.probability >= 20) {
		return '★';
	}

	return '☆';
};

const getCardRequirements = (card) => {
	const requirements = [];

	if (card.level) {
		requirements.push(`Level: ${card.level}`);
	}

	if (card.permittedClasses) {
		requirements.push(`Classes: ${card.permittedClasses.join(', ')}`);
	}

	return requirements.length > 0 ? requirements.join('\n') : undefined;
};

const actionCard = card => formatCard({
	title: `${card.icon}  ${card.cardType}  ${cardRarity(card)}`,
	description: card.description,
	stats: card.stats,
	rankings: getCardRequirements(card)
});

const itemCard = item => actionCard(item); // Just use the card formatter for now but we might do something custom later
const discoveryCard = item => actionCard(item); // Just use the card formatter for now but we might do something custom later

const monsterCard = (monster, verbose = true) => formatCard({
	title: `${monster.icon}  ${monster.givenName}`,
	description: verbose ? upperFirst(monster.individualDescription) : '',
	stats: monster.stats,
	rankings: verbose ? monster.rankings : ''
});

module.exports = {
	actionCard,
	formatCard,
	itemCard,
	discoveryCard,
	monsterCard
};
