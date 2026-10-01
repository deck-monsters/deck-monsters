import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@deck-monsters/server/types';
import { buildChatRows, formatTimeDivider, unreadBadgeText } from '../utils/chat-rows.js';

const NOW = new Date(2026, 9, 1, 18, 50); // Thu 1 Oct 2026, 6:50 PM local
const at = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m).toISOString();
function msg(id: number, createdAt: string, o: Partial<ChatMessage> = {}): ChatMessage {
  return { id, roomId: 'r', senderUserId: 'ben', senderName: 'Ben', recipientUserId: null, recipientName: null, text: `m${id}`, fightNumber: null, source: 'web', createdAt, ...o };
}
const kinds = (rows: ReturnType<typeof buildChatRows>) => rows.map((r) => r.kind);
const opts = { openedAtReadId: null, myUserId: 'me', now: NOW };

describe('buildChatRows', () => {
  it('puts a time divider before the first message, none within 30 minutes', () => {
    const rows = buildChatRows([msg(1, at(1, 18, 0)), msg(2, at(1, 18, 29))], opts);
    expect(kinds(rows)).toEqual(['time', 'message', 'message']);
  });

  it('adds one at a gap of 30 minutes or more', () => {
    const rows = buildChatRows([msg(1, at(1, 17, 0)), msg(2, at(1, 17, 30))], opts);
    expect(kinds(rows)).toEqual(['time', 'message', 'time', 'message']);
  });

  it('adds one when the local day changes, even within 30 minutes', () => {
    const rows = buildChatRows([msg(1, at(1, 0, 10)), msg(2, new Date(2026, 8, 30, 23, 55).toISOString())].reverse(), opts);
    expect(kinds(rows)).toEqual(['time', 'message', 'time', 'message']);
  });

  it('labels Today, Yesterday and older days', () => {
    expect(formatTimeDivider(new Date(2026, 9, 1, 18, 42), NOW)).toMatch(/^Today, /);
    expect(formatTimeDivider(new Date(2026, 8, 30, 21, 10), NOW)).toMatch(/^Yesterday, /);
    const older = formatTimeDivider(new Date(2026, 8, 28, 21, 10), NOW);
    expect(older).not.toMatch(/Today|Yesterday/);
    expect(older).toContain('28');
  });

  it('adds a fight divider when the fight number changes, not when null', () => {
    const rows = buildChatRows(
      [msg(1, at(1, 18, 0), { fightNumber: 12 }), msg(2, at(1, 18, 1), { fightNumber: 12 }), msg(3, at(1, 18, 2), { fightNumber: 13 }), msg(4, at(1, 18, 3))],
      opts,
    );
    expect(rows.filter((r) => r.kind === 'fight').map((r) => (r as { label: string }).label)).toEqual(['During fight #12', 'During fight #13']);
  });

  it('places the marker before the first later message from someone else, from the captured id', () => {
    const list = [msg(1, at(1, 18, 0)), msg(2, at(1, 18, 1)), msg(3, at(1, 18, 2), { senderUserId: 'me' }), msg(4, at(1, 18, 3))];
    const rows = buildChatRows(list, { ...opts, openedAtReadId: 2 });
    const idx = rows.findIndex((r) => r.kind === 'marker');
    const next = rows[idx + 1]!;
    expect(next.kind === 'message' && next.message.id).toBe(4);
    expect(rows.filter((r) => r.kind === 'marker')).toHaveLength(1);
  });

  it('has no marker when nothing was read yet or nothing is newer', () => {
    const list = [msg(1, at(1, 18, 0))];
    expect(kinds(buildChatRows(list, { ...opts, openedAtReadId: 0 }))).not.toContain('marker');
    expect(kinds(buildChatRows(list, { ...opts, openedAtReadId: 1 }))).not.toContain('marker');
  });
});

describe('unreadBadgeText', () => {
  it('hides at 0, shows the count, caps at 99+', () => {
    expect(unreadBadgeText(0)).toBeNull();
    expect(unreadBadgeText(7)).toBe('7');
    expect(unreadBadgeText(99)).toBe('99');
    expect(unreadBadgeText(100)).toBe('99+');
  });
});
