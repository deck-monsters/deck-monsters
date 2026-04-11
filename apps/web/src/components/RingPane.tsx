import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import type { GameEvent } from '@deck-monsters/server/types';
import { trpc } from '../lib/trpc.js';
import { useHandshake } from '../hooks/useHandshake.js';
import { useRingKeyTimestamps } from '../hooks/useRingKeyTimestamps.js';
import { useTimeAgo } from '../hooks/useTimeAgo.js';
import { formatEventText } from '../utils/format-event-text.js';
import { fightTitleOneLine, type FightSummaryLike } from '../utils/fight-display.js';
import {
	eventTimestampIso,
	formatEventHoverTitle,
	getKeyRingEventMeta,
} from '../utils/event-time.js';
import { shouldRenderRingEvent } from '../utils/ring-feed-events.js';

type TrackedEvent = { id: string; data: GameEvent };

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

function KeyRingTimeBadge({ at, label }: { at: Date; label: string }) {
  const ago = useTimeAgo(at);
  return (
    <span className="event-key-meta" aria-hidden="true">
      <span className="event-key-label">{label}</span>
      <span className="event-key-time">{ago}</span>
    </span>
  );
}

function LastFightRelativeAgo({ at }: { at: Date }) {
  const ago = useTimeAgo(at);
  return <> — {ago}</>;
}

function LastFightFooter({
  summary,
  showRelative,
}: {
  summary: FightSummaryLike & { fightNumber: number; endedAt: string | Date };
  showRelative: boolean;
}) {
  const ended = new Date(summary.endedAt);
  const title = formatEventHoverTitle(ended.getTime());
  return (
    <div
      className="last-fight-footer"
      style={{
        padding: '0.35rem 0.75rem',
        fontSize: '0.8rem',
        borderTop: '1px solid var(--color-border)',
        color: 'var(--color-fg-dim)',
      }}
      data-event-at={ended.toISOString()}
      title={title}
    >
      <time className="event-sr-only" dateTime={ended.toISOString()}>
        {title}
      </time>
      Last fight: {fightTitleOneLine(summary)} (#{summary.fightNumber})
      {showRelative ? <LastFightRelativeAgo at={ended} /> : null}
    </div>
  );
}

// Virtuoso List component — renders as <ol> for semantic HTML.
// Cast through any because Virtuoso's List type expects HTMLDivElement internally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FeedList = React.forwardRef<any, any>((props, ref) => <ol {...props} ref={ref} />);
FeedList.displayName = 'FeedList';

export default function RingPane({ roomId, isActive, onEvent }: RingPaneProps) {
  const { ringKeyTimestampsEnabled } = useRingKeyTimestamps();
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
  // Resume cursor for reconnects. We keep this stable during normal streaming,
  // and only update it on connection errors so we don't restart the subscription
  // on every incoming event.
  const [subLastEventId, setSubLastEventId] = useState<string | undefined>(undefined);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const seenRef = useRef(new Set<string>());
  const latestTrackedEventIdRef = useRef<string | undefined>(undefined);
  const historyApplied = useRef(false);
  const { handleHandshakeEvent } = useHandshake();

  // Fetch persistent ring history from DB on mount
  const { data: history } = trpc.game.ringHistory.useQuery({ roomId });

  const { data: lastFight } = trpc.game.recentFights.useQuery({ roomId, limit: 1 });

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

    const visibleHistory = dedupedHistory.filter(shouldRenderRingEvent);

    // Merge history with any live events that arrived before history loaded.
    // Live events take priority over history events with the same ID.
    setEvents(prev => {
      if (prev.length === 0) return visibleHistory;
      const liveById = new Map(prev.map(ev => [ev.id, ev]));
      const merged: GameEvent[] = visibleHistory.map(ev => liveById.get(ev.id) ?? ev);
      const historyIds = new Set(visibleHistory.map(ev => ev.id));
      for (const ev of prev) {
        if (!historyIds.has(ev.id)) merged.push(ev);
      }
      return merged;
    });

    // Jump to bottom after history loads (instant, no animation)
    requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'auto' });
    });
  }, [history]);

  // Scroll to bottom when this pane becomes active (tab switch)
  useEffect(() => {
    if (isActive) {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'auto' });
      setIsAtBottom(true);
    }
  }, [isActive]);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
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

        // Keep-alive ping from server — no UI action needed
        if (event.type === 'heartbeat') return;

        // ring.state is a state-sync signal — update timers but don't show in the feed
        if (event.type === 'ring.state') {
          latestTrackedEventIdRef.current = tracked.id;
          const s = event.payload as unknown as TimerState;
          setTimerState({ nextFightAt: s.nextFightAt, nextBossSpawnAt: s.nextBossSpawnAt, monsterCount: s.monsterCount });
          return;
        }

        latestTrackedEventIdRef.current = tracked.id;
        if (!shouldRenderRingEvent(event)) return;

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
        setSubLastEventId(latestTrackedEventIdRef.current);
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

      <Virtuoso
        ref={virtuosoRef}
        className="event-feed"
        role="log"
        aria-live="polite"
        aria-label="Ring events"
        tabIndex={0}
        data={events}
        followOutput="smooth"
        components={{
          List: FeedList,
          EmptyPlaceholder: () => (
            <li className="event event-system">
              <p>Waiting for battle events…</p>
            </li>
          ),
        }}
        itemContent={(_, event) => {
          const keyMeta = getKeyRingEventMeta(event);
          const iso = eventTimestampIso(event.timestamp);
          const hoverTitle = formatEventHoverTitle(event.timestamp);
          const showKeyColumn = ringKeyTimestampsEnabled && keyMeta;
          return (
            <li
              className={`event ${eventClass(event.type)}`}
              data-event-at={iso}
              title={hoverTitle}
            >
              <time className="event-sr-only" dateTime={iso}>
                {hoverTitle}
              </time>
              {showKeyColumn ? (
                <div className="event-row-inner">
                  <div className="event-text">{formatEventText(event.text ?? '')}</div>
                  <KeyRingTimeBadge at={new Date(event.timestamp)} label={keyMeta.label} />
                </div>
              ) : (
                <div className="event-text">{formatEventText(event.text ?? '')}</div>
              )}
            </li>
          );
        }}
        atBottomStateChange={(atBottom) => setIsAtBottom(atBottom)}
      />

      {lastFight?.[0] && (
        <LastFightFooter
          summary={lastFight[0] as FightSummaryLike & { fightNumber: number; endedAt: string }}
          showRelative={ringKeyTimestampsEnabled}
        />
      )}

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
