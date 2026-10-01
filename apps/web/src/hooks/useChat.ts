import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ChatMessage, ChatPlayer } from '@deck-monsters/server/types';
import { useAuth } from '../lib/auth-context.js';
import { trpc } from '../lib/trpc.js';
import { useRingFeedContext, type ChatFeedItem } from './useRingFeed.js';

/**
 * Room chat data for one room (roadmap 41, M1) — no UI. State and effects live ONCE, in
 * `ChatProvider`, mounted inside `RingFeedProvider` for the room; the Console and the Chat tab
 * both call `useChat()` and share it. Two independent copies would double-fetch and disagree
 * about unread. Reads and writes go through the
 * `chat.*` tRPC procedures; live messages arrive as chat frames on the room's single
 * `ringFeed` connection (see `ChatFeedItem` in `useRingFeed`). Chat frames are not replayed by
 * the server, so after every (re)connect this fetches whatever came after the newest id it has.
 *
 * `ChatProvider` must be inside `RingFeedProvider`; `useChat()` must be inside `ChatProvider`.
 */

export type UseChat = {
  /** Messages this player may see, ascending by id, deduped by id. */
  messages: ChatMessage[];
  /** Messages from others after `lastReadId`, as the server counts them plus live arrivals. */
  unread: number;
  lastReadId: number;
  /** Move the read position forward to `id` (never back). */
  markRead: (id: number) => void;
  /**
   * Send a room message, or a DM when `toUserId` is given. Resolves to `null` on success, or
   * the refusal text to show the player (the server's own wording, or a generic line if the
   * request could not be made at all).
   */
  send: (text: string, toUserId?: string) => Promise<string | null>;
  /** The To picker list: every other member of the room. */
  members: ChatPlayer[];
};

/** Merge by id, keep ascending order. Returns the same array when nothing was added. */
export function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return current;
  const known = new Set(current.map((m) => m.id));
  const fresh = incoming.filter((m) => {
    if (known.has(m.id)) return false;
    known.add(m.id);
    return true;
  });
  if (fresh.length === 0) return current;
  return [...current, ...fresh].sort((a, b) => a.id - b.id);
}

// When the request itself failed (offline, server error) rather than being refused by the chat
// rules; the refusal texts themselves come from the server.
const SEND_FAILED_TEXT = "That message didn't send. Try again.";

/** Page size for history fetches; matches the server's default limit. */
export const CHAT_PAGE_SIZE = 100;

const ChatContext = createContext<UseChat | null>(null);

/** The room's shared chat state. Throws outside a `ChatProvider` so a missing mount is loud. */
export function useChat(): UseChat {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}

export function ChatProvider({ roomId, children }: { roomId: string; children: ReactNode }) {
  const value = useChatState(roomId);
  return createElement(ChatContext.Provider, { value }, children);
}

function useChatState(roomId: string): UseChat {
  const { user } = useAuth();
  const myUserId = user?.id;
  const { subscribeChat } = useRingFeedContext();
  const utils = trpc.useUtils();
  const client = utils.client;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [lastReadId, setLastReadId] = useState(0);
  const [members, setMembers] = useState<ChatPlayer[]>([]);

  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const myUserIdRef = useRef(myUserId);
  myUserIdRef.current = myUserId;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const lastReadRef = useRef(lastReadId);
  lastReadRef.current = lastReadId;

  // Navigating to another room drops the previous room's chat before anything renders it.
  const [stateRoomId, setStateRoomId] = useState(roomId);
  if (stateRoomId !== roomId) {
    setStateRoomId(roomId);
    setMessages([]);
    setUnread(0);
    setLastReadId(0);
    setMembers([]);
  }

  const newestId = () => messagesRef.current.reduce((max, m) => Math.max(max, m.id), 0);

  /**
   * Fetch history: the newest page on first load, or everything newer than `afterId`. A
   * catch-up keeps paging until a page comes back short, so a long disconnect leaves no gap.
   */
  const loadHistory = useCallback(
    async (afterId?: number) => {
      const forRoom = roomId;
      try {
        let cursor = afterId;
        for (;;) {
          const result = await client.chat.history.query(
            cursor ? { roomId: forRoom, afterId: cursor, limit: CHAT_PAGE_SIZE } : { roomId: forRoom }
          );
          if (roomIdRef.current !== forRoom) return; // navigated away while it was loading
          setMessages((current) => mergeChatMessages(current, result.messages));
          setLastReadId((prev) => Math.max(prev, result.lastReadId));
          setUnread(result.unread);
          if (cursor === undefined || result.messages.length < CHAT_PAGE_SIZE) return;
          cursor = result.messages.reduce((max, m) => Math.max(max, m.id), cursor);
        }
      } catch {
        // Chat is secondary to the game: a failed fetch leaves what we have, and the next
        // handshake tries again.
      }
    },
    [client, roomId]
  );

  useEffect(() => {
    void loadHistory();
    let cancelled = false;
    void client.chat.members
      .query({ roomId })
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, roomId, loadHistory]);

  useEffect(
    () =>
      subscribeChat((item: ChatFeedItem) => {
        if (item.kind === 'connected') {
          // First connect and every reconnect. The mount fetch above may still be in flight,
          // in which case newestId() is 0 and this is a harmless duplicate of it.
          void loadHistory(newestId() || undefined);
          return;
        }
        const { message } = item;
        if (message.roomId !== roomIdRef.current) return;
        const isNew = !messagesRef.current.some((m) => m.id === message.id);
        setMessages((current) => mergeChatMessages(current, [message]));
        if (isNew && message.senderUserId !== myUserIdRef.current && message.id > lastReadRef.current) {
          setUnread((n) => n + 1);
        }
      }),
    [subscribeChat, loadHistory]
  );

  const markRead = useCallback(
    (id: number) => {
      if (id <= lastReadRef.current) return;
      const forRoom = roomId;
      setLastReadId(id);
      lastReadRef.current = id;
      // Optimistic: what is still unread is what we hold from others past `id`, never more
      // than before. The server's answer replaces it.
      setUnread((n) =>
        Math.min(
          n,
          messagesRef.current.filter((m) => m.id > id && m.senderUserId !== myUserIdRef.current).length
        )
      );
      client.chat.markRead
        .mutate({ roomId: forRoom, lastReadId: id })
        .then((result) => {
          if (roomIdRef.current !== forRoom) return;
          setUnread(result.unread);
        })
        .catch(() => {});
    },
    [client, roomId]
  );

  const send = useCallback(
    async (text: string, toUserId?: string): Promise<string | null> => {
      try {
        const message = await client.chat.send.mutate(
          toUserId ? { roomId, text, toUserId } : { roomId, text }
        );
        // Show our own line without waiting for the live frame; the frame dedupes by id.
        setMessages((current) => mergeChatMessages(current, [message]));
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        return message || SEND_FAILED_TEXT;
      }
    },
    [client, roomId]
  );

  return { messages, unread, lastReadId, markRead, send, members };
}
