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

const itemRarity = (card) => {
	if (card.probability >= 80) {
		return '•';
	} else if (card.probability >= 60) {
		return '○';
	} else if (card.probability >= 40) {
		return '◆';
	} else if (card.probability >= 20) {
		return '◇';
	} else if (card.probability > 5) {
		return '★';
	}

	return '☆';
};

const getItemRequirements = (item) => {
	const requirements = [];

	if (item.level) {
		requirements.push(`Level: ${item.level}`);
	}

	if (item.permittedClassesAndTypes) {
		requirements.push(`Usable by: ${item.permittedClassesAndTypes.join(', ')}`);
	}

	return requirements.length > 0 ? requirements.join('\n') : undefined;
};

const itemCard = item => formatCard({
	title: `${item.icon}  ${item.itemType}  ${itemRarity(item)}`,
	description: item.description,
	stats: item.stats,
	rankings: getItemRequirements(item)
});

// This is included for legacy support. Until cards need some sort of special
// rendering they render exactly the same as any other item.
const actionCard = card => itemCard(card);

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
	monsterCard
};
