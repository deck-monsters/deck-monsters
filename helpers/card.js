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

	requirements.push(`Level: ${item.level ? item.level : 'Beginner'}`);

	requirements.push(`Usable by: ${item.permittedClassesAndTypes ? item.permittedClassesAndTypes.join(', ') : 'All'}`);

	requirements.push(`MSRP: ${item.cost ? item.cost : 'free'}`);

	return requirements.join('\n');
};

const itemCard = (item, verbose = false) => formatCard({
	title: `${item.icon}  ${item.itemType}  ${itemRarity(item)}`,
	description: item.description,
	stats: item.stats,
	rankings: verbose ? getItemRequirements(item, verbose) : ''
});

// This is included for legacy support. Until cards need some sort of special
// rendering they render exactly the same as any other item.
const actionCard = (card, verbose) => itemCard(card, verbose);

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
