import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ChatMessage } from '@deck-monsters/server/types';
import { RingFeedContext, type ChatFeedItem, type RingFeedApi } from '../hooks/useRingFeed.js';
import { CHAT_PAGE_SIZE, ChatProvider, mergeChatMessages, useChat } from '../hooks/useChat.js';

const ME = 'user-me';
const mocks = vi.hoisted(() => ({
  history: vi.fn(),
  send: vi.fn(),
  markRead: vi.fn(),
  members: vi.fn(),
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

  it('throws a clear error when used outside a ChatProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useChat())).toThrow('useChat must be used within ChatProvider');
    spy.mockRestore();
  });
});
