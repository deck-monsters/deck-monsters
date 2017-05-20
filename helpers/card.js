const wrap = require('word-wrap');
const upperFirst = require('lodash.upperfirst');

const formatCard = ({ title, description, stats, rankings }) => (
`
\`\`\`
===========================================
${wrap(title, { indent: '| ', width: 40 })}
-------------------------------------------${
!description ? '' :
`
|
${wrap(description, { indent: '| ', width: 40 })}`
}${
!stats ? '' :
`
|
${wrap(stats, { indent: '| ', width: 40 })}`
}${
!rankings ? '' :
`
|
${wrap(rankings, { indent: '| ', width: 40 })}`
}
|
===========================================
\`\`\`
`.replace(/^\s*[\r\n]/gm, '')
);

const cardRarity = (card) => {
	if (card.probability >= 75) {
		return '•';
	} else if (card.probability >= 50) {
		return '○';
	} else if (card.probability >= 20) {
		return '◆';
	} else if (card.probability >= 10) {
		return '★';
	}

	return '☆';
};

const actionCard = card => formatCard({
	title: `${card.icon}  ${card.cardType}  ${cardRarity(card)}`,
	description: card.description,
	stats: card.stats
});

const monsterCard = (monster, verbose = true) => formatCard({
	title: `${monster.icon}  ${monster.name} > ${monster.givenName}`,
	description: verbose ? upperFirst(monster.individualDescription) : '',
	stats: monster.stats,
	rankings: verbose ? monster.rankings : ''
});

module.exports = { formatCard, monsterCard, actionCard };
