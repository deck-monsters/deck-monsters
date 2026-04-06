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

export default function RingPane({ roomId, isActive, onEvent }: RingPaneProps) {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const feedRef = useRef<HTMLOListElement>(null);
  const seenRef = useRef(new Set<string>());
  const lastEventIdRef = useRef<string | undefined>(undefined);
  const { handleHandshakeEvent } = useHandshake();

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
      },
      onError() {
        setConnected(false);
        setReconnecting(true);
      },
    }
  );

  return (
    <section
      className={`terminal-pane${isActive ? ' active' : ''}`}
      aria-label="The Ring — public battle feed"
    >
      <header className="pane-header">
        <span>The Ring</span>
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
