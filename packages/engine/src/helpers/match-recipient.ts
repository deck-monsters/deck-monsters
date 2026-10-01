/**
 * Who a `dm` goes to (roadmap 41). Browser-safe and pure: the server resolves the recipient
 * with it and the web Console previews the same answer before the line is sent, so the two can
 * never disagree about who "dm Anthony Bourdain is too powerful" is for.
 *
 * Why this has more than a longest-match: with players "Anthony" and "Anthony Bourdain" in a
 * room, the text alone cannot say whether the sender meant a message to Anthony that starts
 * "Bourdain is...". Longest-match picks Anthony Bourdain (almost always right), the result
 * lists every OTHER player whose name also fits so the Console can warn, and quotes
 * (`dm "Anthony" Bourdain is too powerful`) let the sender be exact.
 *
 * Names and text are compared after normalising: any Unicode space (NBSP, em space, ...) is one
 * space, and zero-width characters vanish, so a pasted or mobile-typed space cannot split a name
 * and an invisible character cannot make two players look different. The comparison walks code
 * points and lowercases each one separately: lowercasing the whole string can change its length
 * ("İ" becomes two code units), and slicing the original text by that length once sent the wrong
 * message part. The message is cut from the ORIGINAL text at the matched position.
 */

export type RecipientCandidate = {
	userId: string;
	/** The name shown to players. */
	name: string;
	/** The text to match against: the name itself, or another name the player is known by. */
	match: string;
};

export type RecipientMatch = {
	userId: string;
	name: string;
	/** What follows the name, trimmed. May be empty. */
	message: string;
	/** True when the sender quoted the name. */
	quoted: boolean;
	/** Other players whose name also fits the start of the text (one entry per player). */
	alsoFits: Array<{ userId: string; name: string }>;
	/**
	 * True when another player's name is IDENTICAL to the matched one (after normalising), so
	 * the text cannot say which was meant. Callers refuse and ask for a pick from the list.
	 */
	ambiguous: boolean;
};

/** Refusal wording the server sends and the Console preview shows, in one place. */
export const DM_TEXT = {
	self: "That's you. Pick someone else.",
	ambiguous: 'Two players here go by {name}. Pick one from the list.',
	usage: "Type dm, a player's name, and your message, like: dm Ada good luck.",
};

const OPENING_QUOTES = new Set(['"', '“']);
const CLOSING_QUOTES = new Set(['"', '”']);
const ZERO_WIDTH = /[​-‍⁠﻿]/;
const SPACE = /\s/;

type Norm = {
	/** Normalised code points, each lowercased. */
	cps: string[];
	/** Index into the original string where each normalised code point starts. */
	at: number[];
	/** Original string length. */
	end: number;
};

function normalize(text: string): Norm {
	const cps: string[] = [];
	const at: number[] = [];
	let i = 0;
	let pendingSpace = -1;
	for (const ch of text) {
		const start = i;
		i += ch.length;
		if (ZERO_WIDTH.test(ch)) continue;
		if (SPACE.test(ch)) {
			if (cps.length > 0 && pendingSpace < 0) pendingSpace = start;
			continue;
		}
		if (pendingSpace >= 0) {
			cps.push(' ');
			at.push(pendingSpace);
			pendingSpace = -1;
		}
		cps.push(ch.toLowerCase());
		at.push(start);
	}
	return { cps, at, end: text.length };
}

/** Whether `name` (normalised) is a whole-word prefix of `text`. Returns its length or 0. */
function fitLength(name: string[], text: string[]): number {
	if (name.length === 0 || name.length > text.length) return 0;
	for (let k = 0; k < name.length; k++) if (name[k] !== text[k]) return 0;
	const next = text[name.length];
	return next === undefined || next === ' ' ? name.length : 0;
}

const key = (cps: string[]) => cps.join('');

type Prepared = { c: RecipientCandidate; name: string[] };

function result(
	best: Prepared,
	fitting: Prepared[],
	message: string,
	quoted: boolean,
	same: (p: Prepared) => boolean
): RecipientMatch {
	const seen = new Set<string>([best.c.userId]);
	const alsoFits: Array<{ userId: string; name: string }> = [];
	for (const p of fitting) {
		if (seen.has(p.c.userId)) continue;
		seen.add(p.c.userId);
		alsoFits.push({ userId: p.c.userId, name: p.c.name });
	}
	const ambiguous = fitting.some((p) => p.c.userId !== best.c.userId && same(p));
	return { userId: best.c.userId, name: best.c.name, message, quoted, alsoFits, ambiguous };
}

/**
 * Splits `rest` ("Anthony Bourdain good luck") into the recipient and the message: the longest
 * player name `rest` starts with, ignoring case, ending at a word boundary so "Ann" never
 * swallows "Anna's". A quoted name (`"Anthony" Bourdain ...`) matches exactly that name and
 * nothing longer. Returns null when no name fits.
 *
 * If any player's own name begins with a quote character, quotes are not treated as quoting at
 * all (the text is matched as typed), so `dm "Ace" hi` can reach a player called `"Ace"` and can
 * never be hijacked to a different player called Ace. Pick that player from the list.
 */
export function matchRecipient(candidates: RecipientCandidate[], rest: string): RecipientMatch | null {
	const text = normalize(rest);
	if (text.cps.length === 0) return null;

	const prepared: Prepared[] = candidates
		.map((c) => ({ c, name: normalize(c.match).cps }))
		.filter((p) => p.name.length > 0);
	const messageAfter = (count: number) => rest.slice(count < text.at.length ? text.at[count]! : text.end).trim();

	const nameHasQuote = prepared.some((p) => OPENING_QUOTES.has(p.name[0]!));
	if (!nameHasQuote && OPENING_QUOTES.has(text.cps[0]!)) {
		const close = text.cps.findIndex((ch, i) => i > 0 && CLOSING_QUOTES.has(ch));
		if (close < 0) return null;
		const inner = key(text.cps.slice(1, close)).trim();
		if (!inner) return null;
		const exact = prepared.filter((p) => key(p.name) === inner);
		const best = exact[0];
		if (!best) return null;
		return result(best, exact, messageAfter(close + 1), true, () => true);
	}

	let best: Prepared | null = null;
	let bestLength = 0;
	const fitting: Prepared[] = [];
	for (const p of prepared) {
		const length = fitLength(p.name, text.cps);
		if (!length) continue;
		fitting.push(p);
		if (length > bestLength) {
			best = p;
			bestLength = length;
		}
	}
	if (!best) return null;
	const bestName = key(best.name);
	return result(best, fitting, messageAfter(bestLength), false, (p) => key(p.name) === bestName);
}
