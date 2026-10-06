import type { FeedLine } from './types.js';

/**
 * Splits prose into clean `narration` lines: one per non-blank source line, trimmed.
 *
 * Used where a site's text is free-form (card flavour text, narration) and may carry its
 * own newlines. Only layout whitespace goes; inline markup stays exactly as authored so
 * `lines` and `text` cannot drift (see `announcements/feed-lines.test.ts`).
 */
export const proseLines = (text: string | undefined | null): FeedLine[] =>
	String(text ?? '')
		.split('\n')
		.map(line => line.trim())
		.filter(line => line !== '')
		.map(line => ({ kind: 'narration', text: line }));

type StandingSource = { identityWithHp: string; givenName: string; hp: number; maxHp: number };

/** The `standing` line for a creature's `identityWithHp` ("🦄 Name (12 hp)"). */
export const standingLine = (creature: StandingSource): FeedLine => ({
	kind: 'standing',
	text: creature.identityWithHp,
	name: creature.givenName,
	hp: creature.hp,
	maxHp: creature.maxHp,
});

/**
 * Splits `text` into clean lines and builds the first one with `lead` (the line that carries
 * the facts); any further lines are plain `narration`. For sites whose text is one
 * sentence that a card or caller may extend with authored prose of its own.
 */
export const leadLines = (text: string | undefined | null, lead: (line: string) => FeedLine): FeedLine[] => {
	const [first, ...rest] = proseLines(text);
	if (!first) return [];
	return [lead(first.text), ...rest];
};

/**
 * A single-line `system` feed line for bookkeeping and command-flow messages ("Fight
 * resolved (win)", "X has fallen in the fight") whose text is already one clean line.
 */
export const systemLine = (text: string, name?: string): FeedLine => ({
	kind: 'system',
	text,
	...(name === undefined ? {} : { name }),
});
