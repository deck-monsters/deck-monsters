import wrap from 'word-wrap';

import { upperFirst } from './upper-first.js';
import { findProbabilityMatch } from './probabilities.js';
import cardOdds from '../card-odds.json' with { type: 'json' };

type CardOdds = Record<string, Record<string, {
	hitChance?: number;
	dpt?: number;
	healChance?: number;
	hpt?: number;
	effectChance?: number;
}>>;

const odds = cardOdds as unknown as CardOdds[];

interface ItemLike {
	probability?: number;
	level?: number;
	name?: string;
	permittedClassesAndTypes?: string[];
	cost?: number;
	targetProp?: string;
	cardClass?: string[];
	description?: string;
	stats?: string;
	icon?: string;
	itemType?: string;
	cardType?: string;
}

interface MonsterLike {
	icon?: string;
	givenName?: string;
	individualDescription?: string;
	stats?: string;
	rankings?: string;
}

interface CharacterLike {
	icon?: string;
	givenName?: string;
	detailedStats?: string;
	stats?: string;
	rankings?: string;
}

const itemRarity = (item: ItemLike): string =>
	findProbabilityMatch(item.probability ?? 0).icon;

const getItemRequirements = (item: ItemLike): string[] => {
	const requirements = [
		`Level: ${item.level ? item.level : 'Beginner'}`,
		`Usable by: ${item.permittedClassesAndTypes ? item.permittedClassesAndTypes.join(', ') : 'All'}`
	];

	const cardOddsEntry = odds[0]?.[item.name ?? ''];
	if (cardOddsEntry) {
		if (cardOddsEntry.hitChance !== undefined) {
			requirements.push(`Hit chance: ${cardOddsEntry.hitChance}% | DPT: ${cardOddsEntry.dpt}`);
		}
		if (cardOddsEntry.healChance !== undefined) {
			requirements.push(`Heal chance: ${cardOddsEntry.healChance}% | HPT: ${cardOddsEntry.hpt}`);
		}
		if (cardOddsEntry.effectChance !== undefined) {
			requirements.push(`Effect chance: ${cardOddsEntry.effectChance}%`);
		}
	}

	requirements.push(`MSRP: ${item.cost ? item.cost : 'free'}`);
	if (item.targetProp) requirements.push(`Targets: ${item.targetProp}`);
	if (item.cardClass) requirements.push(`Class: ${item.cardClass.join(', ')}`);

	return requirements;
};

interface FormatCardOptions {
	title: string;
	description?: string;
	stats?: string;
	rankings?: string;
	verbose?: boolean;
}

export const formatCard = ({
	title,
	description,
	stats,
	rankings,
	verbose
}: FormatCardOptions): string =>
	`
\`\`\`
==================================
${wrap(title, { indent: ' ', width: 32 })}
----------------------------------${
	!description
		? ''
		: `

${wrap(description, { indent: ' ', width: 32 })}`
}${
	!verbose || !stats
		? ''
		: `

${wrap(stats, { indent: ' ', width: 32 })}`
}${
	!verbose || !rankings
		? ''
		: `

${wrap(rankings, { indent: ' ', width: 32 })}`
}

==================================
\`\`\`
`;

export const formatCardAsHTML = (card: ItemLike): string =>
	`
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
`;

export const discoveryCard = (card: ItemLike, verbose = true): string =>
	formatCard({
		title: `${card.icon}  ${card.cardType}  ${itemRarity(card)}`,
		description: card.description,
		stats: card.stats,
		rankings: getItemRequirements(card).join('\n'),
		verbose
	});

export const itemCard = (item: ItemLike, verbose = false): string =>
	formatCard({
		title: `${item.icon}  ${item.itemType}  ${itemRarity(item)}`,
		description: item.description,
		stats: item.stats,
		rankings: getItemRequirements(item).join('\n'),
		verbose
	});

export const itemCardHTML = (item: ItemLike): string => formatCardAsHTML(item);

export const actionCard = (card: ItemLike, verbose?: boolean): string =>
	itemCard(card, verbose);

export const actionCardHTML = (card: ItemLike): string => itemCardHTML(card);

export const monsterCard = (monster: MonsterLike, verbose = true): string =>
	formatCard({
		title: `${monster.icon}  ${monster.givenName}`,
		description: verbose
			? upperFirst(monster.individualDescription)
			: monster.stats,
		stats: verbose ? monster.stats : upperFirst(monster.individualDescription),
		rankings: monster.rankings,
		verbose
	});

export const characterCard = (character: CharacterLike, verbose = true): string =>
	formatCard({
		title: `${character.icon}  ${character.givenName}`,
		stats: verbose ? character.detailedStats : character.stats,
		rankings: character.rankings,
		verbose: true
	});
