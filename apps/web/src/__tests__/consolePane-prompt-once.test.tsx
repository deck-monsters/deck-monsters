import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { RingFeedContext, type RingFeedApi } from '../hooks/useRingFeed.js';

/*
 * A question the Console already holds in history (a reload or a late mount while it is still
 * open) reached the feed twice: once as the history text line and once as the live question
 * with its buttons. The shop's card and Back Room picks printed their `Choose one or more…`
 * paragraph twice (guides check, roadmap 45 L1). This uses the real history mapper.
 */
const QUESTION = 'Choose one or more of the following cards to buy:\n\n0) Basic Shield [1] - 87 coins';

const trpcMocks = vi.hoisted(() => ({
  history: [] as Array<{ id: string; type: string; text: string; payload: Record<string, unknown> }>,
  pending: null as null | { requestId: string; question: string; choices: string[]; timeoutSeconds?: number },
}));

vi.mock('react-virtuoso', () => {
  const React = require('react');
  const Virtuoso = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ scrollToIndex: vi.fn() }));
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
vi.mock('../lib/command-insert-context.js', () => ({ useCommandInsert: () => ({ registerInsertFn: () => undefined }) }));
vi.mock('../hooks/useCommandAutocomplete.js', () => ({ useCommandAutocomplete: () => [] }));
vi.mock('../components/CommandSuggestions.js', () => ({ default: () => null }));
vi.mock('../hooks/useChat.js', () => ({
  useChat: () => ({
    messages: [], unread: 0, lastReadId: 0, markRead: () => undefined, send: async () => null,
    members: [], dmCandidates: [], refreshNames: () => undefined, subscribeLive: () => () => undefined,
  }),
}));
vi.mock('../lib/trpc.js', () => ({
  trpc: {
    game: {
      consoleHistory: { useQuery: () => ({ data: trpcMocks.history }) },
      pendingPrompt: {
        useQuery: () => ({ data: trpcMocks.pending, dataUpdatedAt: 1, refetch: vi.fn(async () => ({ data: null })) }),
      },
      ringState: { useQuery: () => ({ data: undefined }) },
      myMonsters: { useQuery: () => ({ data: [], refetch: vi.fn(async () => ({ data: [] })) }) },
      myInventory: {
        useQuery: () => ({
          data: { items: { character: [], monsters: [] }, monsters: [] },
          refetch: vi.fn(async () => ({ data: { items: { character: [], monsters: [] } } })),
        }),
      },
      command: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
      respondToPrompt: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
      cancelPrompt: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
      cancelFlow: { useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }) },
    },
  },
}));
vi.mock('../utils/format-event-text.js', () => ({ formatEventText: (text: string) => text }));

import ConsolePane from '../components/ConsolePane.js';
import { resetGuidedStartForTests } from '../hooks/useGuidedStart.js';

const liveListeners = new Set<(tracked: any) => void>();

function TestFeed({ children }: { children: ReactNode }) {
  const value: RingFeedApi = {
    connected: true,
    reconnecting: false,
    seedCursor: () => undefined,
    subscribeChat: () => () => undefined,
    subscribe: (listener: any) => {
      liveListeners.add(listener);
      return () => { liveListeners.delete(listener); };
    },
  } as RingFeedApi;
  return <RingFeedContext.Provider value={value}>{children}</RingFeedContext.Provider>;
}

const roomId = '11111111-1111-1111-1111-111111111111';

describe('ConsolePane shows an open question once', () => {
  beforeEach(() => {
    localStorage.clear();
    resetGuidedStartForTests();
    (globalThis as any).IntersectionObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    };
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  it('drops the history line of the question that is open, and keeps the buttons', () => {
    trpcMocks.history = [
      { id: 'evt-q', type: 'prompt.request', text: QUESTION, payload: { requestId: 'req-1', question: QUESTION } },
    ];
    trpcMocks.pending = { requestId: 'req-1', question: QUESTION, choices: ['Basic Shield'], timeoutSeconds: 120 };
    render(<TestFeed><ConsolePane roomId={roomId} isActive /></TestFeed>);

    expect(screen.getAllByText(/Choose one or more of the following cards to buy:/)).toHaveLength(1);
    expect(screen.getByText('Basic Shield')).toBeInTheDocument();
  });

  it('shows the history line again once the question times out (the tombstone alone says nothing)', () => {
    trpcMocks.history = [
      { id: 'evt-q', type: 'prompt.request', text: QUESTION, payload: { requestId: 'req-1', question: QUESTION } },
    ];
    trpcMocks.pending = { requestId: 'req-1', question: QUESTION, choices: ['Basic Shield'], timeoutSeconds: 120 };
    render(<TestFeed><ConsolePane roomId={roomId} isActive /></TestFeed>);
    expect(screen.getAllByText(/Choose one or more of the following cards to buy:/)).toHaveLength(1);
    act(() => {
      for (const listener of liveListeners) listener({
        id: 't-1',
        data: {
          id: 't-1', type: 'prompt.timeout', scope: 'private', targetUserId: 'user-1', roomId, timestamp: Date.now(),
          text: 'The game stopped waiting for your answer. Try the command again.', payload: { requestId: 'req-1' },
        },
      });
    });
    expect(screen.getAllByText(/Choose one or more of the following cards to buy:/)).toHaveLength(1);
    expect(screen.queryByText('Basic Shield')).toBeNull();
  });

  it('keeps the history line of a question that is not open (it is the record)', () => {
    trpcMocks.history = [
      { id: 'evt-q', type: 'prompt.request', text: QUESTION, payload: { requestId: 'req-1', question: QUESTION } },
    ];
    trpcMocks.pending = null;
    render(<TestFeed><ConsolePane roomId={roomId} isActive /></TestFeed>);

    expect(screen.getAllByText(/Choose one or more of the following cards to buy:/)).toHaveLength(1);
    expect(screen.queryByText('Basic Shield')).toBeNull();
  });
});
