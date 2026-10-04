import { expect } from 'chai';

import {
	collectAllRootArtifacts,
	collectCardsMarkdown,
	collectDmgMarkdown,
	collectInGameDmgMarkdown,
	collectMonstersMarkdown,
	collectPlayerHandbookMarkdown,
	DM_ONLY_MARKERS,
	FILE_ONLY_OPERATOR_MARKERS,
	generateRootDocs,
	normalizeLineEndings,
} from './root-docs.js';
import { createAnchorTracker, qualifiesAsListItem } from './markdown.js';
import allCards from '../cards/helpers/all.js';
import allItems from '../items/helpers/all.js';
import allMonsters from '../monsters/helpers/all.js';
import { actionCard } from '../helpers/card.js';
import { cardFacts } from '../cards/helpers/card-facts.js';
import { holdableByLevel } from '../cards/helpers/holdable.js';
import { CARD_ROLES, CARD_ROLE_LABELS, type CardRole } from '../cards/helpers/roles.js';
import { CARD_GROUP_INTROS, HOLDABLE_HEADING, HOLDABLE_INTRO } from './card-catalogue.js';
import {
	ITEMS_END_MARKER,
	ITEMS_HEADING,
	ITEMS_INTRO,
	ITEMS_START_MARKER,
	renderItemsSection,
	spliceItemsGuide,
} from './items-guide.js';

/**
 * Splits Markdown into `{ inside, outside }` line arrays by fence state, so the "keep
 * them clean" guards below can assert against prose without also matching card/item
 * ASCII art (which legitimately contains `═`, box-drawing characters, and long runs of
 * `=`/`-`) or formula blocks (which legitimately use a 2-space indent).
 */
const splitByFence = (content: string): { inside: string[]; outside: string[] } => {
	const inside: string[] = [];
	const outside: string[] = [];
	let inFence = false;

	for (const line of content.split('\n')) {
		if (/^\s*```/.test(line)) {
			inFence = !inFence;
			continue;
		}
		(inFence ? inside : outside).push(line);
	}

	return { inside, outside };
};

describe('root-docs generation', () => {
	it('includes DM-only operational sections in root DMG but not in CARDS', async () => {
		const dmg = await collectDmgMarkdown();
		const cards = await collectCardsMarkdown();

		for (const marker of DM_ONLY_MARKERS) {
			expect(dmg, `DMG should include "${marker}"`).to.include(marker);
			expect(cards, `CARDS must not include "${marker}"`).to.not.include(marker);
		}
	});

	it('excludes file-only operator markers from in-game DMG while root DMG retains them', async () => {
		const rootDmg = await collectDmgMarkdown();
		const inGameDmg = await collectInGameDmgMarkdown();

		for (const marker of FILE_ONLY_OPERATOR_MARKERS) {
			expect(rootDmg, `root DMG should include "${marker}"`).to.include(marker);
			expect(inGameDmg, `in-game DMG must not include "${marker}"`).to.not.include(marker);
		}

		expect(inGameDmg).to.include('── Combat Math');
		expect(inGameDmg).to.include('── Stats Reference');
	});

	it('documents Basilisk/Jinn/Minotaur spawn HP/AC using engine variance semantics', async () => {
		const monsters = await collectMonstersMarkdown();
		const dmg = await collectDmgMarkdown();

		// MONSTERS.md now renders each monster's stats as a Markdown table (`| HP | 30–35 … |`)
		// instead of the in-game `HP:  30–35` rule-line block, so these check the numeric
		// facts survived the reformat, not the old literal prefix.
		expect(monsters).to.include('30–35');
		expect(monsters).to.include('7–9');
		expect(monsters).to.include('28–33');
		expect(monsters).to.include('32–37');
		expect(monsters).to.include('4–6');
		expect(dmg).to.include('hpVariance = random(0, 5) + typeHpOffset');
		expect(dmg).to.include('acVariance = random(0, 2) + typeAcOffset');
	});

	it('shows the full card for every card in CARDS, grouped by role (DMG keeps its own odds tables)', async () => {
		const cards = await collectCardsMarkdown();
		const dmg = await collectDmgMarkdown();

		expect(cards).to.include('Player Reference');
		expect(cards).to.include('Items are in the [Items guide](ITEMS.md).');
		// The old contract forbade the odds line here. Guide entries are now the full card
		// (roadmap 44), so the numbers a player needs while building a deck are in it.
		expect(cards).to.match(/Hit chance: \d+% \| DPT:/);
		expect(dmg).to.match(/Hit chance: \d+% \| DPT:/);
	});

	describe('CARDS.md structure', () => {
		const headings = (content: string, level: number): string[] =>
			splitByFence(content).outside
				.filter(line => line.startsWith(`${'#'.repeat(level)} `))
				.map(line => line.slice(level + 1));

		it('has one section per role, in order, each opening with its intro line', async () => {
			const cards = await collectCardsMarkdown();
			const labels = CARD_ROLES.map(role => CARD_ROLE_LABELS[role]);

			expect(headings(cards, 2)).to.deep.equal([
				'The Card Catalogue (Player Reference)',
				'Contents',
				...labels,
				HOLDABLE_HEADING,
			]);
			for (const role of CARD_ROLES) {
				expect(cards).to.include(`## ${CARD_ROLE_LABELS[role]}\n\n${CARD_GROUP_INTROS[role]}\n\n### `);
			}
		});

		it('lists every card exactly once, under its own role, alphabetically', async () => {
			const cards = await collectCardsMarkdown();
			const lines = splitByFence(cards).outside;
			const facts = allCards.map(Card => cardFacts(Card));

			// Card names are the `###` headings that sit before the final "which cards when"
			// section; the type headings after it are monsters.
			const holdableAt = lines.indexOf(`## ${HOLDABLE_HEADING}`);
			const cardHeadings = lines.slice(0, holdableAt).filter(l => l.startsWith('### ')).map(l => l.slice(4));
			expect(cardHeadings).to.have.length(facts.length);
			expect(new Set(cardHeadings).size).to.equal(facts.length);

			let section: CardRole | undefined;
			const seenByRole = new Map<CardRole, string[]>();
			for (const line of lines.slice(0, holdableAt)) {
				const group = CARD_ROLES.find(role => line === `## ${CARD_ROLE_LABELS[role]}`);
				if (group) section = group;
				else if (line.startsWith('### ') && section) {
					seenByRole.set(section, [...(seenByRole.get(section) ?? []), line.slice(4)]);
				}
			}
			for (const role of CARD_ROLES) {
				const expected = facts.filter(f => f.role === role).map(f => f.name).sort((a, b) => a.localeCompare(b));
				expect(seenByRole.get(role), `${role} group`).to.deep.equal(expected);
			}
		});

		it('shows each card as its full card, the same text the Console prints with numbers', async () => {
			const cards = await collectCardsMarkdown();
			for (const Card of allCards) {
				const frame = actionCard(new Card(), true).trim().replace(/^```\n/, '').replace(/\n```$/, '');
				expect(cards, `${new Card().cardType} full card`).to.include(`\`\`\`text\n${frame}\n\`\`\``);
			}
		});

		it('ends with a section for every monster type, with a Level | Cards that open up table', async () => {
			const cards = await collectCardsMarkdown();
			const after = cards.slice(cards.indexOf(`## ${HOLDABLE_HEADING}`));

			expect(after).to.include(HOLDABLE_INTRO);
			expect(headings(after, 3)).to.deep.equal(allMonsters.map(M => (M as any).creatureType));
			for (const Monster of allMonsters) {
				const type = (Monster as any).creatureType as string;
				const start = after.indexOf(`### ${type}\n`);
				const section = after.slice(start, after.indexOf('\n### ', start + 1) === -1 ? undefined : after.indexOf('\n### ', start + 1));
				expect(section, type).to.match(/\nSignature cards: .+\.\n/);
				expect(section, type).to.include('| Level | Cards that open up |\n|---|---|\n| Beginner |');
				for (const { level, cards: held } of holdableByLevel(type)) {
					const label = level === 0 ? 'Beginner' : String(level);
					expect(section, `${type} level ${label}`).to.include(`| ${label} | ${held.map(c => c.name).join(', ')} |`);
				}
			}
		});

		it('leaves items out of CARDS (they are in ITEMS.md)', async () => {
			const cards = await collectCardsMarkdown();
			expect(headings(cards, 2)).to.not.include('Items');
			expect(cards).to.not.include('### Item List');
		});
	});

	describe('ITEMS.md generated section', () => {
		const authored = '# Items\n\nAuthored rules.\n\n## Practical preparation\n\nKeep this.\n';

		it('is appended once when the markers are missing, and holds every item', () => {
			const out = spliceItemsGuide(authored);
			expect(out.startsWith(authored.trimEnd())).to.equal(true);
			expect(out.split(ITEMS_START_MARKER)).to.have.length(2);
			expect(out).to.include(`## ${ITEMS_HEADING}\n\n${ITEMS_INTRO}`);
			for (const Item of allItems) {
				const name = (new Item() as { itemType?: string }).itemType ?? Item.name;
				expect(out, name).to.include(`### ${name}\n`);
			}
			expect(out.endsWith('\n')).to.equal(true);
		});

		it('rewrites only between the markers and is idempotent', () => {
			const once = spliceItemsGuide(authored);
			expect(spliceItemsGuide(once)).to.equal(once);
			const edited = once.replace('Keep this.', 'Keep this, edited.').replace(
				ITEMS_END_MARKER, `stale line\n${ITEMS_END_MARKER}`,
			);
			const again = spliceItemsGuide(edited);
			expect(again).to.include('Keep this, edited.');
			expect(again).to.not.include('stale line');
		});

		it('refuses a lone marker rather than guess', () => {
			expect(() => spliceItemsGuide(`${authored}\n${ITEMS_START_MARKER}\n`)).to.throw(/marker/);
		});

		it('keeps the Markdown clean: tagged fences, no stray box characters, blank-line headings', () => {
			const { outside, inside } = splitByFence(renderItemsSection());
			expect(inside.length).to.be.greaterThan(0);
			expect(outside.filter(l => /[─═╔║╚╗╝]/.test(l))).to.have.length(0);
			outside.forEach((line, i) => {
				if (/^#{1,6}\s/.test(line)) {
					expect(outside[i - 1], line).to.equal('');
					expect(outside[i + 1], line).to.equal('');
				}
			});
			expect(renderItemsSection().match(/^```text$/gm)?.length).to.equal(allItems.length);
		});
	});

	it('uses LF line endings in all generated root artifacts', async () => {
		const artifacts = await collectAllRootArtifacts();

		for (const [name, content] of Object.entries(artifacts)) {
			expect(content, `${name} must not contain carriage returns`).to.not.include('\r');
		}
	});

	it('generateRootDocs is reproducible for every root artifact without touching disk', async () => {
		const first = await collectAllRootArtifacts();
		const second = await collectAllRootArtifacts();

		for (const key of Object.keys(first) as Array<keyof typeof first>) {
			expect(second[key], `${key} should be byte-identical`).to.equal(first[key]);
		}

		const writes: string[] = [];
		await generateRootDocs((basename, content, suffix = 'md') => {
			writes.push(`${basename}.${suffix}:${content.length}`);
		});
		expect(writes).to.deep.equal([
			'DMG.md:' + first.DMG.length,
			'CARDS.md:' + first.CARDS.length,
			'MONSTERS.md:' + first.MONSTERS.length,
			'PLAYER_HANDBOOK.md:' + first.PLAYER_HANDBOOK.length,
			'cards.html:' + first.cardsHtml.length,
		]);
	});

	it('starts each generated markdown artifact with a title and ownership notice', async () => {
		// The root files render the notice as one blockquote line; DM_ONLY_MARKERS-style
		// literal-text greps (this suite, and anyone else's) still match on the sentence
		// text alone.
		const notice =
			'> Generated from packages/engine/src/build — do not edit this file directly. ' +
			'Run `pnpm run build:docs`.';
		const artifacts: Array<[string, string, string]> = [
			['PLAYER_HANDBOOK', collectPlayerHandbookMarkdown(), '║     PLAYER HANDBOOK'],
			['CARDS', await collectCardsMarkdown(), '.------..------.'],
			['MONSTERS', await collectMonstersMarkdown(), '███▄ ▄███▓'],
			['DMG', await collectDmgMarkdown(), '██████╗ ███╗   ███╗'],
		];

		for (const [name, content, preserved] of artifacts) {
			const lines = content.split('\n');
			expect(lines[0], `${name} title`).to.match(/^# .+/);
			expect(lines[1], `${name} blank line`).to.equal('');
			expect(content.startsWith(`${lines[0]}\n\n${notice}\n`), `${name} notice`).to.equal(true);
			expect(content.indexOf(preserved), `${name} keeps the existing header below the notice`).to.be.greaterThan(
				content.indexOf(notice),
			);
		}

		const inGameDmg = await collectInGameDmgMarkdown();
		expect(inGameDmg).to.not.include('do not edit this file directly');
	});

	it('teaches combat stats, card roles, and a labeled deck example', () => {
		const handbook = collectPlayerHandbookMarkdown();

		// The root handbook renders rule-line headings as real `##` headings.
		expect(handbook).to.include('## Combat Stats & Card Roles');
		expect(handbook).to.include('Temporary boosts and curses affect both the stat and rolls derived from it.');
		expect(handbook).to.include('Delayed Hits can remain armed together');
		expect(handbook).to.include(
			'Every copy still armed on that monster answers the next qualifying blow',
		);
		expect(handbook).not.to.include('two blows');
		expect(handbook).to.include('Molasses → Forked Stick');
		expect(handbook).to.include('Example, not a universal best deck');
		expect(handbook).to.include('One-Heal alternative');
		expect(handbook).to.include('Level 3 Minotaur');
		expect(handbook).not.to.include('37-card');
	});

	it('documents the temporary-stat contract in DMG formulas', async () => {
		const dmg = await collectDmgMarkdown();

		expect(dmg).to.include('derived modifier = pre-battle modifier + encounter delta');
		expect(dmg).to.include('added once');
		expect(dmg).to.include('The raw stat floors at 1');
		expect(dmg).to.include('Ordinary melee damage is damage dice plus the STR modifier');
		expect(dmg).to.include('Horn Gore, use half the STR modifier');
		expect(dmg).to.include('1d20 + STR modifier + matchup');
		expect(dmg).to.include('+2 against a Basilisk or a Gladiator');
		expect(dmg).to.include('-2 against a Jinn or a Minotaur');
		expect(dmg).to.include('Forked Stick pin threshold');
		expect(dmg).to.include('AC has no attack modifier');
		expect(dmg).to.include('-(level + 1)');
		expect(dmg).not.to.include('-3 per level');
	});

	it('normalizes CRLF and bare CR to LF', () => {
		expect(normalizeLineEndings('a\r\nb\rc')).to.equal('a\nb\nc');
	});

	/**
	 * Regression guard for the GitHub-rendering bugs this generator produced (see
	 * `docs/roadmap/10b-bugs-fixed.md`): rule-line headings that render as plain
	 * paragraphs, ASCII banners that swallow prose into their fence, and lists that
	 * collapse into a run-on paragraph because GFM joins adjacent non-blank lines with a
	 * soft break. These only ever check the *root* artifacts — the in-game text these
	 * are built from stays untouched, plain, monospace-formatted text on purpose.
	 */
	describe('keeps the root Markdown files clean', () => {
		const rootArtifacts = async (): Promise<Array<[string, string]>> => [
			['CARDS.md', await collectCardsMarkdown()],
			['DMG.md', await collectDmgMarkdown()],
			['MONSTERS.md', await collectMonstersMarkdown()],
			['PLAYER_HANDBOOK.md', collectPlayerHandbookMarkdown()],
		];

		it('balances every ``` fence', async () => {
			for (const [name, content] of await rootArtifacts()) {
				const fenceMarkers = content.split('\n').filter(line => /^\s*```/.test(line));
				expect(fenceMarkers.length % 2, `${name} has an unbalanced \`\`\` fence`).to.equal(0);
			}
		});

		it('tags every opening fence (a closing ``` needs no tag)', async () => {
			for (const [name, content] of await rootArtifacts()) {
				let inFence = false;
				const untaggedOpens: string[] = [];

				for (const line of content.split('\n')) {
					if (!/^\s*```/.test(line)) continue;
					const isOpen = !inFence;
					if (isOpen && line.trim() === '```') untaggedOpens.push(line);
					inFence = !inFence;
				}

				expect(untaggedOpens, `${name} has an untagged opening \`\`\` fence — use \`\`\`text`).to.have.length(0);
			}
		});

		it('has no rule-line or box-banner characters outside a fence', async () => {
			for (const [name, content] of await rootArtifacts()) {
				const { outside } = splitByFence(content);
				const stray = outside.filter(line => /[─═╔║╚╗╝]/.test(line));
				expect(stray, `${name} has rule/box-drawing characters outside a fence: ${stray[0]}`).to.have.length(0);
			}
		});

		it('surrounds every heading with a blank line', async () => {
			for (const [name, content] of await rootArtifacts()) {
				const { outside } = splitByFence(content);
				outside.forEach((line, i) => {
					if (!/^#{1,6}\s/.test(line)) return;
					if (i > 0) expect(outside[i - 1], `${name}: "${line}" needs a blank line before it`).to.equal('');
					if (i < outside.length - 1) {
						expect(outside[i + 1], `${name}: "${line}" needs a blank line after it`).to.equal('');
					}
				});
			}
		});

		it('has no accidentally-indented code (4+ leading spaces) outside a fence', async () => {
			// CommonMark treats a 4-space indent as a code block; this generator's own
			// list continuations use a 3-space indent (matching "1. "/"- " width)
			// specifically to stay under that threshold, so this only needs to catch a
			// genuine 4+ space slip, not the intentional nesting.
			for (const [name, content] of await rootArtifacts()) {
				const { outside } = splitByFence(content);
				const accidental = outside.filter(line => /^ {4,}\S/.test(line));
				expect(accidental, `${name} has an accidentally-indented line: ${accidental[0]}`).to.have.length(0);
			}
		});

		it('does not leave two consecutive un-bulleted list-shaped lines (a collapsed list)', async () => {
			// Reproduces the exact shape of the XP-threshold-table bug: several
			// consecutive "Label: value" or command lines that were never converted
			// into list items collapse into one run-on paragraph on GitHub.
			for (const [name, content] of await rootArtifacts()) {
				const { outside } = splitByFence(content);
				for (let i = 0; i < outside.length - 1; i++) {
					const isPlain = (line: string): boolean =>
						line !== '' && !/^#{1,6}\s/.test(line) && !/^[-*]\s/.test(line) &&
						!/^\d+\.\s/.test(line) && !/^\|/.test(line);

					if (isPlain(outside[i]) && isPlain(outside[i + 1]) &&
						qualifiesAsListItem(outside[i]) && qualifiesAsListItem(outside[i + 1])) {
						expect.fail(
							`${name}: "${outside[i]}" / "${outside[i + 1]}" look like an un-bulleted list`
						);
					}
				}
			}
		});

		it('ends with exactly one trailing newline', async () => {
			for (const [name, content] of await rootArtifacts()) {
				expect(content.endsWith('\n'), `${name} must end with a newline`).to.equal(true);
				expect(content.endsWith('\n\n'), `${name} must not end with a blank line`).to.equal(false);
			}
		});

		it('never renders a prose label as a command (no inline code ends with ":")', async () => {
			// Regression guard for "Call your monster back at any time:" being
			// misclassified as a command: a real command is typed verbatim (lowercase,
			// or a `[placeholder]`) and is never a label. An inline-code span that starts
			// uppercase is only legitimate as a known card/item name or inside an equip
			// example ("equip [monster] with \"Molasses\", …" starts lowercase itself, so
			// this exception exists for a bare card/item name rendered on its own).
			const knownNames = new Set([
				...allCards.map((Card: { cardType?: string }) => Card.cardType ?? ''),
				...allItems.map((Item: { itemType?: string }) => Item.itemType ?? ''),
			]);

			for (const [name, content] of await rootArtifacts()) {
				const { outside } = splitByFence(content);
				for (const line of outside) {
					for (const span of line.match(/`[^`]+`/g) ?? []) {
						const inner = span.slice(1, -1);
						expect(inner.endsWith(':'), `${name}: inline code "${inner}" ends with ":" — a label, not a command`)
							.to.equal(false);

						const firstChar = inner[0];
						const startsUppercase =
							firstChar !== undefined && firstChar !== firstChar.toLowerCase() &&
							firstChar === firstChar.toUpperCase();
						if (startsUppercase) {
							const isEquipExample = /^equip /.test(inner) || inner.includes('with "');
							expect(
								knownNames.has(inner) || isEquipExample,
								`${name}: inline code "${inner}" starts uppercase and is not a known card/item name`
							).to.equal(true);
						}
					}
				}
			}
		});

		// Regression guard for a TOC (or any other `](#anchor)`
		// reference) built from a different name than the heading it points at silently
		// produces a link that never lands anywhere on GitHub. Two real examples:
		// CARDS.md's Card List built the anchor from the static `Card.cardType` while the
		// `###` heading used the *instance*'s `cardType` getter (`KalevalaCard` appends its
		// damage dice: "The Kalevala" vs "The Kalevala (1d4)"), and MONSTERS.md's TOC used
		// the bare `creatureType` ("Basilisk") while the heading also includes the class
		// label ("Basilisk (Barbarian)"). Reproduces GitHub's own slugging
		// (`createAnchorTracker`/`slugify`, including its `-1`/`-2` dedup for a name that
		// repeats) and walks every heading in document order so it catches the same class
		// of bug anywhere in a generated root doc, not just these two spots.
		it('every ](#anchor) link resolves to a heading slug', async () => {
			for (const [name, content] of await rootArtifacts()) {
				const { outside } = splitByFence(content);

				const anchorFor = createAnchorTracker();
				const headingAnchors = new Set<string>();
				for (const line of outside) {
					const heading = line.match(/^#{1,6}\s+(.+?)\s*$/);
					if (heading) headingAnchors.add(anchorFor(heading[1]!));
				}

				const brokenLinks: string[] = [];
				for (const line of outside) {
					for (const match of line.matchAll(/\]\(#([^)]+)\)/g)) {
						const anchor = match[1]!;
						if (!headingAnchors.has(anchor)) brokenLinks.push(anchor);
					}
				}

				expect(brokenLinks, `${name} has ](#anchor) links with no matching heading: ${brokenLinks.join(', ')}`)
					.to.have.length(0);
			}
		});
	});
});
