const wrap = require('word-wrap');
const upperFirst = require('lodash.upperfirst');

const { findProbabilityMatch } = require('./probabilities');

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

const itemRarity = item => findProbabilityMatch(item.probability || 0).icon;

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

const characterCard = (character, verbose = true) => formatCard({
	title: `${character.icon}  ${character.givenName}`,
	stats: verbose ? character.detailedStats : character.stats,
	rankings: character.rankings
});

module.exports = {
	actionCard,
	characterCard,
	formatCard,
	itemCard,
	monsterCard
};
