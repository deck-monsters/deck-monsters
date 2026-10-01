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
};

const OPENING_QUOTES = new Set(['"', '“']);
const CLOSING_QUOTES = new Set(['"', '”']);

/** The unquoted fit: the candidate's name is a whole-word prefix of `lower` (already trimmed). */
function fits(c: RecipientCandidate, trimmed: string, lower: string): number {
	const m = c.match.trim().toLowerCase();
	if (!m) return 0;
	if (!lower.startsWith(m)) return 0;
	const next = trimmed.charAt(m.length);
	if (next !== '' && !/\s/.test(next)) return 0;
	return m.length;
}

function uniqueOthers(
	fitting: RecipientCandidate[],
	chosen: RecipientCandidate
): Array<{ userId: string; name: string }> {
	const seen = new Set<string>([chosen.userId]);
	const out: Array<{ userId: string; name: string }> = [];
	for (const c of fitting) {
		if (seen.has(c.userId)) continue;
		seen.add(c.userId);
		out.push({ userId: c.userId, name: c.name });
	}
	return out;
}

/**
 * Splits `rest` ("Anthony Bourdain good luck") into the recipient and the message: the longest
 * player name `rest` starts with, ignoring case, ending at a word boundary so "Ann" never
 * swallows "Anna's". A quoted name (`"Anthony" Bourdain ...`) matches exactly that name and
 * nothing longer. Returns null when no name fits.
 */
export function matchRecipient(candidates: RecipientCandidate[], rest: string): RecipientMatch | null {
	const trimmed = rest.trim();

	if (trimmed && OPENING_QUOTES.has(trimmed.charAt(0))) {
		const chars = Array.from(trimmed);
		const close = chars.findIndex((ch, i) => i > 0 && CLOSING_QUOTES.has(ch));
		if (close < 0) return null;
		const inner = chars.slice(1, close).join('').trim().toLowerCase();
		if (!inner) return null;
		const exact = candidates.filter((c) => c.match.trim().toLowerCase() === inner);
		const best = exact[0];
		if (!best) return null;
		return {
			userId: best.userId,
			name: best.name,
			message: chars.slice(close + 1).join('').trim(),
			quoted: true,
			// Two players with the very same name: the quotes cannot tell them apart.
			alsoFits: uniqueOthers(exact, best),
		};
	}

	const lower = trimmed.toLowerCase();
	let best: RecipientCandidate | null = null;
	let bestLength = 0;
	const fitting: RecipientCandidate[] = [];
	for (const c of candidates) {
		const length = fits(c, trimmed, lower);
		if (!length) continue;
		fitting.push(c);
		if (length > bestLength) {
			best = c;
			bestLength = length;
		}
	}
	if (!best) return null;
	return {
		userId: best.userId,
		name: best.name,
		message: trimmed.slice(bestLength).trim(),
		quoted: false,
		alsoFits: uniqueOthers(fitting, best),
	};
}
