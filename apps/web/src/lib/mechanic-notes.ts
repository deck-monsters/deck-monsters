/**
 * First-time mechanic notes (roadmap 39, batch 3 / C4).
 *
 * The first time a player sees a ring event, an ambush, bosses turning on each other or a
 * boss's temperament, one short line under the announcement says what the rule is. The
 * engine tags those lines structurally (`payload.ringEvent.id` or `payload.mechanic`), so
 * nothing here matches prose. Discord players see the narration without the note.
 *
 * State: a per-player "explained" set in local storage (`mechanicsExplained:${userId}`,
 * the per-user pattern `ftuxComplete:${userId}` uses), shared by the Ring feed and the
 * Console feed, so a note shown in one is not shown again in the other.
 *
 * Why an in-memory claim on top of storage: the feeds are virtualized, so a row re-renders
 * (and remounts on scroll). If "explained" were only the stored set, the act of showing the
 * note would hide it on the very next render of the same row. The first row to ask for a
 * key claims it for the session and keeps showing its note; every other row is refused.
 */

const RING_EVENT_INTRO = 'A ring event changes one fight.';

export const MECHANIC_NOTES: Readonly<Record<string, string>> = {
  'ring-event:gauntlet': `${RING_EVENT_INTRO} In The Gauntlet, extra bosses join, so the bosses outnumber the challengers and turn on each other too.`,
  'ring-event:blood-feud': `${RING_EVENT_INTRO} In a Blood Feud there are no teams: teammates fight each other too.`,
  'ring-event:common-cause': `${RING_EVENT_INTRO} In Common Cause every challenger is on one side against the bosses, and the survivors win together.`,
  'ring-event:house-war': `${RING_EVENT_INTRO} In a House War the challengers split into two houses, and the last house standing wins together.`,
  'ring-event:the-reckoning': `${RING_EVENT_INTRO} In The Reckoning the bosses go after the challenger with the most XP.`,
  ambush:
    'An ambush brings one boss more than usual. It is a lesser minion and starts with a third of its health.',
  'boss-rivals':
    'When bosses outnumber the challengers, they fight each other as well as your monsters.',
  'boss-temperament':
    "Every boss has a temperament that decides which challenger it goes after. The line above says this one's.",
};

/** Which feed is asking; the claim is per feed so one event is not explained twice. */
export type MechanicSurface = 'ring' | 'console';

/** The mechanic key a line's payload carries, if it has a note. */
export function mechanicKeyOf(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const { ringEvent, mechanic } = payload as { ringEvent?: { id?: unknown }; mechanic?: unknown };
  const key =
    typeof ringEvent?.id === 'string'
      ? `ring-event:${ringEvent.id}`
      : typeof mechanic === 'string'
        ? mechanic
        : undefined;
  return key && Object.hasOwn(MECHANIC_NOTES, key) ? key : undefined;
}

/**
 * The part of a payload the notes need, for feeds that keep a slimmed-down row.
 * Undefined for an ordinary line, so untagged rows stay untouched.
 */
export function mechanicPayloadOf(payload: unknown): Record<string, unknown> | undefined {
  const key = mechanicKeyOf(payload);
  if (!key) return undefined;
  return key.startsWith('ring-event:')
    ? { ringEvent: { id: key.slice('ring-event:'.length) } }
    : { mechanic: key };
}

const storageKey = (userId?: string) => (userId ? `mechanicsExplained:${userId}` : 'mechanicsExplained');

function readExplained(userId?: string): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeExplained(userId: string | undefined, explained: Set<string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(storageKey(userId), JSON.stringify([...explained]));
  } catch {
    // Storage blocked or full: the in-memory claim still keeps the session to one note.
  }
}

/** Session claims, by player then key: who owns the note this session. */
const claims = new Map<string, Map<string, string>>();

/**
 * The note to show under this line, or undefined. Safe to call on every render of the
 * row: the same row keeps getting its note; any other row for the same key gets none.
 */
export function mechanicNoteFor(
  userId: string | undefined,
  surface: MechanicSurface,
  eventId: string,
  payload: unknown,
  mayClaim = true,
): string | undefined {
  const key = mechanicKeyOf(payload);
  if (!key) return undefined;
  const owner = `${surface}:${eventId}`;
  const playerClaims = claims.get(userId ?? '') ?? new Map<string, string>();
  claims.set(userId ?? '', playerClaims);

  const claimed = playerClaims.get(key);
  if (claimed !== undefined) return claimed === owner ? MECHANIC_NOTES[key] : undefined;

  // Only the newest row for a key may claim. The feeds mount their list at index 0 and
  // snap to the last row a frame later, so old rows are drawn transiently; if they could
  // claim, they would persist the key as explained before the player ever saw a note.
  if (!mayClaim) return undefined;
  const explained = readExplained(userId);
  if (explained.has(key)) return undefined;
  playerClaims.set(key, owner);
  explained.add(key);
  writeExplained(userId, explained);
  return MECHANIC_NOTES[key];
}

/** For each mechanic key in a feed, the id of its newest row (the only one allowed to claim). */
export function newestEventIdByKey(
  events: ReadonlyArray<{ id?: string; payload?: unknown }>,
): Map<string, string> {
  const newest = new Map<string, string>();
  for (const event of events) {
    const key = mechanicKeyOf(event.payload);
    if (key && event.id) newest.set(key, event.id);
  }
  return newest;
}

/** Test seam: forget this session's claims (storage is the test's to clear). */
export function resetMechanicClaimsForTests(): void {
  claims.clear();
}
