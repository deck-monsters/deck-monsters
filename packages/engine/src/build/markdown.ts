/**
 * Markdown renderer for the ROOT `.md` files only (PLAYER_HANDBOOK.md, MONSTERS.md,
 * CARDS.md, DMG.md).
 *
 * Why this file exists: `player-handbook-content.ts`, `dungeon-master-guide.ts`, and
 * `monster-manual.ts` build plain-text sections that are announced verbatim in-game (a
 * monospace feed on the web and in Discord), where `── Section ──` rule lines, `•`
 * bullets, and hand-aligned columns read fine. Pasting those same strings into a `.md`
 * file used to produce broken GitHub rendering: rule lines as paragraphs instead of
 * headings, lists collapsing into run-on paragraphs (GFM joins adjacent non-blank lines
 * with a soft break), and fragile fence balance around ASCII art. See
 * `docs/roadmap/10b-bugs-fixed.md` for the incident this generator produced.
 *
 * Two renderers, on purpose:
 *  - `convertPlainTextToMarkdown` below is a line-based converter for the *generic*
 *    plain-text shapes shared by every section (rule headings, sub-group headings,
 *    numbered steps, bullet lines, and short indented command examples). It is
 *    deliberately conservative: anything it cannot classify as a heading, a list, or a
 *    command is left as plain prose and merely re-flowed into a normal paragraph, never
 *    invented into a list it might get wrong.
 *  - Call sites that know their data structurally (the monster catalogue, the card/item
 *    catalogue, the command reference) skip the text converter entirely and render
 *    straight from that structured data (see `monster-manual.ts`'s
 *    `buildMonsterEntryMarkdown`, `card-catalogue.ts`, and `renderCommandCatalogMarkdown`
 *    below). Regexing already-rendered prose for those would be brittle — the shapes are
 *    known ahead of time, so building the Markdown directly is both simpler and safer.
 *
 * IMPORTANT: nothing here is used by the in-game announcers (`game.ts` calls
 * `playerHandbook`, `monsterManual`, `dungeonMasterGuide` directly, which read the plain
 * sections unchanged). Root-docs generation is the only caller. Keep it that way —
 * `root-docs.test.ts` snapshots in-game output and fails if this file's changes ever
 * leak into it.
 */

import { CATEGORY_LABELS, type CommandCategory, type CommandEntry } from '../commands/catalog.js';

/** Matches a GitHub-style anchor slug closely enough for this file's own in-document
 * links (lowercase, drop punctuation, spaces to hyphens). We only need it to agree with
 * itself: the same function builds both the table-of-contents links and, indirectly
 * (by choosing heading text), the headings GitHub will slugify the same way. */
export const slugify = (heading: string): string =>
	heading
		.trim()
		.toLowerCase()
		.replace(/<[^>]*>/g, '')
		.replace(/[^\p{L}\p{N}\s-]/gu, '')
		.replace(/\s+/g, '-');

/** Command verbs that identify an indented plain-text line as a runnable command rather
 * than a wrapped continuation of the previous sentence (see `looksLikeCommand`). Kept as
 * a fixed vocabulary, not a heuristic on capitalization alone, because prose sentences in
 * this codebase are hard-wrapped with a leading indent too (see DMG's Combat Math), and a
 * lowercase-first-word rule alone false-positives on words like "such" or "the". */
const COMMAND_VERBS = new Set([
	'train', 'equip', 'unequip', 'dismiss', 'revive', 'send', 'call', 'summon', 'move',
	'save', 'load', 'delete', 'use', 'give', 'take', 'visit', 'sell', 'edit', 'look',
	'help',
]);

const looksLikeCommand = (content: string): boolean => {
	if (content.startsWith('[')) return true;
	const firstWord = content.match(/^[a-zA-Z]+/)?.[0]?.toLowerCase();
	return firstWord !== undefined && COMMAND_VERBS.has(firstWord);
};

/** Splits `cmd          — description` (the em-dash-aligned columns used in the player
 * handbook's card/item quick reference) into its two halves. Returns the whole line as
 * `command` with no `description` when there is no such split. */
const splitCommandAndDescription = (content: string): { command: string; description?: string } => {
	const match = content.match(/^(.*?)\s{2,}—\s*(.+)$/);
	if (!match) return { command: content };
	return { command: match[1].trim(), description: match[2].trim() };
};

const renderCommandFragment = (content: string): string => {
	const { command, description } = splitCommandAndDescription(content);
	const rendered = looksLikeCommand(command) ? `\`${command}\`` : command;
	return description === undefined ? rendered : `${rendered} — ${description}`;
};

/** A "Capitalized Label: value" line, e.g. `Beginner: 0–49 XP` or `Example: spawn
 * monster as Alice`. Distinct from a command (which starts lowercase or with `[`): this
 * is the other shape a genuine list item takes in these sections. */
const looksLikeLabelledFact = (content: string): boolean => /^[A-Z][\w '"()/-]*:\s+\S/.test(content);

/**
 * True when `content` reads like a distinct list fact (a command or a "Label: value"
 * line) rather than wrapped prose. `convertPlainTextToMarkdown` uses this to decide
 * whether an indented run should become a bulleted list; `root-docs.test.ts`'s
 * "keep them clean" guard reuses it to catch a *future* regression of the same shape —
 * new plain-text content landing in a root file without being bulleted, the exact bug
 * that left the XP threshold table collapsed into a run-on paragraph.
 */
export const qualifiesAsListItem = (content: string): boolean =>
	looksLikeCommand(splitCommandAndDescription(content).command) || looksLikeLabelledFact(content);

/** True for a line one of `convertPlainTextToMarkdown`'s other branches already owns
 * (a rule heading, a sub-heading, a `•` bullet, or a numbered step). An indented-run scan
 * must stop at one of these instead of swallowing it — otherwise a `•` bullet whose text
 * wraps onto an indented second line eats every bullet after it into one run. */
const isSpecialLine = (line: string): boolean => {
	const trimmed = line.trim();
	return (
		/^─{2,}/.test(trimmed) ||
		/^-{2}\s+.+\s+-{2}$/.test(trimmed) ||
		/^•/.test(trimmed) ||
		/^\d+\)\s/.test(trimmed)
	);
};

/** Strips a line's leading 2+-space indent if it has one, otherwise just trims it. Used
 * once content has already been decided to be a plain-prose or list-candidate line, where
 * the original indentation no longer matters — only `renderContentLine`'s Markdown does. */
const dedent = (line: string): string => line.match(/^\s{2,}(\S.*)$/)?.[1] ?? line.trim();

/**
 * Converts one plain-text section (as produced by `player-handbook-content.ts` or
 * `dungeon-master-guide.ts`) into idiomatic GitHub Markdown.
 *
 * Handles, line by line:
 *  - `── Title ──────` → `## Title` (the section-rule heading every prose section opens
 *    with).
 *  - `-- Title --` → `### Title` (the command list's category sub-groups).
 *  - `• item` → `- item`, folding a wrapped second line with no `•` of its own back onto
 *    the same item instead of treating it as new content.
 *  - `N) step` → `N. step`, and short indented lines directly under a numbered step are
 *    kept as an indented continuation of that list item (so a worked example nested
 *    under "1) Train a monster" stays nested) rather than becoming their own list.
 *  - Any other run of consecutive lines (indented or not) is classified line by line:
 *    a line that reads as a runnable command (a known verb or a `[placeholder]`) is
 *    always bulleted — this is the "Commands as inline code" case from the brief
 *    (`look at cards  — see your cards`) — and a "Label: value" line (`Beginner: 0–49
 *    XP`) is bulleted only when a neighboring line in the same run is *also* list-shaped,
 *    so a genuine list (the XP threshold table, four INT-roll formulas back to back)
 *    gets bulleted while an isolated label-shaped clause mid-paragraph (DMG's "Escape:
 *    1d20 + …", one sub-point among plain ones) is left as prose instead of being
 *    stranded as a lone, out-of-context bullet. Anything left unbulleted is dedented and
 *    folds back into the surrounding paragraph, which is the correct outcome for a
 *    hard-wrapped sentence (DMG's Combat Math) — GFM joins adjacent non-blank lines with
 *    a soft break, so it reads as one paragraph either way.
 *
 * Blank-line placement around headings, fences, and list boundaries is *not* this
 * function's job — see `normalizeMarkdownSpacing`, applied after this pass.
 */
export const convertPlainTextToMarkdown = (text: string): string => {
	const lines = text.split('\n');
	const out: string[] = [];
	// 'numbered' / 'numbered-cont': inside a numbered step's own list item, so further
	// indented lines nest under it instead of becoming their own list.
	// 'bullet-cont': the previous line was a `•` bullet, so an indented line with no
	// bullet marker of its own is that bullet's wrapped text, not a new item.
	// null/other: not inside a list.
	let listContext: 'numbered' | 'numbered-cont' | 'bullet-cont' | null = null;

	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		const trimmed = line.trim();

		if (trimmed === '') {
			out.push('');
			// A numbered step's body can itself contain a blank line (GETTING_STARTED's
			// "Or specify cards directly:" sits between two indented command lines under
			// the same step) — keep nesting under it across the blank. A `•` bullet's
			// wrapped continuation never spans a blank line in this codebase, so that
			// context is safe (and correct) to drop here.
			if (listContext !== 'numbered' && listContext !== 'numbered-cont') listContext = null;
			i++;
			continue;
		}

		const ruleHeading = trimmed.match(/^─{2,}\s*(.+?)\s*─*$/);
		if (ruleHeading) {
			out.push(`## ${ruleHeading[1].trim()}`);
			listContext = null;
			i++;
			continue;
		}

		const subHeading = trimmed.match(/^-{2}\s+(.+?)\s+-{2}$/);
		if (subHeading) {
			out.push(`### ${subHeading[1].trim()}`);
			listContext = null;
			i++;
			continue;
		}

		const bullet = line.match(/^\s*•\s*(.+)$/);
		if (bullet) {
			out.push(`- ${bullet[1].trim()}`);
			listContext = 'bullet-cont';
			i++;
			continue;
		}

		const numberedStep = trimmed.match(/^(\d+)\)\s+(.*)$/);
		if (numberedStep) {
			out.push(`${numberedStep[1]}. ${numberedStep[2]}`);
			listContext = 'numbered';
			i++;
			continue;
		}

		const indented = line.match(/^\s{2,}(\S.*)$/);

		if (indented && (listContext === 'numbered' || listContext === 'numbered-cont')) {
			// Continuation of the current numbered step: keep it nested (3-space
			// indent matches "1. "), quoting it only if it is itself a command.
			out.push(`   ${renderCommandFragment(indented[1])}`);
			listContext = 'numbered-cont';
			i++;
			continue;
		}

		if (indented && listContext === 'bullet-cont') {
			// Wrapped text of the `•` bullet just emitted, not a new item: fold it back
			// onto that line so the item reads as one sentence.
			out[out.length - 1] += ` ${indented[1]}`;
			i++;
			continue;
		}

		// Not a continuation of an existing list: gather the whole contiguous run of
		// non-blank lines this one starts (indented or not — the run stops at a blank
		// line or a line one of the branches above owns) and classify each line against
		// its neighbors within that run, per the design note above.
		const run: string[] = [];
		let j = i;
		while (j < lines.length && lines[j].trim() !== '' && !isSpecialLine(lines[j])) {
			run.push(dedent(lines[j]));
			j++;
		}

		const qualifies = run.map(qualifiesAsListItem);
		run.forEach((content, idx) => {
			const isCommand = looksLikeCommand(splitCommandAndDescription(content).command);
			const hasQualifyingNeighbor = qualifies[idx - 1] || qualifies[idx + 1];
			const listify = qualifies[idx] && (isCommand || hasQualifyingNeighbor);
			out.push(listify ? `- ${renderCommandFragment(content)}` : content);
		});

		listContext = null;
		i = j;
	}

	return normalizeMarkdownSpacing(out.join('\n'));
};

type LineCategory = 'heading' | 'listitem' | 'plain';

const categorize = (line: string): LineCategory => {
	if (/^#{1,6}\s/.test(line)) return 'heading';
	if (/^\s*(?:[-*+]|\d+\.)\s/.test(line)) return 'listitem';
	return 'plain';
};

/**
 * Second pass: makes sure headings, fences, and list boundaries have the blank lines
 * GitHub's Markdown renderer needs (`## Heading` directly after a prose line, or a
 * ` ```` ` fence directly against text, both render wrong without one). Safe to run
 * broadly because it only ever *adds* blank lines — it never removes content or joins
 * lines — so at worst it produces a slightly looser list, never a run-on paragraph or a
 * heading that fails to render.
 */
export const normalizeMarkdownSpacing = (text: string): string => {
	const lines = text.split('\n');
	const out: string[] = [];
	let inFence = false;
	let prevCategory: LineCategory | null = null;
	let forceBlankNext = false;

	const lastLineBlank = (): boolean => out.length === 0 || out[out.length - 1] === '';

	for (const line of lines) {
		const isFenceMarker = /^\s*```/.test(line);

		if (isFenceMarker) {
			if (!inFence && !lastLineBlank()) out.push('');
			out.push(line);
			inFence = !inFence;
			forceBlankNext = !inFence; // closing fence: force a blank line after it
			prevCategory = null;
			continue;
		}

		if (inFence) {
			out.push(line);
			continue;
		}

		if (line.trim() === '') {
			out.push('');
			forceBlankNext = false;
			continue;
		}

		const category = categorize(line);
		const isHeading = category === 'heading';
		const needsBlankBefore =
			!lastLineBlank() &&
			(forceBlankNext || isHeading || prevCategory === 'heading' ||
				(prevCategory !== null && prevCategory !== category));

		if (needsBlankBefore) out.push('');
		out.push(line);

		prevCategory = category;
		forceBlankNext = isHeading; // force a blank line after a heading too
	}

	return out
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/^\n+/, '')
		.replace(/\n+$/, '\n');
};

/**
 * Splits a leading box-drawing banner (`╔══╗` / `║ ║` / `╚══╝`, as used by the player
 * handbook and DMG headers) from the prose that follows it, so the banner can be fenced
 * on its own — a fence that also contains prose balances awkwardly and reads as code in
 * GitHub (see the DMG ASCII-header bug this generator produced).
 */
export const extractLeadingBanner = (text: string): { banner: string | null; rest: string } => {
	const lines = text.split('\n');
	let end = 0;
	while (end < lines.length && /^[╔║╚]/.test(lines[end])) end++;

	if (end === 0) return { banner: null, rest: text };

	const banner = lines.slice(0, end).join('\n');
	const rest = lines.slice(end).join('\n').replace(/^\n+/, '');
	return { banner: `\`\`\`text\n${banner}\n\`\`\``, rest };
};

/**
 * Rewraps an already-rendered card/item frame (from `actionCard`/`itemCard`, which wrap
 * their ASCII-art stat block in a bare ` ``` ` fence for the in-game monospace feed) as
 * a tagged ` ```text ` fence under its own heading, so each card is a separate,
 * navigable, anchor-linkable block in the root file. The frame's own content is passed
 * through untouched — only the fence delimiters are retooled — so anything asserted
 * against the rendered card text (hit chance, DPT, stat lines) still matches byte for
 * byte.
 */
export const renderCardSection = (name: string, frame: string): string => {
	const withoutOuterFence = frame.trim().replace(/^```\n/, '').replace(/\n```$/, '');
	return `### ${name}\n\n\`\`\`text\n${withoutOuterFence}\n\`\`\``;
};

/** A `- [Name](#slug)` table-of-contents line for one card/monster/section heading. */
export const renderTocEntry = (name: string): string => `- [${name}](#${slugify(name)})`;

/**
 * Structured renderer for the command reference: reads `COMMAND_CATALOG` directly
 * instead of reformatting `formatCommandList()`'s already-aligned plain-text columns
 * (`-- Category --` / two-space-indented command / four-space-indented description),
 * which is exactly the "converter would be brittle" case from the design note above.
 */
export const renderCommandCatalogMarkdown = (catalog: CommandEntry[]): string => {
	const byCategory = new Map<CommandCategory, CommandEntry[]>();
	for (const entry of catalog) {
		const list = byCategory.get(entry.category) ?? [];
		list.push(entry);
		byCategory.set(entry.category, list);
	}

	const sections: string[] = [];
	for (const [category, label] of Object.entries(CATEGORY_LABELS) as [CommandCategory, string][]) {
		const entries = byCategory.get(category);
		if (!entries || entries.length === 0) continue;

		const items = entries.map(entry => {
			const example = entry.example ? ` (e.g. \`${entry.example}\`)` : '';
			return `- \`${entry.command}\` — ${entry.description}${example}`;
		});

		sections.push(`### ${label}\n\n${items.join('\n')}`);
	}

	return sections.join('\n\n');
};
