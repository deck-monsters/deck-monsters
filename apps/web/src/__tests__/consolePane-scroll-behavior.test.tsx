import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  RingFeedContext,
  type RingFeedApi,
  type TrackedRingFeedEvent,
} from '../hooks/useRingFeed.js';

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
    refetch: vi.fn(async (): Promise<{ data: PendingPromptSnapshot | null }> => ({ data: null })),
  },
  respondToPromptMutateAsync: vi.fn(async () => ({ ok: true })),
}));

function pushEvent(tracked: TrackedRingFeedEvent) {
  for (const listener of listeners) listener(tracked);
}

// The pane's side of the feed's contract: it hands the list rows, shows `↓ Latest` when the list
// reports it is no longer following, and asks it to scroll through its handle. How the list
// decides that is PlainFeedList's own business, proved in a real browser (e2e/scroll.spec.ts).
const feed = vi.hoisted(() => ({
  scrollToBottom: vi.fn(),
  onPinnedChange: undefined as undefined | ((pinned: boolean) => void),
  rows: 0,
}));

vi.mock('../components/PlainFeedList.js', () => {
  const React = require('react');
  return {
    default: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ scrollToBottom: feed.scrollToBottom, isPinned: () => true }));
      feed.onPinnedChange = props.onPinnedChange;
      feed.rows = props.data?.length ?? 0;
      return <div data-testid="plain-feed">{props.data?.length === 0 ? props.empty : null}</div>;
    }),
  };
});

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

vi.mock('../components/InlineChoices.js', () => ({
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
        useQuery: () => ({ data: undefined }),
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
          data: { items: { character: [], monsters: [] } },
          refetch: vi.fn(async () => ({ data: { items: { character: [], monsters: [] } } })),
        }),
      },
      command: {
        useMutation: () => ({ mutateAsync: vi.fn(async () => ({ ok: true })) }),
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

const ROOM = '11111111-1111-1111-1111-111111111111';

function setPinned(pinned: boolean) {
  act(() => feed.onPinnedChange?.(pinned));
}

describe('ConsolePane scroll behavior', () => {
  beforeEach(() => {
    feed.scrollToBottom.mockReset();
    feed.onPinnedChange = undefined;
    listeners.clear();
    trpcMocks.pendingPromptQuery.data = null;
    trpcMocks.pendingPromptQuery.dataUpdatedAt = 0;
    trpcMocks.respondToPromptMutateAsync.mockReset();
    trpcMocks.respondToPromptMutateAsync.mockImplementation(async () => ({ ok: true }));
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    restoreRaf = () => rafSpy.mockRestore();
  });

  afterEach(() => {
    restoreRaf?.();
    restoreRaf = null;
  });

  it('shows no jump button while the list follows the bottom', () => {
    render(
      <TestFeed>
        <ConsolePane roomId={ROOM} isActive={false} />
      </TestFeed>,
    );
    expect(screen.queryByRole('button', { name: 'Jump to latest messages' })).toBeNull();
  });

  it('shows "Latest" once the reader leaves the bottom, and it takes them back', () => {
    render(
      <TestFeed>
        <ConsolePane roomId={ROOM} isActive={false} />
      </TestFeed>,
    );
    setPinned(false);
    const jump = screen.getByRole('button', { name: 'Jump to latest messages' });
    feed.scrollToBottom.mockClear();
    fireEvent.click(jump);
    expect(feed.scrollToBottom).toHaveBeenCalledTimes(1);
    // The list reports the arrival itself; the pane does not claim it up front.
    expect(screen.getByRole('button', { name: 'Jump to latest messages' })).toBeTruthy();
    setPinned(true);
    expect(screen.queryByRole('button', { name: 'Jump to latest messages' })).toBeNull();
  });

  /*
   * An append must not schedule a scroll of its own (#129: an imperative scroll per append
   * fought the reader, and the console "refused to scroll up"), and an active console the
   * reader has scrolled up must not be re-pinned by the next event (#132: an unstable
   * effect dependency re-ran the tab-switch scroll on every render). Following is the list's
   * rule (PlainFeedList), not the pane's.
   */
  it('does not scroll the list when an event arrives, active or not', () => {
    render(
      <TestFeed>
        <ConsolePane roomId={ROOM} isActive />
      </TestFeed>,
    );
    setPinned(false);
    feed.scrollToBottom.mockClear();

    act(() => {
      pushEvent({
        id: 'evt-active',
        data: {
          id: 'evt-active',
          type: 'announce',
          scope: 'private',
          targetUserId: 'user-1',
          text: 'a new line arrives',
          payload: {},
          timestamp: Date.now(),
          roomId: ROOM,
        },
      });
    });

    expect(feed.rows).toBeGreaterThan(0);
    expect(feed.scrollToBottom).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Jump to latest messages' })).toBeTruthy();
  });

  it('goes to the bottom when the tab becomes active', () => {
    const { rerender } = render(
      <TestFeed>
        <ConsolePane roomId={ROOM} isActive={false} />
      </TestFeed>,
    );
    feed.scrollToBottom.mockClear();
    rerender(
      <TestFeed>
        <ConsolePane roomId={ROOM} isActive />
      </TestFeed>,
    );
    expect(feed.scrollToBottom).toHaveBeenCalled();
  });
});
