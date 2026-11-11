import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { GameEvent, ChatMessage } from '@deck-monsters/server/types';
import { trpc } from '../lib/trpc.js';
import { feedTimings } from '../lib/feed-timings.js';
import { shouldAdvanceEventCursor } from '../utils/ring-feed-cursor.js';
import {
  HEARTBEAT_TIMEOUT_MS,
  RESUME_GRACE_MS,
  decideAfterResume,
  reconnectDelayMs,
} from '../utils/ring-feed-connection.js';
import { useHandshake } from './useHandshake.js';

export type TrackedRingFeedEvent = { id: string; data: GameEvent };

/**
 * What `useChat` hears from the feed. Chat is NOT a game event: the server yields it as an
 * untracked `{ type: 'chat', id, payload }` frame, and it never reaches pane listeners or the
 * reconnect cursor (a chat id fed to the cursor would corrupt `lastEventId`).
 * `connected` fires on every handshake (first connect and each reconnect) so a consumer can
 * fetch the chat it missed from `chat.history`; chat frames are not replayed.
 */
export type ChatFeedItem = { kind: 'message'; message: ChatMessage } | { kind: 'connected' };

/** The raw untracked chat frame the server yields from `ringFeed`. */
export type ChatFrame = { type: 'chat'; id: string; payload: ChatMessage };

export function isChatFrame(frame: unknown): frame is ChatFrame {
  return (
    typeof frame === 'object'
    && frame !== null
    && (frame as { type?: unknown }).type === 'chat'
    && typeof (frame as { payload?: unknown }).payload === 'object'
  );
}

export type RingFeedApi = {
  connected: boolean;
  reconnecting: boolean;
  /** Register a pane listener. Returns unsubscribe. Listener identity may change freely. */
  subscribe: (listener: (tracked: TrackedRingFeedEvent) => void) => () => void;
  /**
   * Seed / advance the reconnect cursor from a DB history tail.
   * Monotonic by leading epoch timestamp — never moves backwards or overwrites
   * a newer live cursor.
   */
  seedCursor: (eventId: string) => void;
  /** Register a chat listener (see `ChatFeedItem`). Returns unsubscribe. */
  subscribeChat: (listener: (item: ChatFeedItem) => void) => () => void;
};

/**
 * Re-exported for the tests. The values and their reasoning live in
 * `utils/ring-feed-connection.ts`: the server heartbeats every 8 s and a silent connection
 * is declared dead after 20 s (2.5x), down from 20 s and 50 s (baseline C1). Nothing used
 * to watch for heartbeats stopping, so a connection that died silently (a backgrounded
 * phone, a network that blackholes rather than resets) left the app showing no
 * "reconnecting…" banner while quietly missing events. See 10b-bugs-fixed.md #108.
 */
export { HEARTBEAT_TIMEOUT_MS };

export const RingFeedContext = createContext<RingFeedApi | null>(null);

/**
 * Owns the single `ringFeed` subscription for a Terminal/room: shared cursor,
 * handshake, room guard, and fan-out to pane listeners.
 */
export function useRingFeed(roomId: string): RingFeedApi {
  const { handleHandshakeEvent } = useHandshake();
  const handleHandshakeRef = useRef(handleHandshakeEvent);
  handleHandshakeRef.current = handleHandshakeEvent;

  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [subLastEventId, setSubLastEventId] = useState<string | undefined>(undefined);
  /*
   * Bumped on every give-up so a resume always produces a *different* subscription input.
   *
   * Resuming used to be `setSubLastEventId(latestTrackedEventIdRef.current)` alone, which
   * is a no-op whenever the cursor has not moved since the last subscribe — which is
   * exactly the quiet-room case the watchdog fires in. React bails out on an unchanged
   * value, the input stays identical, tRPC never re-subscribes, no handshake ever arrives,
   * and `reconnecting` stays true forever: the banner the reporter saw with a connection
   * that was working fine and no "reconnected" line after it. See 10b-bugs-fixed.md #127.
   */
  const [resumeAttempt, setResumeAttempt] = useState(0);
  const latestTrackedEventIdRef = useRef<string | undefined>(undefined);
  const listenersRef = useRef(new Set<(tracked: TrackedRingFeedEvent) => void>());
  // Events that arrive before any pane listener is registered (e.g. sync delivery
  // during the subscribe call in render) are buffered and flushed on subscribe.
  const pendingEventsRef = useRef<TrackedRingFeedEvent[]>([]);
  const chatListenersRef = useRef(new Set<(item: ChatFeedItem) => void>());
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Resubscribe backoff (baseline C6): the pending retry, and how many have failed since the
  // last handshake.
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failuresRef = useRef(0);
  // `handleConnectionLost` and `armWatchdog` call each other; this breaks the cycle.
  const armWatchdogRef = useRef<(ms: number) => void>(() => undefined);
  // The resume check's grace timer, and the wall-clock facts it decides from. Wall clock
  // (`Date.now`), not `performance.now`: some browsers stop the latter while the device sleeps.
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFrameWallRef = useRef<number | null>(null);
  const offlineSinceFrameRef = useRef(false);

  // Timing instrumentation only (lib/feed-timings.ts). Per-room: reset with the cursor below.
  const timingStartedRef = useRef(false);
  const firstHandshakeRecordedRef = useRef(false);
  const awaitingReconnectRef = useRef(false);
  const lastFrameAtRef = useRef<number | null>(null);
  const timingNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (!timingStartedRef.current) {
    timingStartedRef.current = true;
    feedTimings.mark('conn.hook.first_render');
  }

  // Reset shared cursor / connection flags when navigating to another room.
  // Adjust state during render so the subscription input never briefly carries
  // the previous room's cursor.
  const [cursorRoomId, setCursorRoomId] = useState(roomId);
  if (cursorRoomId !== roomId) {
    setCursorRoomId(roomId);
    setSubLastEventId(undefined);
    setResumeAttempt(0);
    setConnected(false);
    setReconnecting(false);
    latestTrackedEventIdRef.current = undefined;
    listenersRef.current.clear();
    chatListenersRef.current.clear();
    pendingEventsRef.current = [];
    feedTimings.mark('conn.hook.first_render');
    firstHandshakeRecordedRef.current = false;
    awaitingReconnectRef.current = false;
    lastFrameAtRef.current = null;
    lastFrameWallRef.current = null;
    offlineSinceFrameRef.current = false;
    failuresRef.current = 0;
    // The previous room's timers must die with it. RingFeedProvider is not re-keyed
    // per room, so a timer left armed here fires later against the *new* room and drops
    // a healthy connection into "reconnecting…", which only a real handshake clears. The
    // same goes for a pending backoff retry (it would resubscribe the new room with the old
    // room's cursor) and a resume check.
    for (const timerRef of [heartbeatTimerRef, retryTimerRef, resumeTimerRef]) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }

  const clearWatchdog = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  /**
   * Mark the subscription dead and re-subscribe from the last event we saw. Shared by
   * the transport's own `onError`, the heartbeat watchdog and the resume check so all
   * produce identical state and the same resume cursor.
   *
   * The resubscribe is paced (baseline C6): the first retry is immediate, later ones back
   * off (`reconnectDelayMs`). It used to be immediate every time, so a server that was down
   * for 5 s saw 101 subscribe attempts. `reconnecting` stays true while a retry waits, and
   * a second loss signal while one is already waiting adds nothing.
   */
  const handleConnectionLost = useCallback(() => {
    if (lastFrameAtRef.current !== null) {
      feedTimings.duration('conn.gap_before_lost', timingNow() - lastFrameAtRef.current);
    }
    // Keep the first loss's time if several fire before a handshake lands.
    if (!awaitingReconnectRef.current) feedTimings.mark('conn.lost');
    awaitingReconnectRef.current = true;
    setConnected(false);
    setReconnecting(true);
    // The old subscription is dead; its watchdog must not fire into the retry. The retry
    // arms a fresh one when it resubscribes.
    clearWatchdog();
    if (retryTimerRef.current !== null) return;

    const resubscribe = () => {
      retryTimerRef.current = null;
      // The cursor is read when the retry runs, not when the loss was noticed, so a frame
      // that landed in between is not replayed.
      setSubLastEventId(latestTrackedEventIdRef.current);
      setResumeAttempt((attempt) => attempt + 1);
      // A resubscribe that never delivers a handshake (a dead socket under the new
      // subscription) must still be noticed, or `reconnecting` would last forever.
      armWatchdogRef.current(HEARTBEAT_TIMEOUT_MS);
    };
    const delay = reconnectDelayMs(failuresRef.current);
    failuresRef.current += 1;
    feedTimings.count('conn.resubscribe');
    if (delay === 0) resubscribe();
    else retryTimerRef.current = setTimeout(resubscribe, delay);
  }, [clearWatchdog]);

  /** (Re)start the watchdog: `ms` from now with no frame means the connection is dead. */
  const armWatchdog = useCallback(
    (ms: number) => {
      clearWatchdog();
      heartbeatTimerRef.current = setTimeout(() => {
        heartbeatTimerRef.current = null;
        /*
         * A hidden page's timers are throttled or frozen, and one that comes due while
         * suspended fires the moment the page wakes, before the frames that queued up in the
         * meantime are dispatched. Silence while hidden proves nothing (bug 127), so do not
         * act on it: the resume check below tests the connection when the page is shown.
         */
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          feedTimings.count('conn.watchdog.deferred_hidden');
          return;
        }
        feedTimings.count('conn.lost.watchdog');
        handleConnectionLost();
      }, ms);
    },
    [clearWatchdog, handleConnectionLost]
  );
  armWatchdogRef.current = armWatchdog;

  /** Restart the watchdog. Called for every inbound frame, heartbeats included. */
  const noteFrameReceived = useCallback(() => {
    lastFrameWallRef.current = Date.now();
    offlineSinceFrameRef.current = false;
    armWatchdog(HEARTBEAT_TIMEOUT_MS);
  }, [armWatchdog]);

  /*
   * Test the connection at the moments a test is cheap: the page becoming visible, the page
   * being restored (`pageshow`), and the network coming back (`online`).
   *
   * History. A phone that locks, or a tab switched away from, has its timers throttled or
   * frozen, and a `setTimeout` that came due while suspended fires the moment the page is
   * shown, ahead of the frames queued meanwhile. The watchdog then reported a dead connection
   * purely because time passed in the background (#127). The first fix re-armed a fresh full
   * timeout on becoming visible, which is safe but means a phone unlocked with a *dead*
   * socket waited a further full timeout (baseline C2), and `online`/`offline` were ignored
   * entirely (C3).
   *
   * Now: on a resume, disarm the watchdog (an overdue timer must not beat the queued frames),
   * give the queue `RESUME_GRACE_MS` to deliver, and then decide (`decideAfterResume`): a
   * frame since the resume is proof of life; otherwise a last frame older than a heartbeat
   * interval plus a margin is a connection that missed a heartbeat, and we resubscribe at
   * once instead of waiting out the timeout. A healthy page frozen for minutes whose queued
   * frames were discarded can reach the second branch with nothing wrong: the cost is one
   * resubscribe that replays from the cursor (the panes dedupe by id) and, when it recovers
   * in under a second and nothing was missed, no divider in the feed.
   *
   * `offline` shows the banner at once but does not tear the subscription down: the socket
   * may well outlive a blip, and a frame clears the banner (#128).
   */
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    function runResumeCheck(resumedAt: number) {
      resumeTimerRef.current = null;
      const decision = decideAfterResume({
        now: Date.now(),
        lastFrameAt: lastFrameWallRef.current,
        resumedAt,
        offlineSinceLastFrame: offlineSinceFrameRef.current,
      });
      if (decision.action === 'lost') {
        feedTimings.count('conn.lost.resume');
        handleConnectionLost();
      } else if (decision.action === 'watch') {
        armWatchdog(decision.remainingMs);
      }
    }

    function onResume() {
      if (document.visibilityState === 'hidden') return;
      feedTimings.count('conn.visibility.reset');
      if (lastFrameWallRef.current === null) return;
      clearWatchdog();
      if (resumeTimerRef.current !== null) clearTimeout(resumeTimerRef.current);
      const resumedAt = Date.now();
      resumeTimerRef.current = setTimeout(() => runResumeCheck(resumedAt), RESUME_GRACE_MS);
    }

    function onOffline() {
      feedTimings.count('conn.offline');
      offlineSinceFrameRef.current = true;
      if (lastFrameWallRef.current === null) return;
      setConnected(false);
      setReconnecting(true);
    }

    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('pageshow', onResume);
    window.addEventListener('online', onResume);
    window.addEventListener('offline', onOffline);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('pageshow', onResume);
      window.removeEventListener('online', onResume);
      window.removeEventListener('offline', onOffline);
    };
  }, [armWatchdog, clearWatchdog, handleConnectionLost]);

  useEffect(
    () => () => {
      for (const timerRef of [heartbeatTimerRef, retryTimerRef, resumeTimerRef]) {
        if (timerRef.current !== null) clearTimeout(timerRef.current);
      }
    },
    []
  );

  const advanceTrackedCursor = useCallback((eventId: string) => {
    if (!shouldAdvanceEventCursor(eventId, latestTrackedEventIdRef.current)) return false;
    latestTrackedEventIdRef.current = eventId;
    return true;
  }, []);

  const fanOut = useCallback((tracked: TrackedRingFeedEvent) => {
    if (listenersRef.current.size === 0) {
      pendingEventsRef.current.push(tracked);
      return;
    }
    for (const listener of listenersRef.current) {
      listener(tracked);
    }
    // Live delivery reached current listeners; drop the startup buffer so we do not
    // replay stale frames to future subscribers. This means the buffer only covers
    // frames that arrive while *no* pane is registered — once any pane is listening,
    // a later registrant gets live events only. Safe because both panes register in
    // the same commit's useLayoutEffect, before the tRPC subscription's useEffect can
    // deliver anything.
    pendingEventsRef.current = [];
  }, []);

  const subscribe = useCallback((listener: (tracked: TrackedRingFeedEvent) => void) => {
    listenersRef.current.add(listener);
    // Replay buffered frames to each registrant so a second pane that layout-
    // registers after the first still sees the early handshake/live event.
    for (const tracked of pendingEventsRef.current) {
      listener(tracked);
    }
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const subscribeChat = useCallback((listener: (item: ChatFeedItem) => void) => {
    chatListenersRef.current.add(listener);
    return () => {
      chatListenersRef.current.delete(listener);
    };
  }, []);

  const fanOutChat = useCallback((item: ChatFeedItem) => {
    for (const listener of chatListenersRef.current) listener(item);
  }, []);

  /*
   * Advances the ref only, never the subscription input (baseline C4).
   *
   * This used to also write the history tail into the `lastEventId` state, which is part of
   * the subscription's input. Changing the input re-subscribes, so every page load opened the
   * feed twice: the second handshake read as a reconnect (a false "reconnected" divider
   * about 2.5 s after load) and on a slow link the first handshake took two round trips.
   * Nothing is lost by not doing it: a first subscribe with no cursor makes the server replay
   * its last 100 events, and the panes drop anything they already hold by id. The input's
   * cursor changes only when the connection is declared lost (`handleConnectionLost`) or
   * the room changes. The transport's own socket-level resume needs nothing from here: tRPC's
   * wsClient keeps the id of the last tracked frame it received on the request and re-sends
   * it when the socket reconnects (`wsLink` `request.message.params.lastEventId`).
   */
  const seedCursor = useCallback(
    (eventId: string) => {
      advanceTrackedCursor(eventId);
    },
    [advanceTrackedCursor]
  );

  trpc.game.ringFeed.useSubscription(
    { roomId, lastEventId: subLastEventId, resumeAttempt },
    {
      onData(frame: TrackedRingFeedEvent | ChatFrame) {
        feedTimings.count('conn.frame');
        lastFrameAtRef.current = timingNow();
        // A frame is proof of life, so a resubscribe still waiting out its backoff is moot.
        if (retryTimerRef.current !== null) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        // Chat frames are untracked and carry no `data`. Handle them first and return, so
        // nothing below (the room guard, the cursor, pane fan-out) ever sees one.
        if (isChatFrame(frame)) {
          noteFrameReceived();
          setConnected((wasConnected) => (wasConnected ? wasConnected : true));
          setReconnecting((wasReconnecting) => (wasReconnecting ? false : wasReconnecting));
          if (frame.payload.roomId === roomIdRef.current) {
            fanOutChat({ kind: 'message', message: frame.payload });
          }
          return;
        }
        const tracked = frame;
        const event = tracked.data;

        // Any frame proves the connection is alive — arm the watchdog before anything
        // else, including for the frame types dropped below.
        noteFrameReceived();

        /*
         * And that proof is not limited to handshakes. `reconnecting` used to clear only on
         * one, so a spurious watchdog trip on a subscription that was never actually dead
         * left the app "reconnecting" while it went on delivering events — a stranded
         * "connection lost" divider with the feed scrolling past it. A frame in hand beats
         * a timer's opinion. See 10b-bugs-fixed.md #128.
         */
        // Functional updaters that return the previous value when nothing has changed, so
        // the common case (a healthy feed) bails out of re-rendering rather than churning
        // once per frame.
        setConnected((wasConnected) => (wasConnected ? wasConnected : true));
        setReconnecting((wasReconnecting) => (wasReconnecting ? false : wasReconnecting));

        if (event.type === 'handshake') {
          feedTimings.count('conn.handshake');
          failuresRef.current = 0;
          if (!firstHandshakeRecordedRef.current) {
            firstHandshakeRecordedRef.current = true;
            feedTimings.since('conn.hook.first_render', 'conn.time_to_first_handshake');
          }
          if (awaitingReconnectRef.current) {
            awaitingReconnectRef.current = false;
            feedTimings.since('conn.lost', 'conn.reconnect');
          }
          handleHandshakeRef.current(event);
          // Fan out so RingPane can seed timer state from the handshake payload.
          fanOut(tracked);
          fanOutChat({ kind: 'connected' });
          return;
        }

        // Keep-alive — never advances the shared cursor.
        if (event.type === 'heartbeat') {
          feedTimings.count('conn.heartbeat');
          return;
        }

        // Defense in depth: drop events from another room (handshake/heartbeat
        // may omit roomId — only filter when it is a non-empty string).
        if (
          typeof event.roomId === 'string'
          && event.roomId !== ''
          && event.roomId !== roomIdRef.current
        ) {
          feedTimings.count('conn.cross_room_dropped');
          return;
        }

        advanceTrackedCursor(tracked.id);
        fanOut(tracked);
      },
      onError() {
        feedTimings.count('conn.lost.error');
        handleConnectionLost();
      },
    },
  );

  return { connected, reconnecting, subscribe, seedCursor, subscribeChat };
}

export function RingFeedProvider({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  const api = useRingFeed(roomId);
  return <RingFeedContext.Provider value={api}>{children}</RingFeedContext.Provider>;
}

export function useRingFeedContext(): RingFeedApi {
  const ctx = useContext(RingFeedContext);
  if (!ctx) {
    throw new Error('useRingFeedContext must be used within RingFeedProvider');
  }
  return ctx;
}

/**
 * Subscribe a pane to the shared feed. Uses a ref so listener identity changes
 * do not resubscribe or restart the underlying tRPC subscription.
 * Registers in useLayoutEffect so listeners exist before the parent's
 * useEffect-based tRPC subscription can deliver the first frame.
 */
export function useRingFeedListener(
  listener: (tracked: TrackedRingFeedEvent) => void,
): Pick<RingFeedApi, 'connected' | 'reconnecting' | 'seedCursor'> {
  const { connected, reconnecting, subscribe, seedCursor } = useRingFeedContext();
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useLayoutEffect(() => {
    return subscribe((tracked) => {
      listenerRef.current(tracked);
    });
  }, [subscribe]);

  return { connected, reconnecting, seedCursor };
}
