import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ChatMessage } from '@deck-monsters/server/types';
import { RingFeedContext, type ChatFeedItem, type RingFeedApi } from '../hooks/useRingFeed.js';
import { CHAT_PAGE_SIZE, NAMES_REFRESH_MS, ChatProvider, mergeChatMessages, useChat } from '../hooks/useChat.js';

const ME = 'user-me';
const mocks = vi.hoisted(() => ({
  history: vi.fn(),
  send: vi.fn(),
  markRead: vi.fn(),
  members: vi.fn(),
  dmNames: vi.fn(),
}));

vi.mock('../lib/auth-context.js', () => ({
  useAuth: () => ({ user: { id: 'user-me' } }),
}));

vi.mock('../lib/trpc.js', () => {
  const client = {
    chat: {
      history: { query: mocks.history },
      send: { mutate: mocks.send },
      markRead: { mutate: mocks.markRead },
      members: { query: mocks.members },
      dmNames: { query: mocks.dmNames },
    },
  };
  // Stable identity, like the real utils object: the hook must not refetch on every render.
  const utils = { client };
  return { trpc: { useUtils: () => utils } };
});

function msg(id: number, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    roomId: 'room-a',
    senderUserId: 'user-ben',
    senderName: 'Ben',
    recipientUserId: null,
    recipientName: null,
    text: `m${id}`,
    fightNumber: null,
    source: 'web',
    createdAt: new Date(2026, 9, 1, 12, id).toISOString(),
    ...overrides,
  };
}

let chatListeners: Set<(item: ChatFeedItem) => void>;
const feed: RingFeedApi = {
  connected: true,
  reconnecting: false,
  subscribe: () => () => undefined,
  seedCursor: () => undefined,
  subscribeChat: (listener) => {
    chatListeners.add(listener);
    return () => chatListeners.delete(listener);
  },
};
const emit = (item: ChatFeedItem) => act(() => chatListeners.forEach((l) => l(item)));

// The room id comes from the hook's props in these tests, so the provider reads it from a ref.
let roomForProvider = 'room-a';
const wrapper = ({ children }: { children: ReactNode }) => (
  <RingFeedContext.Provider value={feed}>
    <ChatProvider roomId={roomForProvider}>{children}</ChatProvider>
  </RingFeedContext.Provider>
);

describe('mergeChatMessages', () => {
  it('dedupes by id and keeps ascending order', () => {
    const merged = mergeChatMessages([msg(1), msg(3)], [msg(2), msg(3, { text: 'dup' }), msg(4)]);
    expect(merged.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(merged.find((m) => m.id === 3)?.text).toBe('m3');
  });

  it('returns the same array when nothing is new', () => {
    const current = [msg(1)];
    expect(mergeChatMessages(current, [msg(1)])).toBe(current);
    expect(mergeChatMessages(current, [])).toBe(current);
  });
});

describe('useChat', () => {
  beforeEach(() => {
    chatListeners = new Set();
    roomForProvider = 'room-a';
    mocks.history.mockReset().mockResolvedValue({ messages: [msg(1), msg(2)], lastReadId: 1, unread: 1 });
    mocks.send.mockReset();
    mocks.markRead.mockReset().mockResolvedValue({ lastReadId: 2, unread: 0 });
    mocks.members.mockReset().mockResolvedValue([{ userId: 'user-ben', name: 'Ben' }]);
    mocks.dmNames.mockReset().mockResolvedValue([{ userId: 'user-ben', name: 'Ben', match: 'Ben' }]);
  });

  it('loads history, the read position, the unread count and the To list for the room', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(mocks.history).toHaveBeenCalledWith({ roomId: 'room-a' });
    expect(mocks.members).toHaveBeenCalledWith({ roomId: 'room-a' });
    expect(result.current.lastReadId).toBe(1);
    expect(result.current.unread).toBe(1);
    await waitFor(() => expect(result.current.members).toEqual([{ userId: 'user-ben', name: 'Ben' }]));
  });

  it('merges live frames, dedupes by id, and counts others (not me) as unread', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    emit({ kind: 'message', message: msg(3) });
    emit({ kind: 'message', message: msg(3) }); // the same frame twice
    emit({ kind: 'message', message: msg(4, { senderUserId: ME, senderName: 'You' }) });
    expect(result.current.messages.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(result.current.unread).toBe(2); // 1 from history + m3; not twice, not my own m4
  });

  it('ignores a live message for another room', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    emit({ kind: 'message', message: msg(9, { roomId: 'room-b' }) });
    expect(result.current.messages).toHaveLength(2);
  });

  it('fetches history after the newest id it has when the feed reconnects', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    emit({ kind: 'message', message: msg(5) });

    mocks.history.mockResolvedValueOnce({ messages: [msg(6), msg(7), msg(5)], lastReadId: 1, unread: 4 });
    emit({ kind: 'connected' });
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual([1, 2, 5, 6, 7]));
    expect(mocks.history).toHaveBeenLastCalledWith({ roomId: 'room-a', afterId: 5, limit: CHAT_PAGE_SIZE });
    expect(result.current.unread).toBe(4);
  });

  it('marks read forward only, optimistically, then takes the server unread count', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => result.current.markRead(2));
    expect(result.current.lastReadId).toBe(2);
    expect(result.current.unread).toBe(0);
    expect(mocks.markRead).toHaveBeenCalledWith({ roomId: 'room-a', lastReadId: 2 });

    mocks.markRead.mockClear();
    act(() => result.current.markRead(1)); // backwards: ignored
    expect(result.current.lastReadId).toBe(2);
    expect(mocks.markRead).not.toHaveBeenCalled();
  });

  it('send resolves null and shows the stored message at once; the live frame then dedupes', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    mocks.send.mockResolvedValue(msg(3, { senderUserId: ME, text: 'hello' }));

    let outcome: string | null = 'unset';
    await act(async () => {
      outcome = await result.current.send('hello', 'user-ben');
    });
    expect(outcome).toBeNull();
    expect(mocks.send).toHaveBeenCalledWith({ roomId: 'room-a', text: 'hello', toUserId: 'user-ben' });
    expect(result.current.messages.map((m) => m.id)).toEqual([1, 2, 3]);

    emit({ kind: 'message', message: msg(3, { senderUserId: ME, text: 'hello' }) });
    expect(result.current.messages).toHaveLength(3);
  });

  it('send resolves the refusal text when the server refuses', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    mocks.send.mockRejectedValue(new Error('Easy there. Wait a few seconds before the next message.'));
    let outcome: string | null = null;
    await act(async () => {
      outcome = await result.current.send('spam');
    });
    expect(outcome).toBe('Easy there. Wait a few seconds before the next message.');
    expect(mocks.send).toHaveBeenCalledWith({ roomId: 'room-a', text: 'spam' });
    expect(result.current.messages).toHaveLength(2);
  });

  it('drops the old room and loads the new one when the room changes', async () => {
    const { result, rerender } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    mocks.history.mockResolvedValue({ messages: [msg(10, { roomId: 'room-b' })], lastReadId: 0, unread: 1 });
    roomForProvider = 'room-b';
    rerender();
    expect(result.current.messages).toEqual([]);
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual([10]));
    expect(mocks.history).toHaveBeenLastCalledWith({ roomId: 'room-b' });
  });

  it('keeps paging after a long disconnect until a page comes back short', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => msg(from + i));
    mocks.history.mockReset();
    mocks.history
      .mockResolvedValueOnce({ messages: page(3, CHAT_PAGE_SIZE), lastReadId: 0, unread: 250 })
      .mockResolvedValueOnce({ messages: page(3 + CHAT_PAGE_SIZE, CHAT_PAGE_SIZE), lastReadId: 0, unread: 250 })
      .mockResolvedValueOnce({ messages: page(3 + 2 * CHAT_PAGE_SIZE, 50), lastReadId: 0, unread: 250 });
    emit({ kind: 'connected' });
    await waitFor(() => expect(result.current.messages).toHaveLength(2 + 250));
    expect(mocks.history.mock.calls.map((c) => c[0].afterId)).toEqual([2, 2 + CHAT_PAGE_SIZE, 2 + 2 * CHAT_PAGE_SIZE]);
  });

  it('a send that completes after moving to another room does not touch the new room', async () => {
    const { result, rerender } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    let finish: (m: ChatMessage) => void = () => undefined;
    mocks.send.mockReturnValue(new Promise<ChatMessage>((resolve) => { finish = resolve; }));
    const heard: number[] = [];
    result.current.subscribeLive((m) => heard.push(m.id));
    const sending = result.current.send('hello from A');
    mocks.history.mockResolvedValue({ messages: [msg(10, { roomId: 'room-b' })], lastReadId: 0, unread: 1 });
    roomForProvider = 'room-b';
    rerender();
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual([10]));
    await act(async () => {
      finish(msg(50, { roomId: 'room-a', senderUserId: ME }));
      expect(await sending).toBeNull();
    });
    expect(result.current.messages.map((m) => m.id)).toEqual([10]);
    expect(heard).toEqual([]);
  });

  it('keeps retrying a read position that failed to save, so the badge can clear', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    mocks.markRead.mockReset().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ lastReadId: 2, unread: 0 });
    act(() => result.current.markRead(2));
    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledTimes(1));
    expect(result.current.lastReadId).toBe(2);
    // The next call for the same id is not an early return: nothing was ever saved.
    act(() => result.current.markRead(2));
    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.unread).toBe(0));
    // Saved now: no more writes.
    act(() => result.current.markRead(2));
    expect(mocks.markRead).toHaveBeenCalledTimes(2);
  });

  it('retries an unsaved read position when the feed reconnects', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    mocks.markRead.mockReset().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ lastReadId: 2, unread: 0 });
    act(() => result.current.markRead(2));
    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledTimes(1));
    emit({ kind: 'connected' });
    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledTimes(2));
  });

  it('pages back on open until everything unread is loaded (250 unread)', async () => {
    const ids = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => msg(from + i));
    mocks.history.mockReset();
    mocks.history.mockImplementation(async (q: { beforeId?: number; afterId?: number }) => {
      if (q.beforeId === undefined) return { messages: ids(151, 250), lastReadId: 0, unread: 250 };
      if (q.beforeId === 151) return { messages: ids(51, 150), lastReadId: 0, unread: 250 };
      return { messages: ids(1, 50), lastReadId: 0, unread: 250 };
    });
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(250));
    expect(result.current.messages[0]!.id).toBe(1);
    expect(mocks.history).toHaveBeenCalledWith({ roomId: 'room-a', beforeId: 151, limit: CHAT_PAGE_SIZE });
  });

  it('stops paging back once it reaches the read position, and at the room cap', async () => {
    const ids = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => msg(from + i));
    mocks.history.mockReset();
    mocks.history.mockImplementation(async (q: { beforeId?: number }) =>
      q.beforeId === undefined
        ? { messages: ids(201, 300), lastReadId: 150, unread: 100 }
        : { messages: ids(101, 200), lastReadId: 150, unread: 100 }
    );
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(200));
    // oldest loaded (101) is at or before... no: 101 <= 150, so it stops after the second page.
    expect(mocks.history).toHaveBeenCalledTimes(2);
  });

  it('refreshes the name lists on a reconnect and, throttled, on demand', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.members).toHaveLength(1));
    expect(mocks.dmNames).toHaveBeenCalledTimes(1);
    mocks.dmNames.mockResolvedValue([{ userId: 'user-new', name: 'Newcomer', match: 'Newcomer' }]);
    emit({ kind: 'connected' });
    await waitFor(() => expect(result.current.dmCandidates[0]?.name).toBe('Newcomer'));
    expect(mocks.dmNames).toHaveBeenCalledTimes(2);

    // On demand: ignored inside the throttle window, honoured after it.
    act(() => result.current.refreshNames());
    expect(mocks.dmNames).toHaveBeenCalledTimes(2);
    const real = Date.now;
    Date.now = () => real() + NAMES_REFRESH_MS + 1;
    try {
      act(() => result.current.refreshNames());
    } finally {
      Date.now = real;
    }
    expect(mocks.dmNames).toHaveBeenCalledTimes(3);
  });

  it('throws a clear error when used outside a ChatProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useChat())).toThrow('useChat must be used within ChatProvider');
    spy.mockRestore();
  });
});
