const wrap = require('word-wrap');
const upperFirst = require('lodash.upperfirst');

const { findProbabilityMatch } = require('./probabilities');

const odds = require('../card-odds.json');

const itemRarity = item => findProbabilityMatch(item.probability || 0).icon;

const getItemRequirements = (item) => {
	const requirements = [
		`Level: ${item.level ? item.level : 'Beginner'}`,
		`Usable by: ${item.permittedClassesAndTypes ? item.permittedClassesAndTypes.join(', ') : 'All'}`
	];

	const cardOdds = odds[0][item.name];
	if (cardOdds) {
		if (cardOdds.hitChance) {
			requirements.push(`Hit chance: ${cardOdds.hitChance}% | DPT: ${cardOdds.dpt}`);
		}
		if (cardOdds.healChance) {
			requirements.push(`Heal chance: ${cardOdds.healChance}% | HPT: ${cardOdds.hpt}`);
		}
		if (cardOdds.effectChance) {
			requirements.push(`Effect chance: ${cardOdds.effectChance}%`);
		}
	}

	requirements.push(`MSRP: ${item.cost ? item.cost : 'free'}`);
	if (item.targetProp) requirements.push(`Targets: ${item.targetProp}`)
	if (item.cardClass) requirements.push(`Class: ${item.cardClass}`)


	return requirements;
};

const formatCard = ({
	title, description, stats, rankings, verbose
}) => (
	`
\`\`\`
==================================
${wrap(title, { indent: ' ', width: 32 })}
----------------------------------${
	!description ? '' :
		`

${wrap(description, { indent: ' ', width: 32 })}`
	}${
		!verbose || !stats ? '' :
			`

${wrap(stats, { indent: ' ', width: 32 })}`
	}${
		!verbose || !rankings ? '' :
			`

${wrap(rankings, { indent: ' ', width: 32 })}`
	}

==================================
\`\`\`
`
);

const formatCardAsHTML = card => (`
	<article>
		<a name="${card.itemType}"></a>
		<header>
			<h3>${card.icon}  ${card.itemType}  ${itemRarity(card)}</h3>
		</header>
		<section>${card.description}</section>
		<section>${card.stats}</section>
		<section>
			<ul><li>${getItemRequirements(card).join('</li>\n<li>')}</li></ul>
		</section>
		<footer></footer>
	</article>
`);

const discoveryCard = (card, verbose = true) => formatCard({
	title: `${card.icon}  ${card.cardType}  ${itemRarity(card)}`,
	description: card.description,
	stats: card.stats,
	rankings: getItemRequirements(card).join('\n'),
	verbose
});

const itemCard = (item, verbose = false) => formatCard({
	title: `${item.icon}  ${item.itemType}  ${itemRarity(item)}`,
	description: item.description,
	stats: item.stats,
	rankings: getItemRequirements(item).join('\n'),
	verbose
});
const itemCardHTML = item => formatCardAsHTML(item);

// This is included for legacy support. Until cards need some sort of special
// rendering they render exactly the same as any other item.
const actionCard = (card, verbose) => itemCard(card, verbose);
const actionCardHTML = card => itemCardHTML(card);

const monsterCard = (monster, verbose = true) => formatCard({
	title: `${monster.icon}  ${monster.givenName}`,
	description: verbose ? upperFirst(monster.individualDescription) : monster.stats, // finagle the description into the right spot for terse display
	stats: verbose ? monster.stats : upperFirst(monster.individualDescription),
	rankings: monster.rankings,
	verbose
});

const characterCard = (character, verbose = true) => formatCard({
	title: `${character.icon}  ${character.givenName}`,
	stats: verbose ? character.detailedStats : character.stats,
	rankings: character.rankings,
	verbose
});

module.exports = {
	actionCard,
	actionCardHTML,
	characterCard,
	formatCard,
	formatCardAsHTML,
	itemCard,
	itemCardHTML,
	discoveryCard,
	monsterCard
};
