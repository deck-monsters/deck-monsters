import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';

const scrollToIndexMock = vi.fn();
let restoreRaf: (() => void) | null = null;
const listeners = new Set<(tracked: TrackedRingFeedEvent) => void>();
type PendingPromptSnapshot = {
  requestId: string;
  question: string;
  choices: string[];
  timeoutSeconds?: number;
};

const trpcMocks = vi.hoisted(() => ({
  pendingPromptQuery: {
    data: null as null | PendingPromptSnapshot,
    dataUpdatedAt: 0,
    isFetching: false,
    refetch: vi.fn(async (): Promise<{ data: PendingPromptSnapshot | null; status?: string }> => ({ data: null, status: 'success' })),
  },
  respondToPromptMutateAsync: vi.fn(async (_v?: unknown) => ({ ok: true })),
  commandMutateAsync: vi.fn(async (_v?: unknown) => ({ ok: true })),
}));

function pushEvent(tracked: TrackedRingFeedEvent) {
  for (const listener of listeners) listener(tracked);
}

// Lets one test (the "not mounted" case) opt the mocked Virtuoso out of rendering
// rows, mirroring the existing scroll-behavior test file which never mounts rows.
let renderRows = true;

// Captured by the fake IntersectionObserver constructor below so tests can drive it.
let intersectionCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;

function setPromptIntersecting(isIntersecting: boolean) {
  act(() => {
    intersectionCallback?.([{ isIntersecting }]);
  });
}

vi.mock('react-virtuoso', () => {
  const React = require('react');

  const Virtuoso = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      scrollToIndex: scrollToIndexMock,
    }));

    latestFollowOutput = props.followOutput;

    return (
      <div>
        <div data-testid="event-count">{props.data?.length ?? 0}</div>
        {renderRows
          && props.data?.map((ev: any, i: number) => (
            <React.Fragment key={ev.id ?? i}>{props.itemContent(i, ev)}</React.Fragment>
          ))}
        <button type="button" onClick={() => props.atBottomStateChange?.(false)}>
          Mark not at bottom
        </button>
        <button type="button" onClick={() => props.atBottomStateChange?.(true)}>
          Mark at bottom
        </button>
      </div>
    );
  });

  return { Virtuoso };
});

let latestFollowOutput: ((atBottom: boolean) => unknown) | undefined;

vi.mock('../lib/auth-context.js', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../lib/command-insert-context.js', () => ({
  useCommandInsert: () => ({
    registerInsertFn: () => undefined,
  }),
}));

vi.mock('../hooks/useCommandAutocomplete.js', () => ({
  useCommandAutocomplete: () => [],
}));

vi.mock('../components/CommandSuggestions.js', () => ({
  default: () => null,
}));

// Chat has its own tests (useChat.test.tsx, consolePane-chat.test.tsx).
vi.mock('../hooks/useChat.js', () => ({
  useChat: () => ({
    messages: [],
    unread: 0,
    lastReadId: 0,
    markRead: () => undefined,
    send: async () => null,
    members: [],
    dmCandidates: [],
    refreshNames: () => undefined,
    subscribeLive: () => () => undefined,
  }),
}));

vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      consoleHistory: {
        useQuery: () => ({ data: [] }),
      },
      pendingPrompt: {
        useQuery: () => trpcMocks.pendingPromptQuery,
      },
      ringState: {
        useQuery: () => ({ data: undefined }),
      },
      myMonsters: {
        useQuery: () => ({ data: [], refetch: vi.fn(async () => ({ data: [] })) }),
      },
      myInventory: {
        useQuery: () => ({
          data: { items: { character: [], monsters: [] }, monsters: [] },
          refetch: vi.fn(async () => ({ data: { items: { character: [], monsters: [] } } })),
        }),
      },
      command: {
        useMutation: () => ({ mutateAsync: trpcMocks.commandMutateAsync }),
      },
      respondToPrompt: {
        useMutation: () => ({ mutateAsync: trpcMocks.respondToPromptMutateAsync }),
      },
      cancelPrompt: {
        useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }),
      },
      cancelFlow: {
        useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }),
      },
    },
  },
}));

vi.mock('../utils/format-event-text.js', () => ({
  formatEventText: (text: string) => text,
}));

vi.mock('../utils/console-history-event-map.js', () => ({
  mapConsoleHistoryEvent: () => null,
}));

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

const roomId = '11111111-1111-1111-1111-111111111111';

function pushPromptRequest(requestId = 'request-1') {
  act(() => {
    pushEvent({
      id: `prompt-request-${requestId}`,
      data: {
        id: `prompt-request-${requestId}`,
        type: 'prompt.request',
        scope: 'private',
        targetUserId: 'user-1',
        text: 'Which card?',
        payload: { requestId, question: 'Which card?', choices: ['Hit'] },
        timestamp: Date.now(),
        roomId,
      },
    });
  });
}


const NORMAL_PLACEHOLDER = /command/i;

function pushSystemEvent(id: string, type: string, payload: Record<string, unknown>) {
  act(() => {
    pushEvent({
      id,
      data: {
        id, type, scope: 'private', targetUserId: 'user-1', text: '', payload,
        timestamp: Date.now(), roomId,
      } as any,
    });
  });
}

function input() {
  return screen.getByLabelText('Type a command or answer') as HTMLInputElement;
}

function type(text: string) {
  fireEvent.change(input(), { target: { value: text } });
  fireEvent.submit(input().closest('form')!);
}

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

function expectPromptGone() {
  expect(input().placeholder).not.toMatch(/answer/i);
  expect(screen.queryByText(/Command suggestions are paused/)).toBeNull();
  // No live-looking choice buttons remain in the scroll.
  for (const b of screen.queryAllByTitle(/^Choose /)) expect(b).toBeDisabled();
  expect(screen.queryAllByTitle(/^Choose /).filter(b => !(b as HTMLButtonElement).disabled)).toHaveLength(0);
}

function tombstones() {
  return screen.queryAllByText(/Action cancelled\.|timed out/);
}

describe('ConsolePane: a finished question leaves the input (pass 43, I4)', () => {
  let view: ReturnType<typeof render>;
  const mount = () => {
    view = render(<TestFeed><ConsolePane roomId={roomId} isActive /></TestFeed>);
  };
  const cleanupMount = () => view.unmount();
  const rerender = () => view.rerender(<TestFeed><ConsolePane roomId={roomId} isActive /></TestFeed>);
  // A poll that is sent (isFetching true) and then lands with `data`.
  const poll = (data: PendingPromptSnapshot | null) => {
    trpcMocks.pendingPromptQuery.isFetching = true;
    rerender();
    trpcMocks.pendingPromptQuery.isFetching = false;
    trpcMocks.pendingPromptQuery.data = data;
    trpcMocks.pendingPromptQuery.dataUpdatedAt += 1;
    rerender();
  };
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  beforeEach(() => {
    localStorage.clear();
    resetGuidedStartForTests();
    renderRows = true;
    scrollToIndexMock.mockReset();
    listeners.clear();
    trpcMocks.pendingPromptQuery.data = null;
    trpcMocks.pendingPromptQuery.dataUpdatedAt = 0;
    trpcMocks.pendingPromptQuery.refetch.mockReset();
    trpcMocks.pendingPromptQuery.isFetching = false;
    trpcMocks.pendingPromptQuery.refetch.mockImplementation(async () => ({ data: null, status: 'success' }));
    trpcMocks.respondToPromptMutateAsync.mockReset();
    trpcMocks.respondToPromptMutateAsync.mockImplementation(async () => ({ ok: true }));
    trpcMocks.commandMutateAsync.mockReset();
    trpcMocks.commandMutateAsync.mockImplementation(async () => ({ ok: true }));
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => { cb(0); return 0; });
    (globalThis as any).IntersectionObserver = class {
      observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
    };
    mount();
    pushPromptRequest('r1');
    expect(input().placeholder).toMatch(/answer/i);
  });
  afterEach(() => { delete (globalThis as any).IntersectionObserver; vi.restoreAllMocks(); });

  async function expectNextLineIsCommand() {
    type('help');
    await flush();
    expect(trpcMocks.commandMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ command: 'help' }));
    expect(trpcMocks.respondToPromptMutateAsync).not.toHaveBeenCalled();
  }

  it('(a) timed out', async () => {
    pushSystemEvent('t1', 'prompt.timeout', { requestId: 'r1' });
    expectPromptGone();
    await expectNextLineIsCommand();
  });

  it('(b) cancelled', async () => {
    pushSystemEvent('c1', 'prompt.cancel', { requestId: 'r1' });
    expectPromptGone();
    await expectNextLineIsCommand();
  });

  it('(c) answered by a button', async () => {
    fireEvent.click(screen.getByTitle('Choose Hit'));
    await flush();
    expectPromptGone();
    trpcMocks.respondToPromptMutateAsync.mockClear();
    await expectNextLineIsCommand();
  });

  it('(d) the timeout event is missed; the poll says nothing is pending', async () => {
    await sleep(5);
    poll(null);
    // After the first empty poll the server has already said the question is gone: the
    // very next line must be a command, not an answer to the dead question.
    expectPromptGone();
    await expectNextLineIsCommand();
  });

  // The original reason for two empty polls (#142): a poll sent BEFORE the prompt arrived can
  // land empty afterwards, however late, and must not erase it.
  it('(d2) a poll sent before the prompt arrived, landing late, does not clear it', async () => {
    cleanupMount();
    trpcMocks.pendingPromptQuery.isFetching = true;
    mount();
    await sleep(5);
    pushPromptRequest('r1');
    trpcMocks.pendingPromptQuery.isFetching = false;
    trpcMocks.pendingPromptQuery.data = null;
    // Landed 6s after the prompt: a time-since-arrival grace would wrongly clear it.
    trpcMocks.pendingPromptQuery.dataUpdatedAt = Date.now() + 6_000;
    rerender();
    expect(input().placeholder).toMatch(/answer/i);
    // A second empty poll, though, is authoritative whenever it was sent.
    trpcMocks.pendingPromptQuery.dataUpdatedAt += 1;
    rerender();
    expectPromptGone();
  });

  it('(d3) a question cleared by one empty poll comes back if a later poll still lists it', async () => {
    await sleep(5);
    poll(null);
    expectPromptGone();
    poll({ requestId: 'r1', question: 'Which card?', choices: ['Hit'] });
    expect(input().placeholder).toMatch(/answer/i);
    expect(screen.queryAllByTitle(/^Choose /).filter(b => !(b as HTMLButtonElement).disabled)).toHaveLength(1);
  });

  it('(e) the server rejects an answer as no longer active', async () => {
    trpcMocks.respondToPromptMutateAsync.mockRejectedValueOnce(
      new Error('Prompt is no longer active. Please answer the latest prompt.'),
    );
    poll({ requestId: 'r1', question: 'Which card?', choices: ['Hit'] });
    type('yes');
    await flush();
    expect(screen.getAllByText(/Prompt is no longer active/)).toHaveLength(1);
    expectPromptGone();
    expect(tombstones().length).toBeGreaterThan(0);
    // The typed text is kept so Enter again runs it as a command.
    expect(input().value).toBe('yes');
    trpcMocks.respondToPromptMutateAsync.mockClear();
    fireEvent.submit(input().closest('form')!);
    await flush();
    expect(trpcMocks.commandMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ command: 'yes' }));
    expect(trpcMocks.respondToPromptMutateAsync).not.toHaveBeenCalled();
  });

  it('(e2) a network failure with a cached null does not bury a live prompt', async () => {
    trpcMocks.respondToPromptMutateAsync.mockRejectedValueOnce(new Error('Failed to fetch'));
    trpcMocks.pendingPromptQuery.refetch.mockImplementation(async () => ({ data: null, status: 'error' }));
    type('yes');
    await flush();
    expect(input().value).toBe('');
    // The server still has the question: the next poll re-arms it.
    poll({ requestId: 'r1', question: 'Which card?', choices: ['Hit'] });
    expect(input().placeholder).toMatch(/answer/i);
    expect(screen.queryAllByTitle(/^Choose /).filter(b => !(b as HTMLButtonElement).disabled)).toHaveLength(1);
  });

  it('(g) a request and its timeout in one replay burst leave the input in command mode', async () => {
    act(() => {
      for (const [id, type, payload] of [
        ['b-req', 'prompt.request', { requestId: 'rb', question: 'Q?', choices: ['Hit'] }],
        ['b-to', 'prompt.timeout', { requestId: 'rb' }],
      ] as const) {
        pushEvent({ id, data: { id, type, scope: 'private', targetUserId: 'user-1', text: '', payload, timestamp: Date.now(), roomId } as any });
      }
    });
    // r1 (from beforeEach) was superseded by rb, which then timed out.
    expectPromptGone();
    await expectNextLineIsCommand();
  });

  it('(f) a newer question supersedes an older one that never got a timeout/cancel event', () => {
    pushPromptRequest('r2');
    const live = screen.queryAllByTitle(/^Choose /).filter(b => !(b as HTMLButtonElement).disabled);
    expect(live).toHaveLength(1);
    // The older question is a tombstone, not merely button-less.
    expect(screen.getAllByText('Action cancelled.')).toHaveLength(1);
  });
});
