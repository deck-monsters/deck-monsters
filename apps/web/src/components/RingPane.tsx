import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ComponentType,
  type ReactNode,
} from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import type { GameEvent } from '@deck-monsters/server/types';
import { trpc } from '../lib/trpc.js';
import { useRingFeedListener, type TrackedRingFeedEvent } from '../hooks/useRingFeed.js';
import { useRingKeyTimestamps } from '../hooks/useRingKeyTimestamps.js';
import { AT_BOTTOM_THRESHOLD_PX, useFeedAutoScroll } from '../hooks/useFeedAutoScroll.js';
import { useTimeAgo } from '../hooks/useTimeAgo.js';
import { formatEventText } from '../utils/format-event-text.js';
import { fightTitleOneLine, type FightSummaryLike } from '../utils/fight-display.js';
import {
	eventTimestampIso,
	formatEventHoverTitle,
	getKeyRingEventMeta,
} from '../utils/event-time.js';
import { shouldRenderRingEvent } from '../utils/ring-feed-events.js';
import {
	createFeedMarker,
	feedMarkerKind,
	isFeedMarker,
	shouldAppendMarker,
} from '../utils/feed-markers.js';
import RingRoster, { type RingContestantSnapshot } from './RingRoster.js';
import FeedList from './FeedList.js';
import RingItemsPanel from './RingItemsPanel.js';
import { useThemeFeature } from '../hooks/useTheme.js';

type PixelFightLayerProps = {
  contestants: RingContestantSnapshot[];
  viewerUserId: string | null;
  /** Optional on the wire, so it stays optional here — see RingStateFrame. */
  inEncounter?: boolean;
};
type PixelFightLayerLoader = () => Promise<{ default: ComponentType<PixelFightLayerProps> }>;
const loadPixelFightLayer: PixelFightLayerLoader = () => import('../animations/pixel-fight/PixelFightLayer.js');

interface RingPaneProps {
  roomId: string;
  isActive: boolean;
  headerActions?: ReactNode;
  /** Injectable loader keeps the theme gate testable without preloading the chunk. */
  pixelFightLayerLoader?: PixelFightLayerLoader;
}

interface TimerState {
  nextFightAt: number | null;
  nextBossSpawnAt: number | null;
  monsterCount: number;
  inEncounter?: boolean;
  contestants?: RingContestantSnapshot[];
}

const ROSTER_COLLAPSED_KEY = 'dm:ringRosterCollapsed';

/**
 * How long to wait after a reconnect for the replayed catch-up to land before drawing the
 * "reconnected" divider anyway. Long enough for a burst of replayed events to arrive in
 * one go, short enough that the bracket never looks abandoned.
 */
const RECONNECT_MARKER_GRACE_MS = 2_500;

function readRosterCollapsed(): boolean {
  try {
    return window.localStorage.getItem(ROSTER_COLLAPSED_KEY) === '1';
  } catch {
    // Private mode / blocked storage — default to expanded.
    return false;
  }
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


export default function RingPane({
  roomId,
  isActive,
  headerActions,
  pixelFightLayerLoader = loadPixelFightLayer,
}: RingPaneProps) {
  const { ringKeyTimestampsEnabled } = useRingKeyTimestamps();
  const pixelArtEnabled = useThemeFeature('pixel-art');
  const PixelFightLayer = useMemo(() => lazy(pixelFightLayerLoader), [pixelFightLayerLoader]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  // Timer state is pushed from the server via ring.state events and the handshake payload.
  // No HTTP polling needed.
  const [timerState, setTimerState] = useState<TimerState>({
    nextFightAt: null,
    nextBossSpawnAt: null,
    monsterCount: 0,
    contestants: [],
  });
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [rosterCollapsed, setRosterCollapsed] = useState(readRosterCollapsed);

  // Close the "connection lost" bracket. Called either by the first event that postdates
  // the reconnect, or by a grace timer — whichever comes first.
  //
  // The timer is not belt-and-braces, it is the guarantee. Waiting on a qualifying event
  // alone leaves the bracket open forever in two real cases: a quiet ring, where nothing
  // public may follow a reconnect for minutes; and clock skew, where a server timestamp
  // can trail the client `Date.now()` captured at handshake so the comparison never
  // becomes true. Either would leave a "connection lost" divider dangling over a feed
  // that had in fact recovered — worse than no divider at all.
  const flushReconnectMarker = useCallback(() => {
    if (reconnectMarkerTimerRef.current !== null) {
      clearTimeout(reconnectMarkerTimerRef.current);
      reconnectMarkerTimerRef.current = null;
    }
    const pendingAt = pendingReconnectAtRef.current;
    if (pendingAt === null) return;
    pendingReconnectAtRef.current = null;
    setEvents(prev =>
      shouldAppendMarker(prev) ? [...prev, createFeedMarker('reconnected', pendingAt)] : prev
    );
  }, []);

  useEffect(
    () => () => {
      if (reconnectMarkerTimerRef.current !== null) clearTimeout(reconnectMarkerTimerRef.current);
    },
    []
  );

  const toggleRoster = useCallback(() => {
    setRosterCollapsed(prev => {
      const next = !prev;
      try {
        window.localStorage.setItem(ROSTER_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // Preference is a convenience only — ignore storage failures.
      }
      return next;
    });
  }, []);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const autoScroll = useFeedAutoScroll(virtuosoRef);
  const seenRef = useRef(new Set<string>());
  const historyApplied = useRef(false);
  // True once the first handshake has landed, so a later handshake is a *re*connect.
  const hasConnectedRef = useRef(false);
  // True once any live ring.state (handshake or push) has been applied to timerState.
  // Distinguishes "no live data yet, fall back to the polled query" from "a live push
  // legitimately emptied the roster" (e.g. clearRing() after a fight ends) — both left
  // timerState.contestants as an empty array, so a length check alone could not tell
  // them apart and was reverting to a stale polled snapshot right when the fight-end
  // roster mattered most.
  const hasLiveTimerStateRef = useRef(false);
  // Set when a reconnect handshake arrives. The replayed catch-up arrives after the
  // handshake but carries timestamps from *during* the outage, so drawing "reconnected"
  // at handshake time would put it above events the reader actually missed. Holding it
  // until the first genuinely-new event lands closes the bracket in the right place.
  const pendingReconnectAtRef = useRef<number | null>(null);
  const reconnectMarkerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch persistent ring history from DB on mount
  const { data: history } = trpc.game.ringHistory.useQuery({ roomId });

  const { data: lastFight } = trpc.game.recentFights.useQuery({ roomId, limit: 1 });

  // Boss summon charges are per-user, so unlike the timers they come from this
  // membership-checked query rather than the public ring.state broadcast.
  const { data: ringState, refetch: refetchRingState } = trpc.game.ringState.useQuery(
    { roomId },
    { refetchInterval: 60_000 }
  );

  // Tick every second while a fight or boss timer is active, to keep the badge live
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!timerState.nextFightAt && !timerState.nextBossSpawnAt) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [timerState.nextFightAt, timerState.nextBossSpawnAt]);

  const onLiveEvent = useCallback((tracked: TrackedRingFeedEvent) => {
    const event = tracked.data;

    if (event.type === 'handshake') {
      // Seed timer state from the handshake payload so we have instant values
      const hs = event.payload as { ringState?: unknown; yourUserId?: string };
      if (hs.ringState) {
        hasLiveTimerStateRef.current = true;
        setTimerState(hs.ringState as TimerState);
      }
      if (hs.yourUserId) setMyUserId(hs.yourUserId);
      if (hasConnectedRef.current) {
        pendingReconnectAtRef.current = Date.now();
        if (reconnectMarkerTimerRef.current !== null) {
          clearTimeout(reconnectMarkerTimerRef.current);
        }
        reconnectMarkerTimerRef.current = setTimeout(
          flushReconnectMarker,
          RECONNECT_MARKER_GRACE_MS
        );
      }
      hasConnectedRef.current = true;
      return;
    }

    // ring.state is a state-sync signal — update timers but don't show in the feed
    if (event.type === 'ring.state') {
      const s = event.payload as unknown as TimerState;
      hasLiveTimerStateRef.current = true;
      setTimerState({
        nextFightAt: s.nextFightAt,
        nextBossSpawnAt: s.nextBossSpawnAt,
        monsterCount: s.monsterCount,
        inEncounter: s.inEncounter,
        contestants: s.contestants ?? [],
      });
      return;
    }

    if (!shouldRenderRingEvent(event)) return;

    // Only show public events in the Ring pane
    if (event.scope !== 'public') return;

    if (seenRef.current.has(tracked.id)) return;
    seenRef.current.add(tracked.id);

    // Ring membership changed — a summon may have been spent, so refresh the charges.
    if (event.type === 'ring.add' || event.type === 'ring.clear') {
      void refetchRingState();
    }

    // Replayed catch-up events are older than the reconnect, so they sort above the
    // marker; the first event that actually postdates it closes the bracket early.
    const pendingAt = pendingReconnectAtRef.current;
    if (pendingAt !== null && event.timestamp >= pendingAt) flushReconnectMarker();

    setEvents(prev => [...prev, event]);
  }, [refetchRingState, flushReconnectMarker]);

  const { connected, reconnecting, seedCursor } = useRingFeedListener(onLiveEvent);

  // Draw the divider the moment the connection drops, so the reader can see where the
  // feed stopped being live rather than discovering a hole in it later.
  useEffect(() => {
    if (!reconnecting) return;
    setEvents(prev => (shouldAppendMarker(prev) ? [...prev, createFeedMarker('disconnected')] : prev));
  }, [reconnecting]);

  /*
   * Close the divider whenever the connection is proven alive again, not only when a
   * handshake says so. The pair used to be asymmetric — opened by the `reconnecting` flag,
   * closed by a handshake — so any recovery without one left "connection lost" stranded in
   * the feed with events scrolling past it, which reads as a feed that broke and kept
   * going. Symmetry is the fix: whatever opens the divider closes it.
   *
   * Still routed through the same grace timer, because replayed catch-up events carry
   * timestamps from during the outage and would otherwise sort above the marker.
   * `shouldAppendMarker` keeps this from doubling up with the handshake path.
   * See 10b-bugs-fixed.md #128.
   */
  const wasReconnectingRef = useRef(false);
  useEffect(() => {
    const wasReconnecting = wasReconnectingRef.current;
    wasReconnectingRef.current = reconnecting;
    if (reconnecting || !wasReconnecting) return;

    pendingReconnectAtRef.current ??= Date.now();
    if (reconnectMarkerTimerRef.current !== null) clearTimeout(reconnectMarkerTimerRef.current);
    reconnectMarkerTimerRef.current = setTimeout(flushReconnectMarker, RECONNECT_MARKER_GRACE_MS);
  }, [reconnecting, flushReconnectMarker]);

  // Apply DB history once — pre-populate seenRef and seed the shared subscription
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
      // Everything above this line happened before the page was opened. Without it a
      // stat card from a previous session abuts an unrelated fight from this one.
      const boundary = visibleHistory.length > 0 ? [createFeedMarker('joined')] : [];

      if (prev.length === 0) return [...visibleHistory, ...boundary];

      const liveById = new Map(prev.map(ev => [ev.id, ev]));
      const merged: GameEvent[] = visibleHistory.map(ev => liveById.get(ev.id) ?? ev);
      const historyIds = new Set(visibleHistory.map(ev => ev.id));
      merged.push(...boundary);
      for (const ev of prev) {
        if (!historyIds.has(ev.id)) merged.push(ev);
      }
      return merged;
    });

    // Seed the shared resume cursor from history so a reconnect doesn't restart from
    // the beginning. Only when no live event has been tracked yet — history lands
    // asynchronously, and clobbering a newer live cursor with the older history tail
    // just forces a redundant replay.
    if (dedupedHistory.length > 0) {
      seedCursor(dedupedHistory[dedupedHistory.length - 1]!.id);
    }

    if (autoScroll.shouldFollowRef.current) {
      // Jump to bottom after history loads only when auto-follow is enabled.
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'auto' });
      });
    }
  }, [history, seedCursor, autoScroll]);

  // Scroll to bottom when this pane becomes active (tab switch)
  useEffect(() => {
    if (isActive) {
      autoScroll.snapToBottom();
      setIsAtBottom(true);
    }
  }, [isActive, autoScroll]);

  // Virtuoso reports arrival at the bottom itself; see `jumpToBottom` for why the pane no
  // longer claims it up front.
  const scrollToBottom = autoScroll.jumpToBottom;

  // Compute the timer badge inline — tick state re-renders every second to keep it current
  let timerBadge: string | null = null;
  if (timerState.nextFightAt) {
    const delta = timerState.nextFightAt - Date.now();
    timerBadge = delta <= 0 ? 'fight now!' : `fight in ${formatCountdown(timerState.nextFightAt)}`;
  } else if (timerState.nextBossSpawnAt) {
    timerBadge = `boss in ~${formatCountdown(timerState.nextBossSpawnAt)}`;
  }

  // ring.state pushes are authoritative once they start arriving; the ringState
  // query only seeds the roster before the first one lands. An empty live push
  // (e.g. the ring clearing right after a fight ends) must win over the query too,
  // or the roster reverts to a stale polled snapshot at exactly the moment — the
  // fight's conclusion — the display matters most.
  const rosterContestants: RingContestantSnapshot[] = hasLiveTimerStateRef.current
    ? (timerState.contestants ?? [])
    : ((ringState as { contestants?: RingContestantSnapshot[] } | undefined)?.contestants ?? []);

  const summonBadge = ringState
    ? `summons ${ringState.bossSummonsRemaining}/${ringState.bossSummonLimit}`
    : null;
  const myFightingMonster = timerState.inEncounter
    ? rosterContestants.find((contestant) => contestant.userId === myUserId && !contestant.dead)
    : undefined;

  return (
    <section
      className={`terminal-pane${isActive ? ' active' : ''}`}
      aria-label="The Ring — public fight feed"
    >
      <header className="pane-header">
        <span>The Ring</span>
        {timerBadge && (
          <span className="pane-header-timer" title="Time until next ring event">
            {timerBadge}
          </span>
        )}
        {summonBadge && (
          <span
            className="pane-header-timer"
            title="Boss summons you have left today — type `summon a boss` to use one"
          >
            {summonBadge}
          </span>
        )}
        {!connected && !reconnecting && <span style={{ color: 'var(--color-fg-dim)' }}>connecting…</span>}
        {reconnecting && <span style={{ color: 'var(--color-accent)' }}>reconnecting…</span>}
        {headerActions && <span className="pane-header-actions">{headerActions}</span>}
      </header>

      {reconnecting && (
        <div className="connection-banner reconnecting" role="status">
          -- reconnecting --
        </div>
      )}

      <RingRoster
        contestants={rosterContestants}
        myUserId={myUserId}
        collapsed={rosterCollapsed}
        onToggle={toggleRoster}
      />
      {myFightingMonster && <RingItemsPanel roomId={roomId} monsterName={myFightingMonster.name} />}

      {/* Above the feed, not over it: the stage is a sibling that collapses to zero
          height between fights, so the narration keeps every line it has. */}
      {pixelArtEnabled && (
        <Suspense fallback={null}>
          <PixelFightLayer
            key={roomId}
            contestants={rosterContestants}
            viewerUserId={myUserId}
            inEncounter={timerState.inEncounter}
          />
        </Suspense>
      )}

      {/* Gesture listeners sit on the wrapper because Virtuoso owns the scroller element;
          wheel/touch/pointer/key events bubble up from it. */}
      <div className="pane-feed-area" {...autoScroll.gestureHandlers}>
      <Virtuoso
        ref={virtuosoRef}
        scrollerRef={autoScroll.setScroller}
        className="event-feed"
        role="log"
        aria-live="polite"
        aria-label="Ring events"
        tabIndex={0}
        data={events}
        atBottomThreshold={AT_BOTTOM_THRESHOLD_PX}
        followOutput={(atBottom) =>
          autoScroll.shouldFollowRef.current || atBottom ? 'smooth' : false
        }
        components={{
          List: FeedList,
          EmptyPlaceholder: () => (
            <li className="event event-system event-feed-empty">
              <p>Waiting for fight events…</p>
            </li>
          ),
        }}
        itemContent={(_, event) => {
          if (isFeedMarker(event)) {
            return (
              <li className={`feed-marker feed-marker-${feedMarkerKind(event) ?? 'joined'}`}>
                <span>{event.text}</span>
              </li>
            );
          }
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
        atBottomStateChange={(atBottom) => setIsAtBottom(autoScroll.onAtBottomChange(atBottom))}
      />
      {!isAtBottom && (
        <button
          className="jump-to-bottom"
          onClick={scrollToBottom}
          aria-label="Jump to latest events"
        >
          ↓ Latest
        </button>
      )}
      </div>

      {lastFight?.[0] && (
        <LastFightFooter
          summary={lastFight[0] as FightSummaryLike & { fightNumber: number; endedAt: string }}
          showRelative={ringKeyTimestampsEnabled}
        />
      )}
    </section>
  );
}
