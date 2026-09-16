import React from 'react';

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
export function formatInlineMarkup(text: string, keyPrefix: string): React.ReactNode[] {
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

		if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
		nodes.push(
			delimiter === '*'
				? <strong key={`${keyPrefix}-b${start}`}>{content}</strong>
				: <em key={`${keyPrefix}-i${start}`}>{content}</em>,
		);
		lastIndex = end;
		match = INLINE_MARKUP.exec(text);
	}

	if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
	return nodes;
}

/**
 * Splits event text on triple-backtick boundaries and renders backtick-enclosed
 * segments as styled card panels. Plain segments get inline emphasis applied.
 */
export function formatEventText(text: string): React.ReactNode {
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

		return <span key={i}>{formatInlineMarkup(part, String(i))}</span>;
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
