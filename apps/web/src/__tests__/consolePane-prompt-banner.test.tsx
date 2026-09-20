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
    refetch: vi.fn(async (): Promise<{ data: PendingPromptSnapshot | null }> => ({ data: null })),
  },
  respondToPromptMutateAsync: vi.fn(async () => ({ ok: true })),
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

vi.mock('../components/InlineChoices.js', () => ({
  default: () => null,
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
    renderRows = true;
    intersectionCallback = null;
    scrollToIndexMock.mockReset();
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

  it('treats a prompt row that Virtuoso has not mounted as out of view', () => {
    renderRows = false;

    render(
      <TestFeed>
        <ConsolePane roomId={roomId} isActive />
      </TestFeed>,
    );

    pushPromptRequest();

    expect(screen.getByText(/Command suggestions are paused/)).toBeInTheDocument();
  });
});
