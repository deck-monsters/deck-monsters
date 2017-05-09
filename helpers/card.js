const wrap = require('word-wrap');
const upperFirst = require('lodash.upperfirst');

const formatCard = ({ title, description, stats }) => (
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
}
|
===========================================
\`\`\`
`
);

const monsterCard = (monster, verbose = true) => formatCard({
	title: `${monster.icon}  ${monster.name} > ${monster.givenName}`,
	description: verbose ? upperFirst(monster.individualDescription) : '',
	stats: verbose ? `${monster.stats}

${monster.rankings}` : monster.stats
});

module.exports = { formatCard, monsterCard };
