import { actionCard } from '../helpers/card.js';
import allCards from '../cards/helpers/all.js';
import allMonsters from '../monsters/helpers/all.js';
import { cardFacts, type CardFacts } from '../cards/helpers/card-facts.js';
import { holdableByLevel } from '../cards/helpers/holdable.js';
import { CARD_ROLES, CARD_ROLE_LABELS, type CardRole } from '../cards/helpers/roles.js';
import { eachSeries } from '../helpers/promise.js';
import { createAnchorTracker, renderCardSection, renderTocEntry } from './markdown.js';

export type DocOutputFn = (section: string) => Promise<void> | void;

export const CARD_CATALOGUE_HEADING = 'The Card Catalogue (Player Reference)';

/**
 * The CARDS.md intro. The link target is `ITEMS.md` on purpose: GitHub and the in-game
 * Help page (`guideFiles` in `apps/web/src/lib/markdown.tsx`) both resolve a link by that
 * exact href, so the line reads "Items guide" yet still opens the Items tab.
 */
const CARD_CATALOGUE_HEADER = `## ${CARD_CATALOGUE_HEADING}\n\nItems are in the [Items guide](ITEMS.md).`;

/** Legend for the numbers in each card (roadmap 44 review). Used verbatim. */
export const CARD_LEGEND = [
	'How to read a card:',
	'',
	'- Hit chance: how often the card hurt its target in practice plays.',
	"- DPT: the damage it does each time it's played, on average, with misses counted.",
	'- Heal chance and HPT: the same, for healing.',
	'- MSRP: its price in the shop, in coins.',
	'- Targets: the stat the target defends with. ac is armour class.',
	'- Level and Usable by: the level a monster needs, and which monsters can use it.',
].join('\n');

/** Group intros and the "which cards when" copy: roadmap 44, "The text". Used verbatim. */
export const CARD_GROUP_INTROS: Readonly<Record<CardRole, string>> = {
	attack: "Cards that hit one opponent. Most roll a d20 against the target's AC, then roll for damage. Bigger dice hit harder.",
	area: 'Cards that strike every opponent at once. Each hit is smaller, but in a crowded ring they add up.',
	heal: 'Cards that give hit points back. A monster at 0 HP is out of the fight, so a heal at the right moment can matter more than a hit.',
	guard: 'Cards that make your monster harder to hit, stronger for a while, or gone from sight. They do nothing to the other side; they help you last.',
	trick: 'Cards that hold, curse, poison, confuse or rob an opponent instead of simply hitting them. Read these closely.',
};

export const HOLDABLE_HEADING = 'What each type can hold';
export const HOLDABLE_INTRO =
	'Every card says which monsters can use it and from which level. Cards only one type can use are its signature cards.';

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name);

/** `Beginner` for level 0, otherwise the number. */
const levelLabel = (level: number): string => (level === 0 ? 'Beginner' : String(level));

const renderTypeHoldable = (creatureType: string): string => {
	const levels = holdableByLevel(creatureType);
	const signature: CardFacts[] = levels
		.flatMap(l => l.cards)
		.filter(c => c.signatureOf === creatureType)
		.sort(byName);
	const signatureLine = `Signature cards: ${signature.length ? signature.map(c => c.name).join(', ') : 'none'}.`;
	const rows = levels.map(l => `| ${levelLabel(l.level)} | ${l.cards.map(c => c.name).join(', ')} |`);

	return [`### ${creatureType}`, '', signatureLine, '', '| Level | Cards that open up |', '|---|---|', ...rows].join('\n');
};

/**
 * Root-file-only (`CARDS.md`) renderer: straight to Markdown, grouped by role (roadmap 44).
 * Each group is a `##` section; each card is a `###` heading over its full card
 * (`actionCard(card, true)`: description, dice, level, who can use it, chance and damage
 * per turn, price) in a ```text fence, so it is individually linkable from the contents.
 * A final `##` section lists, per monster type, the cards that open up at each level.
 *
 * Items are not here any more: they are generated into ITEMS.md (`items-guide.ts`).
 *
 * Every heading and contents link comes from one `cardFacts` instance. `cardType` is
 * sometimes an *instance* getter that overrides the static one (the Kalevala appends its
 * dice: "The Kalevala (1d4)"), and a contents link built from the static name never
 * matched the heading rendered from the instance — a permanently broken
 * `](#the-kalevala)` link (docs/roadmap/10b-bugs-fixed.md). `cardFacts.name` is the stable
 * name, so heading and link cannot drift.
 */
export const generateCardCatalogue = async (output: DocOutputFn): Promise<void> => {
	const entries = allCards.map(Card => {
		const card = new Card();
		return { card, facts: cardFacts(card) };
	});
	const groups = CARD_ROLES.map(role => ({
		role,
		label: CARD_ROLE_LABELS[role],
		cards: entries.filter(e => e.facts.role === role).sort((a, b) => byName(a.facts, b.facts)),
	}));

	// One tracker, fed every heading in render order, so each contents link matches the
	// anchor GitHub's own slugger assigns even when a name repeats.
	const anchorFor = createAnchorTracker();
	anchorFor(CARD_CATALOGUE_HEADING);
	anchorFor('Contents');
	const groupAnchors = groups.map(g => ({
		group: anchorFor(g.label),
		cards: g.cards.map(e => anchorFor(e.facts.name)),
	}));
	const holdableAnchor = anchorFor(HOLDABLE_HEADING);

	const contents = groups.map((g, gi) => [
		renderTocEntry(g.label, () => groupAnchors[gi].group),
		...g.cards.map((e, ci) => `  ${renderTocEntry(e.facts.name, () => groupAnchors[gi].cards[ci])}`),
	].join('\n'));
	contents.push(renderTocEntry(HOLDABLE_HEADING, () => holdableAnchor));

	const jumpTo = `Jump to: ${[
		...groups.map((g, gi) => `[${g.label}](#${groupAnchors[gi].group})`),
		`[${HOLDABLE_HEADING}](#${holdableAnchor})`,
	].join(' · ')}`;

	await output(`${CARD_CATALOGUE_HEADER}\n\n${CARD_LEGEND}\n\n## Contents\n\n${jumpTo}\n\n${contents.join('\n')}`);

	await eachSeries(groups, async g => {
		await output(`## ${g.label}\n\n${CARD_GROUP_INTROS[g.role]}`);
		await eachSeries(g.cards, e => output(renderCardSection(e.facts.name, actionCard(e.card, true))));
	});

	await output(`## ${HOLDABLE_HEADING}\n\n${HOLDABLE_INTRO}`);
	await eachSeries(allMonsters, Monster => output(renderTypeHoldable((Monster as any).creatureType as string)));
};

export default generateCardCatalogue;
