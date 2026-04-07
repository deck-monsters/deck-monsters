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
  const feedRef = useRef<HTMLOListElement>(null);
  const seenRef = useRef(new Set<string>());
  const lastEventIdRef = useRef<string | undefined>(undefined);
  const historyApplied = useRef(false);
  const { handleHandshakeEvent } = useHandshake();
  const utils = trpc.useUtils();

  // Fetch persistent ring history from DB on mount
  const { data: history } = trpc.game.ringHistory.useQuery({ roomId });

  // Fetch ring timer state, refreshed every 15s
  const { data: ringState } = trpc.game.ringState.useQuery(
    { roomId },
    { refetchInterval: 15_000 }
  );

  // Tick every second to keep the countdown badge live
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!ringState?.nextFightAt && !ringState?.nextBossSpawnAt) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [ringState?.nextFightAt, ringState?.nextBossSpawnAt]);

  // Apply DB history once — pre-populate seenRef and set lastEventIdRef so
  // the live subscription skips already-delivered events.
  useEffect(() => {
    if (!history || historyApplied.current) return;
    historyApplied.current = true;
    for (const ev of history) {
      seenRef.current.add(ev.id);
    }
    setEvents(history);
    const last = history[history.length - 1];
    // Only use event UUIDs (not the hist:N fallback) as lastEventId — the
    // subscription's getEventsSince only understands in-memory UUIDs.
    if (last?.id && !last.id.startsWith('hist:')) {
      lastEventIdRef.current = last.id;
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
    { roomId, lastEventId: lastEventIdRef.current },
    {
      onData(tracked: TrackedEvent) {
        const event = tracked.data;

        if (event.type === 'handshake') {
          handleHandshakeEvent(event);
          setConnected(true);
          setReconnecting(false);
          return;
        }

        // Only show public events in the Ring pane
        if (event.scope !== 'public') return;

        if (seenRef.current.has(tracked.id)) return;
        seenRef.current.add(tracked.id);
        lastEventIdRef.current = tracked.id;

        setEvents(prev => [...prev, event]);
        onEvent?.(event);

        // Refetch ring timer state immediately when the ring situation changes
        if (event.type === 'ring.add' || event.type === 'ring.remove' ||
            event.type === 'ring.clear' || event.type === 'ring.fight') {
          void utils.game.ringState.invalidate({ roomId });
        }
      },
      onError() {
        setConnected(false);
        setReconnecting(true);
      },
    }
  );

  // Compute the timer badge inline — tick state re-renders every second to keep it current
  let timerBadge: string | null = null;
  if (ringState?.nextFightAt) {
    const delta = ringState.nextFightAt - Date.now();
    timerBadge = delta <= 0 ? 'fight now!' : `fight in ${formatCountdown(ringState.nextFightAt)}`;
  } else if (ringState?.nextBossSpawnAt) {
    timerBadge = `boss in ~${formatCountdown(ringState.nextBossSpawnAt)}`;
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
