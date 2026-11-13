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

// Captured by the fake IntersectionObserver constructor below so tests can drive it.
let intersectionCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;

function setPromptIntersecting(isIntersecting: boolean) {
  act(() => {
    intersectionCallback?.([{ isIntersecting }]);
  });
}

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

describe('ConsolePane prompt waiting banner', () => {
  beforeEach(() => {
    localStorage.clear();
    resetGuidedStartForTests();
    intersectionCallback = null;
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

    class FakeIntersectionObserver {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        intersectionCallback = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    (globalThis as any).IntersectionObserver = FakeIntersectionObserver;
  });

  afterEach(() => {
    restoreRaf?.();
    restoreRaf = null;
    delete (globalThis as any).IntersectionObserver;
  });

  it('does not show the waiting banner while the prompt choices are on screen', () => {
    render(
      <TestFeed>
        <ConsolePane roomId={roomId} isActive />
      </TestFeed>,
    );

    pushPromptRequest();
    setPromptIntersecting(true);

    expect(screen.queryByText(/Command suggestions are paused/)).toBeNull();
    expect(
      screen.getByPlaceholderText('Type your answer or click a choice above…'),
    ).toBeInTheDocument();
  });

  it('shows the waiting banner once the prompt has scrolled out of view, and hides it again when it returns', () => {
    render(
      <TestFeed>
        <ConsolePane roomId={roomId} isActive />
      </TestFeed>,
    );

    pushPromptRequest();

    setPromptIntersecting(false);
    expect(screen.getByText(/Command suggestions are paused/)).toBeInTheDocument();

    setPromptIntersecting(true);
    expect(screen.queryByText(/Command suggestions are paused/)).toBeNull();
  });

  // The row is in the DOM (every row is), but nothing has reported its choices on screen yet,
  // so the player may not see the question: the banner explains it until they do.
  it('treats a prompt row that has not reported itself visible as out of view', () => {
    render(
      <TestFeed>
        <ConsolePane roomId={roomId} isActive />
      </TestFeed>,
    );

    pushPromptRequest();

    expect(screen.getByText(/Command suggestions are paused/)).toBeInTheDocument();
  });

  // On a phone the chips and the getting-started guide covered the question
  // (help inventory, phone-name-covered.png). They step aside for the prompt.
  it('hides the suggestion chips and the getting-started guide while a prompt is open, and restores them after', () => {
    render(
      <TestFeed>
        <ConsolePane roomId={roomId} isActive />
      </TestFeed>,
    );

    act(() => {
      pushEvent({
        id: 'quick-1',
        data: {
          id: 'quick-1',
          type: 'quick_actions',
          scope: 'private',
          targetUserId: 'user-1',
          text: '',
          payload: { actions: [{ label: 'look at monsters', command: 'look at monsters' }] },
          timestamp: Date.now(),
          roomId,
        },
      });
    });

    expect(screen.getByLabelText('Quick action suggestions')).toBeInTheDocument();
    expect(screen.getByLabelText('Getting started guide')).toBeInTheDocument();

    pushPromptRequest();

    expect(screen.queryByLabelText('Quick action suggestions')).toBeNull();
    expect(screen.queryByLabelText('Getting started guide')).toBeNull();

    act(() => {
      pushEvent({
        id: 'cancel-1',
        data: {
          id: 'cancel-1',
          type: 'prompt.cancel',
          scope: 'private',
          targetUserId: 'user-1',
          text: '',
          payload: { requestId: 'request-1' },
          timestamp: Date.now(),
          roomId,
        },
      });
    });

    expect(screen.getByLabelText('Quick action suggestions')).toBeInTheDocument();
    expect(screen.getByLabelText('Getting started guide')).toBeInTheDocument();
  });
});
