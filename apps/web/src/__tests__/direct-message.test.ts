import { describe, expect, it } from 'vitest';
import type { ChatMessage, ChatPlayer } from '@deck-monsters/server/types';
import {
  chatLineText,
  dmCandidatesOf,
  dmRest,
  dmPreviewText,
  isChatLine,
  orderDmSuggestions,
  resolveDmTarget,
  stillPicked,
  unreadChatLine,
} from '../lib/direct-message.js';

const ME = 'me';
const players: ChatPlayer[] = [
  { userId: 'ant', name: 'Anthony' },
  { userId: 'bou', name: 'Anthony Bourdain' },
  { userId: 'cal', name: 'Cal' },
  { userId: 'dee', name: 'Dee' },
  { userId: 'eve', name: 'Eve' },
  { userId: 'fay', name: 'Fay' },
];

function dm(id: number, from: string, to: string): ChatMessage {
  return {
    id,
    roomId: 'room',
    senderUserId: from,
    senderName: from,
    recipientUserId: to,
    recipientName: to,
    text: 'psst',
    fightNumber: null,
    source: 'web',
    createdAt: '2026-10-01T00:00:00.000Z',
  };
}

const cands = dmCandidatesOf(undefined, players);
const names = (list: Array<{ label: string }>) => list.map((s) => s.label);

describe('chatLineText', () => {
  const base = dm(1, 'u-ada', ME);
  it('uses the four plan formats', () => {
    expect(chatLineText({ ...base, recipientUserId: null, recipientName: null, senderName: 'Ada', text: 'hi' }, ME)).toBe('💬 Ada: hi');
    expect(chatLineText({ ...base, senderUserId: ME, recipientUserId: null, recipientName: null, text: 'hi' }, ME)).toBe('💬 You: hi');
    expect(chatLineText({ ...base, senderName: 'Ada', text: 'hi' }, ME)).toBe('✉️ Ada to you: hi');
    expect(chatLineText({ ...base, senderUserId: ME, recipientName: 'Ben', text: 'hi' }, ME)).toBe('✉️ You to Ben: hi');
  });
  it('pluralises the unread line', () => {
    expect(unreadChatLine(1)).toBe('💬 1 new message in Chat.');
    expect(unreadChatLine(3)).toBe('💬 3 new messages in Chat.');
  });
});

describe('isChatLine', () => {
  it('matches the chat words, any case, and nothing that merely starts with them', () => {
    for (const line of ['msg hi', 'Message hi', 'm hi', 'DM Ada hi', 'msg', 'm', 'dm']) {
      expect(isChatLine(line, false), line).toBe(true);
    }
    for (const line of ['mm hi', 'dmx', 'message-board', 'look at monsters', 'dismiss Fluffy']) {
      expect(isChatLine(line, false), line).toBe(false);
    }
  });
  it('while a question is open, only msg, message and dm with text go to chat; m stays an answer', () => {
    for (const line of ['m', 'msg', 'message', 'dm', 'm hello', 'M Jones', 'dm ', 'msg   ']) {
      expect(isChatLine(line, true), line).toBe(false);
    }
    for (const line of ['msg hello', 'Message hello', 'dm Ada hi', '  msg hi']) {
      expect(isChatLine(line, true), line).toBe(true);
    }
    // And outside a question the one-letter form works.
    expect(isChatLine('m hello', false)).toBe(true);
  });
});

describe('resolveDmTarget and the preview', () => {
  it('previews Anthony Bourdain for "dm Anthony Bourdain is too powerful" and warns Anthony fits too', () => {
    const target = resolveDmTarget('dm Anthony Bourdain is too powerful', cands, null);
    expect(target).toMatchObject({ kind: 'player', userId: 'bou', name: 'Anthony Bourdain', message: 'is too powerful', picked: false });
    expect(dmPreviewText(target)).toEqual({
      lead: 'To: ',
      name: 'Anthony Bourdain',
      tail: '. Anthony is in this room too. Pick a name from the list to be sure.',
    });
  });

  it('shows a plain To: line when nobody else fits', () => {
    expect(dmPreviewText(resolveDmTarget('dm Cal good luck', cands, null))).toEqual({ lead: 'To: ', name: 'Cal', tail: '' });
  });

  it('names several other players joined with "and"', () => {
    const crowd: ChatPlayer[] = [
      { userId: 'a', name: 'Sam' },
      { userId: 'b', name: 'Sam Spade' },
      { userId: 'c', name: 'Sam Spade Jr' },
    ];
    const text = dmPreviewText(resolveDmTarget('dm Sam Spade Jr hi', dmCandidatesOf(undefined, crowd), null));
    expect(text?.tail).toBe('. Sam and Sam Spade are in this room too. Pick a name from the list to be sure.');
  });

  it('says so when no name matches, and is silent for lines that are not dm', () => {
    expect(dmPreviewText(resolveDmTarget('dm Nob', cands, null))).toEqual({ lead: 'No player here by that name yet.', name: null, tail: '' });
    expect(dmPreviewText(resolveDmTarget('dm ', cands, null))?.lead).toBe(
      "Type dm, a player's name, and your message, like: dm Ada good luck.",
    );
    expect(dmPreviewText(resolveDmTarget('msg hello', cands, null))).toBeNull();
    expect(dmPreviewText(resolveDmTarget('dmx hello', cands, null))).toBeNull();
  });

  it('quotes route to Anthony and show no warning', () => {
    const target = resolveDmTarget('dm "Anthony" Bourdain is too powerful', cands, null);
    expect(target).toMatchObject({ kind: 'player', userId: 'ant', message: 'Bourdain is too powerful', alsoFits: [] });
  });

  it('a picked player wins while the name is exactly as inserted, then is forgotten when edited', () => {
    const picked = { userId: 'ant', name: 'Anthony' };
    const target = resolveDmTarget('dm Anthony Bourdain is too powerful', cands, picked);
    expect(target).toMatchObject({ kind: 'player', userId: 'ant', picked: true, message: 'Bourdain is too powerful', alsoFits: [] });
    expect(stillPicked('dm Anthony Bourdain is too powerful', picked)).toBe(true);
    expect(stillPicked('dm Anthon', picked)).toBe(false);
    expect(stillPicked('dm anthony hi', picked)).toBe(false);
    // Edited: back to the typed path, which takes the longest name.
    expect(resolveDmTarget('dm Anthonyx hi', cands, picked).kind).toBe('nomatch');
  });
});

describe('preview parity with the server', () => {
  const server = [
    { userId: 'ada', name: 'Ada', match: 'Ada' },
    { userId: 'me', name: 'Mo', match: 'Mo' },
    { userId: 'me', name: 'Mo', match: 'mo@account' },
    { userId: 'ben', name: 'Anthony Bourdain', match: 'Anthony Bourdain' },
    { userId: 'ben', name: 'Anthony Bourdain', match: 'Ben' },
  ];

  it('matches an account display name, as the server does', () => {
    expect(resolveDmTarget('dm Ben hi', server, null, 'me')).toMatchObject({ kind: 'player', userId: 'ben', name: 'Anthony Bourdain', message: 'hi' });
  });

  it('previews yourself the way the server refuses it', () => {
    const target = resolveDmTarget('dm Mo hi', server, null, 'me');
    expect(target.kind).toBe('self');
    expect(dmPreviewText(target)?.lead).toBe("That's you. Pick someone else.");
    expect(resolveDmTarget('dm mo@account', server, null, 'me').kind).toBe('self');
  });

  it('refuses identical names with the server line, but a pick still works', () => {
    const twins = [
      { userId: 'a', name: 'Sam', match: 'Sam' },
      { userId: 'b', name: 'Sam', match: 'Sam' },
    ];
    const target = resolveDmTarget('dm Sam hello', twins, null, 'me');
    expect(target).toEqual({ kind: 'ambiguous', name: 'Sam' });
    expect(dmPreviewText(target)?.lead).toBe('Two players here go by Sam. Pick one from the list.');
    expect(resolveDmTarget('dm Sam hello', twins, { userId: 'b', name: 'Sam' }, 'me')).toMatchObject({ kind: 'player', userId: 'b', picked: true });
  });

  it('ignores leading whitespace, so a stray space cannot hide the preview', () => {
    expect(dmRest('  dm Ada hi')).toBe('Ada hi');
    expect(dmRest('\u00A0dm Ada hi')).toBe('Ada hi');
    expect(dmPreviewText(resolveDmTarget('  dm Anthony Bourdain hi', cands, null))?.name).toBe('Anthony Bourdain');
    expect(stillPicked('  dm Anthony hi', { userId: 'ant', name: 'Anthony' })).toBe(true);
    expect(resolveDmTarget('   dm Anthony hi', cands, { userId: 'ant', name: 'Anthony' })).toMatchObject({ picked: true, userId: 'ant' });
  });
});

describe('orderDmSuggestions', () => {
  const run = (messages: ChatMessage[], ringUserIds: string[], query = '') =>
    names(orderDmSuggestions({ members: players, messages, myUserId: ME, ringUserIds, query }));

  it('lists the last DM you sent, then who last DMed you, then the ring, then everyone alphabetically', () => {
    const messages = [dm(1, ME, 'eve'), dm(2, ME, 'fay'), dm(3, 'cal', ME), dm(4, 'dee', ME), dm(5, ME, 'ant')];
    // sent: Anthony (id 5). received: Dee (id 4). ring: Cal and Fay. then the rest A-Z.
    expect(run(messages, ['fay', 'cal', 'ant'])).toEqual(['Anthony', 'Dee', 'Cal', 'Fay', 'Anthony Bourdain', 'Eve']);
  });

  it('lists a player once, first, when they were both the last you sent to and the last to send to you', () => {
    const messages = [dm(1, 'dee', ME), dm(2, ME, 'dee'), dm(3, 'eve', ME)];
    // sent -> Dee; received -> Eve (id 3 is newest received, a different person).
    expect(run(messages, [])).toEqual(['Dee', 'Eve', 'Anthony', 'Anthony Bourdain', 'Cal', 'Fay']);
    const same = [dm(1, ME, 'dee'), dm(2, 'dee', ME)];
    expect(run(same, ['dee', 'cal'])).toEqual(['Dee', 'Cal', 'Anthony', 'Anthony Bourdain', 'Eve', 'Fay']);
  });

  it('puts ring players ahead of the alphabet when there is no DM history, ignoring room messages and unknown ids', () => {
    const room: ChatMessage = { ...dm(1, 'cal', ME), recipientUserId: null, recipientName: null };
    expect(run([room], ['eve', 'gone', null as unknown as string])).toEqual(['Eve', 'Anthony', 'Anthony Bourdain', 'Cal', 'Dee', 'Fay']);
  });

  it('typing narrows the list and keeps the order', () => {
    const messages = [dm(1, ME, 'bou')];
    expect(run(messages, [], 'anth')).toEqual(['Anthony Bourdain', 'Anthony']);
    expect(run(messages, [], 'bour')).toEqual(['Anthony Bourdain']);
    expect(run(messages, [], 'Anthony Bourdain is too powerful')).toEqual([]);
    expect(run(messages, [], 'zzz')).toEqual([]);
  });

  it('inserts "dm {name} " and carries the user id', () => {
    const [first] = orderDmSuggestions({ members: players, messages: [], myUserId: ME, ringUserIds: [], query: 'cal' });
    expect(first).toEqual({ label: 'Cal', insertValue: 'dm Cal ', userId: 'cal' });
  });
});
