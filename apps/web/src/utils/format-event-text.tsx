import React from 'react';
import type { KnownMonster, MentionIndex } from './monster-mentions.js';

/**
 * Draws known monsters' sprites in place of their emoji (roadmap 24). Optional: without it,
 * or with the player's pixel monsters turned off, text renders exactly as it always has.
 */
export interface MonsterMentions {
	index: MentionIndex;
	render: (monster: KnownMonster, key: string) => React.ReactNode;
}

/**
 * Renders one run of plain text. `offset` is where the run starts in the segment the
 * mention spans were found in, so a sprite can still be placed after markup has split the
 * segment into bold, italic and plain runs.
 */
type RenderRun = (text: string, offset: number, key: string) => React.ReactNode[];

const plainRun: RenderRun = (text) => [text];

/**
 * The engine writes for Slack: ``` fences for monospace blocks, *asterisks* for bold and
 * _underscores_ for italics. On the web we turn fences into `.event-card-block` panels
 * and the inline pairs into real emphasis.
 *
 * Inline markup is deliberately NOT applied inside a fenced block: those carry ASCII card
 * boxes and stat lines where `*` and `_` are drawing characters, not formatting.
 */

/** One `*bold*` or `_italic_` pair. The content may not span lines or contain a delimiter. */
const INLINE_MARKUP = /([*_])(\S(?:[^*_\n]*\S)?|\S)\1/g;

/**
 * A delimiter touching a word character is part of that word, not markup — otherwise
 * `room_player_stats` renders its middle as italics. Checked on both sides rather than
 * with lookbehind, which Safari only gained in 16.4.
 */
function isWordChar(char: string | undefined): boolean {
	return char !== undefined && /\w/.test(char);
}

/** Renders `*bold*` / `_italic_` within a single non-fenced segment. */
export function formatInlineMarkup(
	text: string,
	keyPrefix: string,
	renderRun: RenderRun = plainRun,
): React.ReactNode[] {
	const nodes: React.ReactNode[] = [];
	let lastIndex = 0;

	INLINE_MARKUP.lastIndex = 0;
	let match = INLINE_MARKUP.exec(text);
	while (match !== null) {
		const [raw, delimiter, content] = match;
		const start = match.index;
		const end = start + raw.length;

		if (isWordChar(text[start - 1]) || isWordChar(text[end])) {
			// Not markup — leave it as literal text and keep scanning past this delimiter.
			INLINE_MARKUP.lastIndex = start + 1;
			match = INLINE_MARKUP.exec(text);
			continue;
		}

		if (start > lastIndex) {
			nodes.push(...renderRun(text.slice(lastIndex, start), lastIndex, `${keyPrefix}-t${lastIndex}`));
		}
		const inner = renderRun(content, start + 1, `${keyPrefix}-c${start}`);
		nodes.push(
			delimiter === '*'
				? <strong key={`${keyPrefix}-b${start}`}>{inner}</strong>
				: <em key={`${keyPrefix}-i${start}`}>{inner}</em>,
		);
		lastIndex = end;
		match = INLINE_MARKUP.exec(text);
	}

	if (lastIndex < text.length) {
		nodes.push(...renderRun(text.slice(lastIndex), lastIndex, `${keyPrefix}-t${lastIndex}`));
	}
	return nodes;
}

/** A `RenderRun` that swaps each matched monster icon for its sprite. */
function mentionRun(segment: string, mentions: MonsterMentions): RenderRun {
	const spans = mentions.index.find(segment);
	if (spans.length === 0) return plainRun;
	return (text, offset, key) => {
		const nodes: React.ReactNode[] = [];
		let cursor = 0;
		for (const span of spans) {
			const start = span.start - offset;
			const end = span.end - offset;
			// Spans are found on the whole segment; skip any outside this run. An icon never
			// straddles a run boundary, because markup delimiters are not emoji.
			if (start < cursor || end > text.length) continue;
			if (start > cursor) nodes.push(text.slice(cursor, start));
			nodes.push(mentions.render(span.monster, `${key}-m${span.start}`));
			cursor = end;
		}
		if (cursor < text.length) nodes.push(text.slice(cursor));
		return nodes;
	};
}

/**
 * Splits event text on triple-backtick boundaries and renders backtick-enclosed
 * segments as styled card panels. Plain segments get inline emphasis applied.
 */
export function formatEventText(text: string, mentions?: MonsterMentions | null): React.ReactNode {
	const parts = text.split('```');

	return parts.map((part, i) => {
		const isBlock = i % 2 === 1;
		if (!part) return null;

		if (isBlock) {
			return (
				<div key={i} className="event-card-block">
					{part}
				</div>
			);
		}

		// Fenced blocks above are left alone on purpose: they are ASCII card art laid out in
		// monospace columns, and a sprite in place of an emoji would shift the columns.
		const renderRun = mentions ? mentionRun(part, mentions) : plainRun;
		return <span key={i}>{formatInlineMarkup(part, String(i), renderRun)}</span>;
	});
}

/**
 * Shortens event text for a preview without cutting inside a word or leaving a ``` fence
 * open. An unbalanced fence makes everything after it render as one runaway card panel,
 * which is what a plain `.slice()` produced in the fight log's event trace.
 */
export function truncateEventText(text: string, max: number): string {
	if (text.length <= max) return text;

	let cut = text.slice(0, max);
	const lastSpace = cut.lastIndexOf(' ');
	// Only honour a word boundary if it does not throw most of the budget away.
	if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);

	cut = `${cut.trimEnd()}…`;

	// An odd number of fences means we cut inside a block — close it.
	const fences = cut.split('```').length - 1;
	if (fences % 2 === 1) cut += '\n```';

	return cut;
}
