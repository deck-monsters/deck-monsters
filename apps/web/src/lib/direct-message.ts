import { DM_TEXT, matchRecipient, type RecipientCandidate } from '@deck-monsters/engine';
import type { ChatMessage, ChatPlayer } from '@deck-monsters/server/types';

/**
 * The Console's side of room chat (roadmap 41): how a chat line reads, which players `dm `
 * suggests and in what order, and who a typed `dm` goes to. Pure, so it is unit-tested without
 * a DOM. The name matching is the engine's `matchRecipient`, the same function the server
 * resolves `dm` with, so the "To:" preview cannot disagree with where the message really goes.
 */

/** The Console line for a chat message: room, DM to you, or a DM you sent. */
export function chatLineText(message: ChatMessage, myUserId: string | undefined): string {
  const mine = message.senderUserId === myUserId;
  if (message.recipientUserId === null) {
    return `💬 ${mine ? 'You' : message.senderName}: ${message.text}`;
  }
  return mine
    ? `✉️ You to ${message.recipientName ?? 'Player'}: ${message.text}`
    : `✉️ ${message.senderName} to you: ${message.text}`;
}

/** The unread line shown once when the Console opens with unread chat. */
export function unreadChatLine(count: number): string {
  return `💬 ${count} new ${count === 1 ? 'message' : 'messages'} in Chat.`;
}

const CHAT_WORD = /^(msg|message|m|dm)(?:\s+([\s\S]*))?$/i;
// While a question is open the one-letter `m` is NOT a chat command: "M Jones" is a plausible
// answer to a naming prompt, and posting it to the whole room would be worse than a missed chat.
const CHAT_WORD_DURING_PROMPT = /^(msg|message|dm)\s+\S/i;
const DM_PREFIX = /^dm\s+/i;

/**
 * True when `line` is a chat command. Outside a question: `msg`, `message`, `m` and `dm`, with
 * or without text (the server refuses an empty one with a hint). While a question is open: only
 * `msg `, `message ` and `dm ` followed by text, so a bare or one-letter reply stays an answer.
 */
export function isChatLine(line: string, promptOpen: boolean): boolean {
  const trimmed = line.trim();
  return promptOpen ? CHAT_WORD_DURING_PROMPT.test(trimmed) : CHAT_WORD.test(trimmed);
}

/**
 * The text after `dm `, or null when the input is not a `dm` line (so no preview, no list).
 * Leading whitespace is ignored, as the server does, so a stray space cannot hide the preview.
 */
export function dmRest(input: string): string | null {
  const match = DM_PREFIX.exec(input.trimStart());
  return match ? input.trimStart().slice(match[0].length) : null;
}

export type PickedRecipient = { userId: string; name: string };

/** True while `input` still begins `dm {name} ` with the picked name exactly as inserted. */
export function stillPicked(input: string, picked: PickedRecipient | null): boolean {
  if (!picked) return false;
  const rest = dmRest(input);
  return rest !== null && rest.startsWith(`${picked.name} `);
}

export type DmTarget =
  /** Not a `dm` line. */
  | { kind: 'none' }
  /** `dm ` and nothing else yet. */
  | { kind: 'usage' }
  /** A `dm` line whose text names nobody (yet). */
  | { kind: 'nomatch' }
  /** The text names two players who go by the very same name. */
  | { kind: 'ambiguous'; name: string }
  /** The text names the sender. */
  | { kind: 'self' }
  | {
      kind: 'player';
      userId: string;
      name: string;
      /** What follows the name, trimmed. */
      message: string;
      /** True when the player was picked from the list, so the id is sent, not re-parsed. */
      picked: boolean;
      /** Other players whose name also fits (always empty for a picked or quoted name). */
      alsoFits: string[];
    };

/**
 * The candidate names a typed `dm` is matched against: the server's own list when it has
 * loaded, else the To picker's names. Same list, same matcher, same answer as the send.
 */
export function dmCandidatesOf(dmCandidates: RecipientCandidate[] | undefined, members: ChatPlayer[]): RecipientCandidate[] {
  if (dmCandidates && dmCandidates.length > 0) return dmCandidates;
  return members.map((p) => ({ userId: p.userId, name: p.name, match: p.name }));
}

/**
 * Who the `dm` being typed goes to, in the order the server decides: usage, a picked player,
 * no match, two players with one name, yourself, then the player. A picked player wins as long
 * as the name is still exactly as inserted; otherwise the typed text is matched as the server will.
 */
export function resolveDmTarget(
  input: string,
  candidates: RecipientCandidate[],
  picked: PickedRecipient | null,
  myUserId?: string
): DmTarget {
  const rest = dmRest(input);
  if (rest === null) return { kind: 'none' };
  if (picked && stillPicked(input, picked)) {
    return {
      kind: 'player',
      userId: picked.userId,
      name: picked.name,
      message: rest.slice(picked.name.length).trim(),
      picked: true,
      alsoFits: [],
    };
  }
  if (!rest.trim()) return { kind: 'usage' };
  const match = matchRecipient(candidates, rest);
  if (!match) return { kind: 'nomatch' };
  if (match.ambiguous) return { kind: 'ambiguous', name: match.name };
  if (myUserId !== undefined && match.userId === myUserId) return { kind: 'self' };
  return {
    kind: 'player',
    userId: match.userId,
    name: match.name,
    message: match.message,
    picked: false,
    alsoFits: match.alsoFits.map((o) => o.name),
  };
}

/** Joins names the way the preview reads them: "A", "A and B", "A, B and C". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The words of the DM preview around the highlighted name. `lead` is "To: ", then the name is
 * shown highlighted by the caller, then `tail`.
 */
export type DmPreviewText = { lead: string; name: string | null; tail: string };

// DRAFT(41): "are" for several names; the plan's text only has the single-name form.
export function dmPreviewText(target: DmTarget): DmPreviewText | null {
  if (target.kind === 'none') return null;
  if (target.kind === 'usage') return { lead: DM_TEXT.usage, name: null, tail: '' };
  if (target.kind === 'self') return { lead: DM_TEXT.self, name: null, tail: '' };
  if (target.kind === 'ambiguous') return { lead: DM_TEXT.ambiguous.replaceAll('{name}', target.name), name: null, tail: '' };
  if (target.kind === 'nomatch') return { lead: 'No player here by that name yet.', name: null, tail: '' };
  if (target.alsoFits.length === 0) return { lead: 'To: ', name: target.name, tail: '' };
  const others = joinNames(target.alsoFits);
  const verb = target.alsoFits.length === 1 ? 'is' : 'are';
  return {
    lead: 'To: ',
    name: target.name,
    tail: `. ${others} ${verb} in this room too. Pick a name from the list to be sure.`,
  };
}

export const MAX_DM_SUGGESTIONS = 8;

export type DmSuggestion = { label: string; insertValue: string; userId: string };

/** Whether `query` starts the name or any word of it, ignoring case. */
function nameFits(name: string, query: string): boolean {
  if (!query) return true;
  const words = name.toLowerCase().split(/\s+/);
  return words.some((_, i) => words.slice(i).join(' ').startsWith(query));
}

/**
 * The players `dm ` offers, in the order the owner asked for (roadmap 41):
 *  1. the player you last sent a DM to;
 *  2. the player who last sent you a DM, if that is someone else;
 *  3. players with a monster in the ring, the current fight or the wait for one;
 *  4. everyone else, alphabetically.
 * A player is listed once, in the first tier that claims them. Typing narrows the list.
 * `ringUserIds` is the owning user id of each contestant in the ring.
 */
export function orderDmSuggestions(args: {
  members: ChatPlayer[];
  messages: ChatMessage[];
  myUserId: string | undefined;
  ringUserIds: Iterable<string | null | undefined>;
  query: string;
}): DmSuggestion[] {
  const { members, messages, myUserId } = args;
  const query = args.query.trim().toLowerCase();
  const byId = new Map(members.map((p) => [p.userId, p]));
  const byName = (a: ChatPlayer, b: ChatPlayer) => a.name.localeCompare(b.name);

  let lastSentTo: string | null = null;
  let lastReceivedFrom: string | null = null;
  // Messages arrive ascending by id, but do not rely on it: take the highest id.
  let sentId = -1;
  let receivedId = -1;
  for (const m of messages) {
    if (m.recipientUserId === null) continue;
    if (m.senderUserId === myUserId && m.id > sentId) {
      sentId = m.id;
      lastSentTo = m.recipientUserId;
    } else if (m.recipientUserId === myUserId && m.id > receivedId) {
      receivedId = m.id;
      lastReceivedFrom = m.senderUserId;
    }
  }

  const ordered: ChatPlayer[] = [];
  const listed = new Set<string>();
  const add = (p: ChatPlayer | undefined) => {
    if (!p || listed.has(p.userId)) return;
    listed.add(p.userId);
    ordered.push(p);
  };
  if (lastSentTo) add(byId.get(lastSentTo));
  if (lastReceivedFrom) add(byId.get(lastReceivedFrom));
  const inRing = new Set<string>();
  for (const id of args.ringUserIds) if (id) inRing.add(id);
  members.filter((p) => inRing.has(p.userId)).sort(byName).forEach(add);
  [...members].sort(byName).forEach(add);

  return ordered
    .filter((p) => nameFits(p.name, query))
    .slice(0, MAX_DM_SUGGESTIONS)
    .map((p) => ({ label: p.name, insertValue: `dm ${p.name} `, userId: p.userId }));
}
