import type { ChatMessage } from '@deck-monsters/server/types';

/**
 * Turns the room's chat messages into the rows the Chat tab draws: the messages themselves
 * plus the dividers between them (roadmap 41, M3). Pure, so the rules are tested without a
 * DOM, and the clock is passed in.
 */

/** A gap this long between two messages earns a time divider. */
export const TIME_DIVIDER_GAP_MS = 30 * 60 * 1000;

export type ChatRow =
  | { kind: 'time'; key: string; label: string }
  | { kind: 'fight'; key: string; label: string }
  | { kind: 'marker'; key: string; label: string }
  | { kind: 'message'; key: string; message: ChatMessage };

export const NEW_SINCE_LABEL = 'New since you were last here';

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function sameLocalDay(a: Date, b: Date): boolean {
  return startOfDay(a) === startOfDay(b);
}

const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

/**
 * `Today, 6:42 PM`, `Yesterday, 9:10 PM`, or `Mon 28 Sep, 9:10 PM`, in the viewer's locale.
 * The locale APIs order and punctuate the pieces, so other locales read natively; the year
 * is added only for a message from another year.
 */
export function formatTimeDivider(when: Date, now: Date): string {
  const time = when.toLocaleTimeString([], TIME_FORMAT);
  if (sameLocalDay(when, now)) return `Today, ${time}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameLocalDay(when, yesterday)) return `Yesterday, ${time}`;
  return when.toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(when.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const }),
    ...TIME_FORMAT,
  });
}

/**
 * @param openedAtReadId  the read position captured when the panel was opened, NOT the live
 *   one (which moves as the player reads, and would make the marker jump). The marker goes
 *   before the first message after it that someone else sent; none when nothing was read yet
 *   (everything would be "new", which says nothing) or nothing newer has arrived.
 */
export function buildChatRows(
  messages: ChatMessage[],
  options: { openedAtReadId: number | null; myUserId: string | undefined; now: Date },
): ChatRow[] {
  const { openedAtReadId, myUserId, now } = options;
  const rows: ChatRow[] = [];
  let markerPlaced = openedAtReadId === null || openedAtReadId <= 0;
  let previous: ChatMessage | undefined;

  for (const message of messages) {
    const when = new Date(message.createdAt);
    const prevWhen = previous ? new Date(previous.createdAt) : undefined;
    if (
      !prevWhen ||
      when.getTime() - prevWhen.getTime() >= TIME_DIVIDER_GAP_MS ||
      !sameLocalDay(when, prevWhen)
    ) {
      rows.push({ kind: 'time', key: `time-${message.id}`, label: formatTimeDivider(when, now) });
    }
    if (message.fightNumber !== null && message.fightNumber !== previous?.fightNumber) {
      rows.push({ kind: 'fight', key: `fight-${message.id}`, label: `During fight #${message.fightNumber}` });
    }
    if (!markerPlaced && message.id > (openedAtReadId ?? 0) && message.senderUserId !== myUserId) {
      rows.push({ kind: 'marker', key: `marker-${message.id}`, label: NEW_SINCE_LABEL });
      markerPlaced = true;
    }
    rows.push({ kind: 'message', key: `message-${message.id}`, message });
    previous = message;
  }
  return rows;
}

/** The tab badge text: the count, capped, and nothing at zero. */
export function unreadBadgeText(unread: number): string | null {
  if (unread <= 0) return null;
  return unread > 99 ? '99+' : String(unread);
}
