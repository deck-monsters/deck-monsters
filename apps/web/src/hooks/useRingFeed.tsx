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
import type { GameEvent } from '@deck-monsters/server/types';
import { trpc } from '../lib/trpc.js';
import { shouldAdvanceEventCursor } from '../utils/ring-feed-cursor.js';
import { useHandshake } from './useHandshake.js';

export type TrackedRingFeedEvent = { id: string; data: GameEvent };

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
};

/**
 * How long to wait for *any* frame before treating the connection as dead.
 *
 * The server sends a keep-alive `heartbeat` every 20s (`trpc/router.ts`). Nothing used
 * to watch for those stopping, so `connected` only flipped when the transport itself
 * raised an error — and a connection that dies silently (a backgrounded phone, a network
 * that blackholes rather than resets) left the app showing no "reconnecting…" banner
 * while quietly missing events. 2.5x the interval tolerates a late frame without
 * declaring a healthy connection dead.
 */
export const HEARTBEAT_TIMEOUT_MS = 50_000;

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
   * that was working fine and no "reconnected" line after it. See 10-bug-fixes.md D.
   */
  const [resumeAttempt, setResumeAttempt] = useState(0);
  const latestTrackedEventIdRef = useRef<string | undefined>(undefined);
  const listenersRef = useRef(new Set<(tracked: TrackedRingFeedEvent) => void>());
  // Events that arrive before any pane listener is registered (e.g. sync delivery
  // during the subscribe call in render) are buffered and flushed on subscribe.
  const pendingEventsRef = useRef<TrackedRingFeedEvent[]>([]);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    pendingEventsRef.current = [];
    // The previous room's watchdog must die with it. RingFeedProvider is not re-keyed
    // per room, so a timer left armed here fires later against the *new* room and drops
    // a healthy connection into "reconnecting…", which only a real handshake clears.
    if (heartbeatTimerRef.current !== null) {
      clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }

  /**
   * Mark the subscription dead and re-subscribe from the last event we saw. Shared by
   * the transport's own `onError` and the heartbeat watchdog so both produce identical
   * state and the same resume cursor.
   */
  const handleConnectionLost = useCallback(() => {
    setConnected(false);
    setReconnecting(true);
    setSubLastEventId(latestTrackedEventIdRef.current);
    setResumeAttempt((attempt) => attempt + 1);
  }, []);

  /** Restart the watchdog. Called for every inbound frame, heartbeats included. */
  const noteFrameReceived = useCallback(() => {
    if (heartbeatTimerRef.current !== null) clearTimeout(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setTimeout(handleConnectionLost, HEARTBEAT_TIMEOUT_MS);
  }, [handleConnectionLost]);

  /*
   * A phone that locks, or a tab switched away from, has its timers throttled or frozen —
   * and a `setTimeout` that came due while suspended fires the moment the page is shown
   * again. The watchdog then reports a dead connection purely because time passed with the
   * page in the background, which is not evidence of anything: no frames can arrive while
   * the page is suspended whether the socket is healthy or not.
   *
   * So on becoming visible, give the connection a fresh full interval to prove itself
   * instead of acting on a timer that expired in the background. A genuinely dead
   * connection still trips it one interval later. See 10-bug-fixes.md D.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return;

    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      if (heartbeatTimerRef.current === null) return;
      noteFrameReceived();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [noteFrameReceived]);

  useEffect(
    () => () => {
      if (heartbeatTimerRef.current !== null) clearTimeout(heartbeatTimerRef.current);
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

  const seedCursor = useCallback((eventId: string) => {
    if (!advanceTrackedCursor(eventId)) return;
    setSubLastEventId((prev) => {
      if (!shouldAdvanceEventCursor(eventId, prev)) return prev;
      return eventId;
    });
  }, [advanceTrackedCursor]);

  trpc.game.ringFeed.useSubscription(
    { roomId, lastEventId: subLastEventId, resumeAttempt },
    {
      onData(tracked: TrackedRingFeedEvent) {
        const event = tracked.data;

        // Any frame proves the connection is alive — arm the watchdog before anything
        // else, including for the frame types dropped below.
        noteFrameReceived();

        if (event.type === 'handshake') {
          handleHandshakeRef.current(event);
          setConnected(true);
          setReconnecting(false);
          // Fan out so RingPane can seed timer state from the handshake payload.
          fanOut(tracked);
          return;
        }

        // Keep-alive — never advances the shared cursor.
        if (event.type === 'heartbeat') return;

        // Defense in depth: drop events from another room (handshake/heartbeat
        // may omit roomId — only filter when it is a non-empty string).
        if (
          typeof event.roomId === 'string'
          && event.roomId !== ''
          && event.roomId !== roomIdRef.current
        ) {
          return;
        }

        advanceTrackedCursor(tracked.id);
        fanOut(tracked);
      },
      onError() {
        handleConnectionLost();
      },
    },
  );

  return { connected, reconnecting, subscribe, seedCursor };
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
