import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { RecipientCandidate } from '@deck-monsters/engine';
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
  /**
   * True once a history fetch has succeeded for this room. Until then `lastReadId` is 0 only
   * because nothing has loaded, so the Chat tab waits for it before fixing the new-since
   * marker (a live frame can arrive first).
   */
  loaded: boolean;
  /** The To picker list: every other member of the room. */
  members: ChatPlayer[];
  /**
   * Re-fetch the member lists (`members`, `dmCandidates`) now, at most once per
   * `NAMES_REFRESH_MS`. They are also refreshed on every feed handshake. The Console calls this
   * as a `dm ` line starts, so a join, leave or rename since the room opened is not previewed
   * from a stale list.
   */
  refreshNames: () => void;
  /**
   * What a typed `dm` is matched against: the server's own candidate list (character names and
   * account display names of current members, the caller included), so the Console's To:
   * preview resolves exactly as the server will. Empty until it loads.
   */
  dmCandidates: RecipientCandidate[];
  /**
   * Be told about each message as it arrives live (a chat frame, or our own send), not about
   * history. The Console shows these as chat lines and leaves the backlog to the Chat tab. A
   * message can be announced twice (our own send, then its frame), so a listener dedupes by id.
   * Returns the unsubscribe.
   */
  subscribeLive: (listener: (message: ChatMessage) => void) => () => void;
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

/** The room cap on stored messages (server RETENTION_MAX_PER_ROOM): no history is older than this. */
export const CHAT_ROOM_CAP = 500;

/** Minimum gap between name-list refreshes triggered by typing `dm `. */
export const NAMES_REFRESH_MS = 10_000;

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
  const [dmCandidates, setDmCandidates] = useState<RecipientCandidate[]>([]);
  const [loaded, setLoaded] = useState(false);

  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const myUserIdRef = useRef(myUserId);
  myUserIdRef.current = myUserId;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const lastReadRef = useRef(lastReadId);
  lastReadRef.current = lastReadId;
  // The read position the server has actually stored. `lastReadId` moves ahead optimistically;
  // if the write fails the two differ, and the next markRead or handshake retries instead of
  // returning early (which left the badge stuck, with nothing ever persisted).
  const persistedReadRef = useRef(0);
  const readInFlightRef = useRef(false);
  const lastNamesFetchRef = useRef(0);

  // Navigating to another room drops the previous room's chat before anything renders it.
  const [stateRoomId, setStateRoomId] = useState(roomId);
  if (stateRoomId !== roomId) {
    setStateRoomId(roomId);
    setMessages([]);
    setUnread(0);
    setLastReadId(0);
    setMembers([]);
    setDmCandidates([]);
    setLoaded(false);
    persistedReadRef.current = 0;
    lastNamesFetchRef.current = 0;
  }

  const liveListenersRef = useRef(new Set<(message: ChatMessage) => void>());
  const subscribeLive = useCallback((listener: (message: ChatMessage) => void) => {
    liveListenersRef.current.add(listener);
    return () => {
      liveListenersRef.current.delete(listener);
    };
  }, []);

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
          persistedReadRef.current = Math.max(persistedReadRef.current, result.lastReadId);
          setUnread(result.unread);
          setLoaded(true);
          if (cursor === undefined) {
            await loadUnreadBacklog(forRoom, result.messages, result.lastReadId);
            return;
          }
          if (result.messages.length < CHAT_PAGE_SIZE) return;
          cursor = result.messages.reduce((max, m) => Math.max(max, m.id), cursor);
        }
      } catch {
        // Chat is secondary to the game: a failed fetch leaves what we have, and the next
        // handshake tries again.
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadUnreadBacklog only uses `client`
    [client, roomId]
  );

  /**
   * The first page is the newest 100. When the player has more than that unread, page BACK
   * until the oldest loaded message is at or before their read position (bounded by the room
   * cap), so everything unread is actually rendered. Reaching the bottom of the Chat tab marks
   * the newest message read; without this it would mark older, never-rendered messages read too.
   */
  async function loadUnreadBacklog(forRoom: string, firstPage: ChatMessage[], readId: number) {
    let loadedCount = firstPage.length;
    let oldest = firstPage.reduce((min, m) => Math.min(min, m.id), Infinity);
    let pageLength = firstPage.length;
    while (pageLength >= CHAT_PAGE_SIZE && oldest > readId && loadedCount < CHAT_ROOM_CAP) {
      const older = await client.chat.history.query({ roomId: forRoom, beforeId: oldest, limit: CHAT_PAGE_SIZE });
      if (roomIdRef.current !== forRoom) return;
      setMessages((current) => mergeChatMessages(current, older.messages));
      pageLength = older.messages.length;
      loadedCount += pageLength;
      if (pageLength === 0) return;
      oldest = older.messages.reduce((min, m) => Math.min(min, m.id), oldest);
    }
  }

  const fetchNames = useCallback(() => {
    const forRoom = roomId;
    lastNamesFetchRef.current = Date.now();
    void client.chat.members
      .query({ roomId: forRoom })
      .then((list) => {
        if (roomIdRef.current === forRoom) setMembers(list);
      })
      .catch(() => {});
    void client.chat.dmNames
      .query({ roomId: forRoom })
      .then((list) => {
        if (roomIdRef.current === forRoom) setDmCandidates(list);
      })
      .catch(() => {});
  }, [client, roomId]);

  const refreshNames = useCallback(() => {
    if (Date.now() - lastNamesFetchRef.current < NAMES_REFRESH_MS) return;
    fetchNames();
  }, [fetchNames]);

  useEffect(() => {
    void loadHistory();
    fetchNames();
  }, [loadHistory, fetchNames]);

  useEffect(
    () =>
      subscribeChat((item: ChatFeedItem) => {
        if (item.kind === 'connected') {
          // First connect and every reconnect. The mount fetch above may still be in flight,
          // in which case newestId() is 0 and this is a harmless duplicate of it.
          void loadHistory(newestId() || undefined);
          // Joins, leaves and renames since the last connection.
          fetchNames();
          // A read position that failed to save is retried now the connection is back.
          if (lastReadRef.current > persistedReadRef.current) persistRead(lastReadRef.current);
          return;
        }
        const { message } = item;
        if (message.roomId !== roomIdRef.current) return;
        const isNew = !messagesRef.current.some((m) => m.id === message.id);
        for (const listener of liveListenersRef.current) listener(message);
        setMessages((current) => mergeChatMessages(current, [message]));
        if (isNew && message.senderUserId !== myUserIdRef.current && message.id > lastReadRef.current) {
          setUnread((n) => n + 1);
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persistRead is stable per room
    [subscribeChat, loadHistory, fetchNames]
  );

  /** Write the read position to the server; the optimistic value stays until it is saved. */
  function persistRead(id: number) {
    const forRoom = roomId;
    readInFlightRef.current = true;
    client.chat.markRead
      .mutate({ roomId: forRoom, lastReadId: id })
      .then((result) => {
        readInFlightRef.current = false;
        if (roomIdRef.current !== forRoom) return;
        persistedReadRef.current = Math.max(persistedReadRef.current, id);
        setUnread(result.unread);
      })
      .catch(() => {
        readInFlightRef.current = false;
        // Not saved: persistedReadRef stays behind lastReadRef, so the next markRead or
        // handshake tries again.
      });
  }

  const markRead = useCallback(
    (id: number) => {
      if (id <= lastReadRef.current) {
        // Already ahead on screen; only retry if that never reached the server.
        if (lastReadRef.current > persistedReadRef.current && !readInFlightRef.current) {
          persistRead(lastReadRef.current);
        }
        return;
      }
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
      persistRead(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persistRead closes over client and roomId only
    [client, roomId]
  );

  const send = useCallback(
    async (text: string, toUserId?: string): Promise<string | null> => {
      const forRoom = roomId;
      try {
        const message = await client.chat.send.mutate(
          toUserId ? { roomId: forRoom, text, toUserId } : { roomId: forRoom, text }
        );
        // The player may have moved to another room while this was in flight: the message
        // belongs to the room it was sent in, and must not appear in (or notify) this one.
        if (roomIdRef.current !== forRoom) return null;
        // Show our own line without waiting for the live frame; the frame dedupes by id.
        setMessages((current) => mergeChatMessages(current, [message]));
        for (const listener of liveListenersRef.current) listener(message);
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        return message || SEND_FAILED_TEXT;
      }
    },
    [client, roomId]
  );

  return { messages, unread, lastReadId, loaded, markRead, send, members, dmCandidates, refreshNames, subscribeLive };
}
