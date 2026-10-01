import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ChatMessage, ChatPlayer } from '@deck-monsters/server/types';
import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';

/**
 * Room chat in the Console (roadmap 41, M2): live chat lines, the unread line, chat typed
 * while a question is open, and the `dm` preview and picked-name path.
 */

const ME = 'user-1';
const ROOM = '11111111-1111-1111-1111-111111111111';
const listeners = new Set<(tracked: TrackedRingFeedEvent) => void>();

const mocks = vi.hoisted(() => ({
  command: vi.fn(async (_input: unknown): Promise<unknown> => ({ ok: true })),
  respond: vi.fn(async () => ({ ok: true })),
  send: vi.fn(async (): Promise<string | null> => null),
  chat: {
    messages: [] as unknown[],
    unread: 0,
    members: [] as unknown[],
    dmCandidates: [] as unknown[],
    live: new Set<(m: unknown) => void>(),
  },
  contestants: [] as Array<{ userId: string | null }>,
}));

vi.mock('react-virtuoso', () => {
  const React = require('react');
  const Virtuoso = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ scrollToIndex: () => undefined }));
    return (
      <div>
        {props.data?.map((ev: any, i: number) => (
          <React.Fragment key={ev.id ?? i}>{props.itemContent(i, ev)}</React.Fragment>
        ))}
      </div>
    );
  });
  return { Virtuoso };
});

vi.mock('../lib/auth-context.js', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('../lib/command-insert-context.js', () => ({
  useCommandInsert: () => ({ registerInsertFn: () => undefined }),
}));
vi.mock('../hooks/useCommandAutocomplete.js', () => ({ useCommandAutocomplete: () => [] }));
vi.mock('../components/InlineChoices.js', () => ({
  default: ({ question }: { question: string }) => <div>{question}</div>,
}));
vi.mock('../hooks/useChat.js', () => ({
  useChat: () => ({
    messages: mocks.chat.messages,
    unread: mocks.chat.unread,
    lastReadId: 0,
    markRead: () => undefined,
    send: mocks.send,
    members: mocks.chat.members,
    dmCandidates: mocks.chat.dmCandidates,
    subscribeLive: (listener: (m: unknown) => void) => {
      mocks.chat.live.add(listener);
      return () => mocks.chat.live.delete(listener);
    },
  }),
}));
vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      consoleHistory: { useQuery: () => ({ data: [] }) },
      pendingPrompt: { useQuery: () => ({ data: null, dataUpdatedAt: 0, refetch: vi.fn() }) },
      ringState: { useQuery: () => ({ data: { contestants: mocks.contestants } }) },
      myMonsters: { useQuery: () => ({ data: [], refetch: vi.fn(async () => ({ data: [] })) }) },
      myInventory: {
        useQuery: () => ({
          data: { items: { character: [], monsters: [] } },
          refetch: vi.fn(async () => ({ data: { items: { character: [], monsters: [] } } })),
        }),
      },
      command: { useMutation: () => ({ mutateAsync: mocks.command }) },
      respondToPrompt: { useMutation: () => ({ mutateAsync: mocks.respond }) },
      cancelPrompt: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
      cancelFlow: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
    },
  },
}));
vi.mock('../utils/format-event-text.js', () => ({ formatEventText: (text: string) => text }));
vi.mock('../utils/console-history-event-map.js', () => ({ mapConsoleHistoryEvent: () => null }));

import ConsolePane from '../components/ConsolePane.js';
import { resetGuidedStartForTests } from '../hooks/useGuidedStart.js';

function TestFeed({ children }: { children: ReactNode }) {
  const value: RingFeedApi = {
    connected: true,
    reconnecting: false,
    seedCursor: () => undefined,
    subscribeChat: () => () => undefined,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return <RingFeedContext.Provider value={value}>{children}</RingFeedContext.Provider>;
}

const players: ChatPlayer[] = [
  { userId: 'ant', name: 'Anthony' },
  { userId: 'bou', name: 'Anthony Bourdain' },
  { userId: 'cal', name: 'Cal' },
];

function message(id: number, o: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    roomId: ROOM,
    senderUserId: 'cal',
    senderName: 'Cal',
    recipientUserId: null,
    recipientName: null,
    text: 'hello',
    fightNumber: null,
    source: 'web',
    createdAt: '2026-10-01T00:00:00.000Z',
    ...o,
  };
}

function pushLive(m: ChatMessage) {
  act(() => {
    for (const listener of mocks.chat.live) listener(m);
  });
}

function renderConsole() {
  return render(
    <TestFeed>
      <ConsolePane roomId={ROOM} isActive />
    </TestFeed>,
  );
}

const input = () => screen.getByLabelText('Type a command or answer') as HTMLInputElement;

function type(value: string) {
  fireEvent.change(input(), { target: { value } });
}

async function submit() {
  await act(async () => {
    fireEvent.submit(input().closest('form')!);
  });
}

let promptSeq = 0;
function openPrompt() {
  promptSeq += 1;
  const n = promptSeq;
  act(() => {
    for (const listener of listeners) {
      listener({
        id: `prompt-${n}`,
        data: {
          id: `prompt-${n}`,
          type: 'prompt.request',
          scope: 'private',
          targetUserId: ME,
          text: 'Which card?',
          payload: { requestId: `req-${n}`, question: 'Which card?', choices: ['Hit'] },
          timestamp: Date.now(),
          roomId: ROOM,
        },
      });
    }
  });
}

beforeEach(() => {
  localStorage.clear();
  resetGuidedStartForTests();
  listeners.clear();
  mocks.command.mockReset();
  mocks.command.mockImplementation(async () => ({ ok: true }));
  mocks.respond.mockReset();
  mocks.send.mockReset();
  mocks.send.mockImplementation(async () => null);
  mocks.chat.messages = [];
  mocks.chat.unread = 0;
  mocks.chat.members = players;
  mocks.chat.dmCandidates = [];
  mocks.chat.live.clear();
  mocks.contestants = [];
});

describe('Console chat lines', () => {
  it('shows live chat in the four plan formats, once each, and styled as chat', () => {
    renderConsole();
    pushLive(message(1, { senderName: 'Cal', text: 'nice hit' }));
    pushLive(message(2, { senderUserId: ME, senderName: 'Me', text: 'thanks' }));
    pushLive(message(3, { senderName: 'Cal', recipientUserId: ME, recipientName: 'Me', text: 'psst' }));
    pushLive(message(4, { senderUserId: ME, senderName: 'Me', recipientUserId: 'cal', recipientName: 'Cal', text: 'shh' }));
    // Our own send is announced directly and again by its frame: one line.
    pushLive(message(2, { senderUserId: ME, senderName: 'Me', text: 'thanks' }));

    for (const line of ['💬 Cal: nice hit', '💬 You: thanks', '✉️ Cal to you: psst', '✉️ You to Cal: shh']) {
      expect(screen.getAllByText(line)).toHaveLength(1);
    }
    expect(screen.getByText('💬 Cal: nice hit').closest('li')).toHaveClass('console-chat');
  });

  it('does not replay the backlog into the Console', () => {
    mocks.chat.messages = [message(1, { text: 'old news' })];
    renderConsole();
    expect(screen.queryByText(/old news/)).toBeNull();
  });
});

describe('Console unread line', () => {
  it('says how many new messages are waiting, pluralised, once', () => {
    mocks.chat.unread = 3;
    const view = renderConsole();
    expect(screen.getAllByText('💬 3 new messages in Chat.')).toHaveLength(1);
    mocks.chat.unread = 4;
    view.rerender(
      <TestFeed>
        <ConsolePane roomId={ROOM} isActive />
      </TestFeed>,
    );
    expect(screen.queryByText(/4 new/)).toBeNull();
  });

  it('uses the singular, and says nothing with no unread chat', () => {
    mocks.chat.unread = 1;
    renderConsole();
    expect(screen.getByText('💬 1 new message in Chat.')).toBeInTheDocument();
  });

  it('says nothing when nothing is unread', () => {
    renderConsole();
    expect(screen.queryByText(/in Chat\./)).toBeNull();
  });
});

describe('chat while a question is open', () => {
  it('sends a chat line to game.command, not the answer, and leaves the question open', async () => {
    renderConsole();
    openPrompt();
    expect(screen.getByPlaceholderText('Type your answer or click a choice above…')).toBeInTheDocument();

    type('msg anyone got a spare potion?');
    await submit();

    expect(mocks.command).toHaveBeenCalledWith(expect.objectContaining({ roomId: ROOM, command: 'msg anyone got a spare potion?' }));
    expect(mocks.respond).not.toHaveBeenCalled();
    // The prompt is still open, and the typed line was not echoed as console input.
    expect(screen.getByPlaceholderText('Type your answer or click a choice above…')).toBeInTheDocument();
    expect(screen.queryByText('msg anyone got a spare potion?')).toBeNull();
  });

  it('still answers the question with m, M Jones, or a bare msg', async () => {
    renderConsole();
    openPrompt();
    for (const answer of ['m', 'M Jones', 'msg']) {
      mocks.respond.mockClear();
      type(answer);
      await submit();
      expect(mocks.respond, answer).toHaveBeenCalledWith(expect.objectContaining({ roomId: ROOM, answer }));
      openPrompt();
    }
    expect(mocks.command).not.toHaveBeenCalled();
  });

  it('outside a question, m works as chat', async () => {
    renderConsole();
    type('m hello');
    await submit();
    expect(mocks.command).toHaveBeenCalledWith(expect.objectContaining({ command: 'm hello' }));
  });

  it('shows a chat refusal the way a failed command shows', async () => {
    mocks.command.mockImplementation(async () => ({ ok: false, message: 'Say something after msg, like: msg nice hit, Fang!' }));
    renderConsole();
    type('msg');
    await submit();
    expect(screen.getByText('! Say something after msg, like: msg nice hit, Fang!')).toBeInTheDocument();
  });
});

describe('the dm preview and picked names', () => {
  it('previews Anthony Bourdain and warns that Anthony is here too', () => {
    renderConsole();
    type('dm Anthony Bourdain is too powerful');
    const name = screen.getByText('Anthony Bourdain', { selector: '.dm-preview-name' });
    expect(name).toBeInTheDocument();
    const preview = name.closest('.dm-preview')!;
    expect(preview.textContent).toBe(
      'To: Anthony Bourdain. Anthony is in this room too. Pick a name from the list to be sure.',
    );
    expect(preview.parentElement).toHaveAttribute('aria-live', 'polite');
  });

  it('says so when no one matches, and shows nothing for other input', () => {
    renderConsole();
    type('dm Nob');
    expect(screen.getByText('No player here by that name yet.')).toBeInTheDocument();
    type('msg hello');
    expect(document.querySelector('.dm-preview')).toBeNull();
  });

  it('picking Anthony from the list sends to his id with the rest as the message', async () => {
    renderConsole();
    type('dm Anth');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent).slice(0, 2)).toEqual(['Anthony', 'Anthony Bourdain']);
    fireEvent.mouseDown(options[0]!);
    expect(input().value).toBe('dm Anthony ');
    // The picked player, exactly: no warning.
    expect(document.querySelector('.dm-preview')!.textContent).toBe('To: Anthony');

    type('dm Anthony Bourdain is too powerful');
    await submit();

    expect(mocks.send).toHaveBeenCalledWith('Bourdain is too powerful', 'ant');
    expect(mocks.command).not.toHaveBeenCalled();
    expect(input().value).toBe('');
  });

  it('editing the picked name forgets the id and falls back to the typed path', async () => {
    renderConsole();
    type('dm Anth');
    fireEvent.mouseDown(screen.getAllByRole('option')[0]!);
    type('dm Anthon');
    type('dm Anthony Bourdain is too powerful');
    // Preview is back to the typed match, with its warning.
    expect(document.querySelector('.dm-preview')!.textContent).toContain('Anthony is in this room too');
    await submit();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.command).toHaveBeenCalledWith(expect.objectContaining({ command: 'dm Anthony Bourdain is too powerful' }));
  });

  it('a typed dm goes to game.command, quotes included', async () => {
    renderConsole();
    type('dm "Anthony" Bourdain is too powerful');
    await submit();
    expect(mocks.command).toHaveBeenCalledWith(expect.objectContaining({ command: 'dm "Anthony" Bourdain is too powerful' }));
  });

  it('a picked name with no message goes to the server for its refusal text', async () => {
    renderConsole();
    type('dm Cal');
    fireEvent.mouseDown(screen.getAllByRole('option')[0]!);
    await submit();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.command).toHaveBeenCalledWith(expect.objectContaining({ command: 'dm Cal ' }));
  });

  it('shows a refusal from a picked send', async () => {
    mocks.send.mockImplementation(async () => "That player isn't in this room any more.");
    renderConsole();
    type('dm Cal');
    fireEvent.mouseDown(screen.getAllByRole('option')[0]!);
    type('dm Cal good luck');
    await submit();
    expect(screen.getByText("! That player isn't in this room any more.")).toBeInTheDocument();
  });

  it('orders the list: last DM partner, then the ring, then A to Z', () => {
    mocks.chat.members = [
      { userId: 'ant', name: 'Anthony' },
      { userId: 'cal', name: 'Cal' },
      { userId: 'dee', name: 'Dee' },
      { userId: 'eve', name: 'Eve' },
    ];
    mocks.chat.messages = [message(5, { senderUserId: ME, recipientUserId: 'eve', recipientName: 'Eve' })];
    mocks.contestants = [{ userId: 'dee' }, { userId: null }];
    renderConsole();
    type('dm ');
    expect(screen.getAllByRole('option').map((o) => o.textContent).slice(0, 4)).toEqual(['Eve', 'Dee', 'Anthony', 'Cal']);
  });
});

describe('previews like the server, and keeps a refused message', () => {
  it('previews a leading-space dm, and an account-name match, and yourself', () => {
    mocks.chat.dmCandidates = [
      { userId: ME, name: 'Mo', match: 'Mo' },
      { userId: 'ben', name: 'Anthony Bourdain', match: 'Anthony Bourdain' },
      { userId: 'ben', name: 'Anthony Bourdain', match: 'Ben' },
    ];
    renderConsole();
    type('  dm Ben hi');
    expect(document.querySelector('.dm-preview')!.textContent).toBe('To: Anthony Bourdain');
    type('dm Mo hi');
    expect(document.querySelector('.dm-preview')!.textContent).toBe("That's you. Pick someone else.");
    type('dm ');
    expect(document.querySelector('.dm-preview')!.textContent).toBe(
      "Type dm, a player's name, and your message, like: dm Ada good luck.",
    );
  });

  it('puts a refused message back in the input, unless something newer was typed', async () => {
    mocks.command.mockImplementation(async () => ({ ok: false, message: 'Easy there. Wait a few seconds before the next message.' }));
    renderConsole();
    type('msg first try');
    await submit();
    expect(input().value).toBe('msg first try');
    expect(screen.getByText('! Easy there. Wait a few seconds before the next message.')).toBeInTheDocument();

    // Something newer typed while the send was in flight wins over the refused text.
    mocks.command.mockImplementation(async () => {
      type('msg newer draft');
      return { ok: false, message: 'nope' };
    });
    type('msg second try');
    await submit();
    expect(input().value).toBe('msg newer draft');
  });

  it('puts a refused picked DM back with its pick', async () => {
    mocks.send.mockImplementation(async () => "That player isn't in this room any more.");
    renderConsole();
    type('dm Cal');
    fireEvent.mouseDown(screen.getAllByRole('option')[0]!);
    type('dm Cal good luck');
    await submit();
    expect(input().value).toBe('dm Cal good luck');
    expect(document.querySelector('.dm-preview')!.textContent).toBe('To: Cal');
  });
});
