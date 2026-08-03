import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { GameEvent } from '@deck-monsters/server/types';
import { trpc } from '../lib/trpc.js';
import { useHandshake } from './useHandshake.js';

export type TrackedRingFeedEvent = { id: string; data: GameEvent };

export type RingFeedApi = {
  connected: boolean;
  reconnecting: boolean;
  /** Register a pane listener. Returns unsubscribe. Listener identity may change freely. */
  subscribe: (listener: (tracked: TrackedRingFeedEvent) => void) => () => void;
  /** Seed reconnect cursor from DB history when no live/persisted id is tracked yet. */
  seedCursor: (eventId: string) => void;
};

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
  const latestTrackedEventIdRef = useRef<string | undefined>(undefined);
  const listenersRef = useRef(new Set<(tracked: TrackedRingFeedEvent) => void>());
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  // Reset shared cursor / connection flags when navigating to another room.
  // Adjust state during render so the subscription input never briefly carries
  // the previous room's cursor.
  const [cursorRoomId, setCursorRoomId] = useState(roomId);
  if (cursorRoomId !== roomId) {
    setCursorRoomId(roomId);
    setSubLastEventId(undefined);
    setConnected(false);
    setReconnecting(false);
    latestTrackedEventIdRef.current = undefined;
    listenersRef.current.clear();
  }

  const subscribe = useCallback((listener: (tracked: TrackedRingFeedEvent) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const seedCursor = useCallback((eventId: string) => {
    if (latestTrackedEventIdRef.current !== undefined) return;
    latestTrackedEventIdRef.current = eventId;
    setSubLastEventId(eventId);
  }, []);

  const fanOut = useCallback((tracked: TrackedRingFeedEvent) => {
    for (const listener of listenersRef.current) {
      listener(tracked);
    }
  }, []);

  trpc.game.ringFeed.useSubscription(
    { roomId, lastEventId: subLastEventId },
    {
      onData(tracked: TrackedRingFeedEvent) {
        const event = tracked.data;

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

        latestTrackedEventIdRef.current = tracked.id;
        fanOut(tracked);
      },
      onError() {
        setConnected(false);
        setReconnecting(true);
        setSubLastEventId(latestTrackedEventIdRef.current);
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
 */
export function useRingFeedListener(
  listener: (tracked: TrackedRingFeedEvent) => void,
): Pick<RingFeedApi, 'connected' | 'reconnecting' | 'seedCursor'> {
  const { connected, reconnecting, subscribe, seedCursor } = useRingFeedContext();
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    return subscribe((tracked) => {
      listenerRef.current(tracked);
    });
  }, [subscribe]);

  return { connected, reconnecting, seedCursor };
}
