import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameEvent } from '@deck-monsters/server/types';

type TrackedEvent = { id: string; data: GameEvent };
import { trpc } from '../lib/trpc.js';
import { useHandshake } from '../hooks/useHandshake.js';
import { formatEventText } from '../utils/format-event-text.js';

interface RingPaneProps {
  roomId: string;
  isActive: boolean;
  /** Called with each incoming event so Terminal can track lastEventId */
  onEvent?: (event: unknown) => void;
}

interface TimerState {
  nextFightAt: number | null;
  nextBossSpawnAt: number | null;
  monsterCount: number;
}

const RING_TYPES = new Set([
  'ring.add', 'ring.remove', 'ring.clear', 'ring.countdown', 'ring.fight',
  'ring.win', 'ring.loss', 'ring.draw', 'ring.fled', 'ring.permaDeath',
  'ring.xp', 'ring.cardDrop', 'card.played',
]);

function eventClass(type: string): string {
  if (RING_TYPES.has(type)) return 'event-ring';
  if (type === 'system') return 'event-system';
  return 'event-announce';
}

/** Returns a human-readable countdown string from an epoch-ms timestamp. */
function formatCountdown(epochMs: number): string {
  const deltaMs = epochMs - Date.now();
  if (deltaMs <= 0) return 'now';
  const totalSeconds = Math.ceil(deltaMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.ceil((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function RingPane({ roomId, isActive, onEvent }: RingPaneProps) {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  // Timer state is pushed from the server via ring.state events and the handshake payload.
  // No HTTP polling needed.
  const [timerState, setTimerState] = useState<TimerState>({
    nextFightAt: null,
    nextBossSpawnAt: null,
    monsterCount: 0,
  });
  // Stable subscription input — set once from history, never changed on re-renders.
  // Passing a ref directly causes tRPC to restart the subscription on every state
  // change (HAR showed 6 subscriptions in 0.5s). Using useState keeps the input stable.
  const [subLastEventId, setSubLastEventId] = useState<string | undefined>(undefined);
  const feedRef = useRef<HTMLOListElement>(null);
  const seenRef = useRef(new Set<string>());
  const historyApplied = useRef(false);
  const { handleHandshakeEvent } = useHandshake();

  // Fetch persistent ring history from DB on mount
  const { data: history } = trpc.game.ringHistory.useQuery({ roomId });

  // Tick every second while a fight or boss timer is active, to keep the badge live
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!timerState.nextFightAt && !timerState.nextBossSpawnAt) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [timerState.nextFightAt, timerState.nextBossSpawnAt]);

  // Apply DB history once — pre-populate seenRef and seed the stable subscription
  // lastEventId so the live subscription skips already-delivered events.
  useEffect(() => {
    if (!history || historyApplied.current) return;
    historyApplied.current = true;

    // Deduplicate history by event ID (handles legacy duplicate rows in DB)
    const seen = new Set<string>();
    const dedupedHistory: GameEvent[] = [];
    for (const ev of history) {
      if (!seen.has(ev.id)) {
        seen.add(ev.id);
        dedupedHistory.push(ev);
      }
    }

    for (const ev of dedupedHistory) {
      seenRef.current.add(ev.id);
    }

    // Merge history with any live events that arrived before history loaded.
    // Live events take priority over history events with the same ID.
    setEvents(prev => {
      if (prev.length === 0) return dedupedHistory;
      const liveById = new Map(prev.map(ev => [ev.id, ev]));
      const merged: GameEvent[] = dedupedHistory.map(ev => liveById.get(ev.id) ?? ev);
      const historyIds = new Set(dedupedHistory.map(ev => ev.id));
      for (const ev of prev) {
        if (!historyIds.has(ev.id)) merged.push(ev);
      }
      return merged;
    });

    const last = dedupedHistory[dedupedHistory.length - 1];
    // Only use event UUIDs (not the hist:N fallback) as lastEventId — the
    // subscription's getEventsSince only understands in-memory UUIDs.
    if (last?.id && !last.id.startsWith('hist:')) {
      setSubLastEventId(last.id);
    }
    // Scroll to bottom after history loads so we start at the latest message
    requestAnimationFrame(() => {
      if (feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }
    });
  }, [history]);

  // Scroll to bottom when this pane becomes active (tab switch)
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => {
        if (feedRef.current) {
          feedRef.current.scrollTop = feedRef.current.scrollHeight;
          setIsAtBottom(true);
        }
      });
    }
  }, [isActive]);

  // Auto-scroll to bottom when new events arrive, if the user hasn't scrolled up
  useEffect(() => {
    if (isAtBottom && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events, isAtBottom]);

  const handleScroll = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
    setIsAtBottom(true);
  }, []);

  trpc.game.ringFeed.useSubscription(
    { roomId, lastEventId: subLastEventId },
    {
      onData(tracked: TrackedEvent) {
        const event = tracked.data;

        if (event.type === 'handshake') {
          handleHandshakeEvent(event);
          setConnected(true);
          setReconnecting(false);
          // Seed timer state from the handshake payload so we have instant values
          const hs = event.payload as { ringState?: unknown };
          if (hs.ringState) setTimerState(hs.ringState as TimerState);
          return;
        }

        // ring.state is a state-sync signal — update timers but don't show in the feed
        if (event.type === 'ring.state') {
          const s = event.payload as unknown as TimerState;
          setTimerState({ nextFightAt: s.nextFightAt, nextBossSpawnAt: s.nextBossSpawnAt, monsterCount: s.monsterCount });
          return;
        }

        // Only show public events in the Ring pane
        if (event.scope !== 'public') return;

        if (seenRef.current.has(tracked.id)) return;
        seenRef.current.add(tracked.id);

        setEvents(prev => [...prev, event]);
        onEvent?.(event);
      },
      onError() {
        setConnected(false);
        setReconnecting(true);
      },
    }
  );

  // Compute the timer badge inline — tick state re-renders every second to keep it current
  let timerBadge: string | null = null;
  if (timerState.nextFightAt) {
    const delta = timerState.nextFightAt - Date.now();
    timerBadge = delta <= 0 ? 'fight now!' : `fight in ${formatCountdown(timerState.nextFightAt)}`;
  } else if (timerState.nextBossSpawnAt) {
    timerBadge = `boss in ~${formatCountdown(timerState.nextBossSpawnAt)}`;
  }

  return (
    <section
      className={`terminal-pane${isActive ? ' active' : ''}`}
      aria-label="The Ring — public battle feed"
    >
      <header className="pane-header">
        <span>The Ring</span>
        {timerBadge && (
          <span className="pane-header-timer" title="Time until next ring event">
            {timerBadge}
          </span>
        )}
        {!connected && !reconnecting && <span style={{ color: 'var(--color-fg-dim)' }}>connecting…</span>}
        {reconnecting && <span style={{ color: 'var(--color-accent)' }}>reconnecting…</span>}
      </header>

      {reconnecting && (
        <div className="connection-banner reconnecting" role="status">
          -- reconnecting --
        </div>
      )}

      <ol
        ref={feedRef}
        className="event-feed"
        role="log"
        aria-live="polite"
        aria-label="Ring events"
        onScroll={handleScroll}
        tabIndex={0}
      >
        {events.length === 0 && (
          <li className="event event-system">
            <p>Waiting for battle events…</p>
          </li>
        )}
        {events.map((event) => (
          <li key={event.id} className={`event ${eventClass(event.type)}`}>
            <time dateTime={new Date(event.timestamp).toISOString()} aria-hidden="true">
              {new Date(event.timestamp).toLocaleTimeString()}
            </time>
            <div className="event-text">{formatEventText(event.text ?? '')}</div>
          </li>
        ))}
      </ol>

      {!isAtBottom && (
        <button
          className="jump-to-bottom"
          onClick={scrollToBottom}
          aria-label="Jump to latest events"
        >
          ↓ Latest
        </button>
      )}
    </section>
  );
}
