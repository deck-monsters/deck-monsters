import type { FeedLine } from '@deck-monsters/engine';

/**
 * Turns an event's `payload.lines` (roadmap 46a) into the blocks the feed draws.
 *
 * The same blocks feed the renderer (`components/FeedLines.tsx`) and the row-height estimate
 * (`utils/feed-row-height.ts`), so what is booked and what is drawn cannot disagree: the
 * estimate sums these blocks' text, and the renderer draws exactly them. A line that is
 * replaced (a Millefleur divider, a composed summary) is replaced here, once.
 *
 * Layout whitespace is not in the lines; spacing comes from CSS (`--feed-line-gap`, the row
 * padding). Events with no `lines` (stored before roadmap 46a, private command replies,
 * countdowns) never come through here: callers render their `text` as they always have.
 */

/** `terminal` is every dark theme; `millefleur` replaces some kinds with composed sentences. */
export type FeedStyle = 'terminal' | 'millefleur';

export interface FeedPart {
	text: string;
	/** Run `*bold*` / `_italic_` markup over this part (engine text); composed text is literal. */
	markup?: boolean;
	strong?: boolean;
	/** The danger rose ("bloodied"). */
	danger?: boolean;
}

export interface FeedBlock {
	key: string;
	/** The line's kind, or a composed block's own (`summary`, `roll-result`, `divider`). */
	kind: string;
	/** Columns of left indent (CSS `ch`); the estimate wraps that many columns earlier. */
	indent: number;
	parts: FeedPart[];
	/** A card frame: the first line is the title, the rest the body. */
	card?: { title: string; body: string };
	/** A Millefleur divider (a round marker): one line plus the divider's own margin. */
	divider?: boolean;
	/** A boss's arrival sentence (the line's own fact). */
	boss?: boolean;
}

const isLine = (value: unknown): value is FeedLine =>
	typeof value === 'object' && value !== null && typeof (value as { kind?: unknown }).kind === 'string' &&
	typeof (value as { text?: unknown }).text === 'string';

/** The event's lines, or null when it has none (render from `text`). */
export function feedLinesOf(payload: unknown): FeedLine[] | null {
	const lines = (payload as { lines?: unknown } | null | undefined)?.lines;
	if (!Array.isArray(lines) || lines.length === 0 || !lines.every(isLine)) return null;
	return lines as FeedLine[];
}

/** True when a boss arrival is announced: the line's own fact, else the old payload shape. */
export function isBossArrivalEvent(payload: unknown, lines: FeedLine[] | null): boolean {
	const arrival = lines?.find((line) => line.kind === 'arrival');
	if (arrival && arrival.kind === 'arrival') return arrival.boss === true;
	const contestant = (payload as { contestant?: { isBoss?: boolean } } | null | undefined)?.contestant;
	return contestant?.isBoss === true;
}

/** Indent, in columns, that the dark feed kept from the old text ("    Hit!" under a roll). */
const TERMINAL_INDENT: Partial<Record<string, number>> = { outcome: 4 };

const MILLEFLEUR_INDENT = 2;

/**
 * The engine's hp sentence already ends ("*Quoloth has -4HP.*"). Appending ", bloodied"
 * after that period painted "has -4HP., bloodied" (live check, 2026-10-06). The rose
 * clause goes inside the sentence, and the closing markup star stays on the name's clause
 * so the two parts don't leave an open `*`.
 */
function bloodiedHpParts(text: string): FeedPart[] {
	const match = text.match(/^(.*?)(\.)(\**)\s*$/);
	if (!match) return [{ text, markup: true }, { text: ', bloodied', danger: true }];
	const [, stem, dot, stars] = match;
	return [
		{ text: `${stem}${stars}`, markup: true },
		{ text: ', bloodied', danger: true },
		{ text: dot },
	];
}

/** The part of a line's text before `name`: the monster's icon cluster, so sprites still draw. */
function iconBefore(text: string, name: string): string {
	const at = text.indexOf(name);
	return at > 0 ? text.slice(0, at).trim() : '';
}

const withIcon = (icon: string, name: string) => (icon ? `${icon} ${name}` : name);

/** "Hit  •" is the card's name plus its rarity glyph; the sentence wants the name. */
export function cardNameOf(title: string): string {
	return title.replace(/[\s•○●◦·★☆◆◇]+$/u, '').trim() || title.trim();
}

export function signed(n: number): string {
	return n < 0 ? ` -${Math.abs(n)}` : ` +${n}`;
}

/** The rule for "bloodied" when a line does not carry it: at or under half health. */
export const isBloodied = (hp: number, maxHp: number) => maxHp > 0 && hp * 2 <= maxHp;

/** One sentence per creature: "Poirot is at 24/33 hp." plus ", bloodied" in the danger rose. */
function standingParts(line: Extract<FeedLine, { kind: 'standing' }>): FeedPart[] | null {
	if (line.hp === undefined || line.maxHp === undefined) return null;
	const icon = iconBefore(line.text, line.name);
	const parts: FeedPart[] = [{ text: `${withIcon(icon, line.name)} is at ${line.hp}/${line.maxHp} hp` }];
	if (isBloodied(line.hp, line.maxHp)) parts.push({ text: ', bloodied', danger: true });
	parts.push({ text: '.' });
	return parts;
}

function rollOutcomePhrase(
	roll: Extract<FeedLine, { kind: 'roll' }>,
	outcome: string | undefined,
): string | null {
	const special = roll.result === 'nat20' ? 'natural 20!' : roll.result === 'nat1' ? 'critical failure!' : null;
	if (special) {
		// Bare Hit!/Miss... repeats the verdict; explanations still belong to the card.
		const redundant = !outcome || /^(hit!|miss\.\.\.)$/i.test(outcome.trim());
		return redundant ? special : `${special} ${outcome}`;
	}
	if (outcome) {
		const plain = outcome.replace(/^\s*(hit!|miss\.\.\.)\s*/i, '').trim();
		const word = /^hit/i.test(outcome) ? 'hit' : /^miss/i.test(outcome) ? 'misses' : null;
		if (word) return plain ? `${word}. ${plain}` : word;
		return outcome.replace(/[.!]+$/, '');
	}
	// No outcome line and nothing to beat: a damage or effect roll has no verdict to state.
	if (roll.vs === undefined) return null;
	return roll.result === 'success' ? 'succeeds' : 'fails';
}

/**
 * "Nufuq rolled 9 +1 = 10 vs 9 · hit". The numbers are the roll line's own facts and the
 * verdict is the card's (`result`), never recomputed from total and vs: a tie can succeed.
 * `1d20` is left off (it is the default attack die); anything else is named.
 */
export function composeRoll(
	roll: Extract<FeedLine, { kind: 'roll' }>,
	outcome?: string,
): FeedPart[] {
	if (!hasNumericRollFacts(roll)) return [{ text: roll.text, markup: true }];
	let text = `${roll.who} rolled ${roll.natural}`;
	if (roll.bonus !== 0) text += `${signed(roll.bonus)} = ${roll.total}`;
	const die = roll.die?.replace(/\s/g, '').toLowerCase();
	if (die && die !== '1d20') text += ` on ${roll.die}`;
	if (roll.vs !== undefined) text += ` vs ${roll.vs}`;
	else if (roll.reason) text += ` ${roll.reason.replace(/\.$/, '')}`;
	const phrase = rollOutcomePhrase(roll, outcome);
	if (phrase) text += ` · ${phrase}`;
	return [{ text }];
}

function hasNumericRollFacts(roll: Extract<FeedLine, { kind: 'roll' }>): roll is Extract<FeedLine, { kind: 'roll' }> & { natural: number; bonus: number; total: number } {
	return Number.isFinite(roll.natural) && Number.isFinite(roll.bonus) && Number.isFinite(roll.total) && roll.result !== undefined;
}

/** The engine's card frame rules (`helpers/card.ts` `formatCard`), 34 columns. */
const CARD_RULE_HEAVY = '='.repeat(34);
const CARD_RULE_LIGHT = '-'.repeat(34);

function plainBlock(line: FeedLine, key: string, style: FeedStyle): FeedBlock {
	if (line.kind === 'card') {
		const [title = '', ...rest] = line.text.split('\n');
		if (style === 'terminal') {
			// The terminal themes keep the ASCII frame Discord shows (owner, 2026-10-06: "for the
			// terminal interfaces … the ascii style render is preferred"). The engine's line drops
			// the rules, so they are redrawn here at the frame's 34 columns; the frame is all body,
			// so the row estimate counts every rule as the line it is.
			const body = [CARD_RULE_HEAVY, title, CARD_RULE_LIGHT, ...rest, CARD_RULE_HEAVY].join('\n');
			return { key, kind: 'card', indent: 0, parts: [], card: { title: '', body } };
		}
		return { key, kind: 'card', indent: 0, parts: [], card: { title, body: rest.join('\n') } };
	}
	// The threshold line already says "is now bloodied" (hit.ts). Appending the clause
	// again painted "is now bloodied. … has only 17HP, bloodied." (live check, 2026-10-06).
	const alreadySaysBloodied = line.kind === 'hp' && /bloodied/i.test(line.text);
	const parts: FeedPart[] = line.kind === 'hp' && line.bloodied && style === 'millefleur' && !alreadySaysBloodied
		? bloodiedHpParts(line.text)
		: [{ text: line.text, markup: true }];
	return {
		key,
		kind: line.kind,
		indent: style === 'terminal' ? (TERMINAL_INDENT[line.kind] ?? 0) : 0,
		parts,
		...(line.kind === 'arrival' && line.boss ? { boss: true } : {}),
	};
}

/**
 * Lines to blocks. `terminal` is one block per line, in order, with the engine's own words.
 * `millefleur` composes some kinds, each keeping the facts of what it replaces:
 *
 * - `round` -> a divider, "ROUND 3" (uppercased and tracked by CSS).
 * - `turn` + the `standing` lines after it -> "Round 1, turn 2. A is at 24/33 hp. B is at
 *   7/31 hp, bloodied." (falls back to the lines' own text when a creature has no hp).
 * - `play` + the `card` after it -> "A plays Card" (the frame stays below it).
 * - `roll` + `verdict` + `outcome` -> "A rolled 9 +1 = 10 vs 9 · hit".
 * - `hp` keeps its text and gains ", bloodied" in the danger rose when the line says so,
 *   unless the sentence already says "bloodied" (the threshold announcement).
 */
export function composeFeedBlocks(lines: readonly FeedLine[], style: FeedStyle): FeedBlock[] {
	const blocks: FeedBlock[] = [];
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i]!;
		const key = `l${i}`;
		if (style === 'terminal') {
			blocks.push(plainBlock(line, key, style));
			continue;
		}

		if (line.kind === 'round') {
			blocks.push({ key, kind: 'round', indent: 0, divider: true, parts: [{ text: `Round ${line.round}` }] });
			continue;
		}

		if (line.kind === 'turn') {
			let end = i + 1;
			while (lines[end]?.kind === 'standing') end += 1;
			const standings = lines.slice(i + 1, end) as Extract<FeedLine, { kind: 'standing' }>[];
			const sentences = standings.map(standingParts);
			if (standings.length > 0 && sentences.every((s): s is FeedPart[] => s !== null)) {
				const parts: FeedPart[] = [{ text: `Round ${line.round}, turn ${line.turn}.` }];
				for (const sentence of sentences) parts.push({ text: ' ' }, ...sentence);
				blocks.push({ key, kind: 'summary', indent: 0, parts });
				i = end - 1;
				continue;
			}
		}

		if (line.kind === 'play') {
			const next = lines[i + 1];
			if (next?.kind === 'card') {
				const icon = iconBefore(line.text, line.actor);
				blocks.push({
					key,
					kind: 'play',
					indent: 0,
					parts: [
						{ text: withIcon(icon, line.actor), strong: true },
						{ text: ' plays ' },
						{ text: cardNameOf(next.title), strong: true },
					],
				});
				continue;
			}
		}

		if (line.kind === 'roll' && hasNumericRollFacts(line)) {
			let end = i + 1;
			if (lines[end]?.kind === 'verdict') end += 1;
			const outcomes: string[] = [];
			while (lines[end]?.kind === 'outcome') {
				outcomes.push(lines[end]!.text);
				end += 1;
			}
			blocks.push({
				key,
				kind: 'roll-result',
				indent: MILLEFLEUR_INDENT,
				parts: composeRoll(line, outcomes.join(' ') || undefined),
			});
			i = end - 1;
			continue;
		}

		blocks.push(plainBlock(line, key, style));
	}
	return blocks;
}

/** The text a block puts on screen, for the estimate: parts joined, a card's lines kept. */
export function blockText(block: FeedBlock): string {
	if (block.card) return [block.card.title, block.card.body].filter(Boolean).join('\n');
	return block.parts.map((part) => part.text).join('');
}

/** The blocks an event draws, or null when it renders from `text`. */
export function feedBlocksOf(payload: unknown, style: FeedStyle): FeedBlock[] | null {
  const lines = feedLinesOf(payload);
  return lines ? composeFeedBlocks(lines, style) : null;
}

/** Only Millefleur composes; every other theme reads like the old terminal feed. */
export const feedStyleFor = (theme: string): FeedStyle => (theme === 'millefleur' ? 'millefleur' : 'terminal');
