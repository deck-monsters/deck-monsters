import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import PaneDivider from './PaneDivider.js';
import PaneSelector from './PaneSelector.js';
import CatchUpBanner from './CatchUpBanner.js';
import { RingFeedProvider } from '../hooks/useRingFeed.js';
import { DEFAULT_SLOTS, SURFACES, isSurfaceId, type SurfaceId } from './surfaces.js';

interface TerminalProps {
  roomId: string;
}

const PANE_SLOTS_KEY = 'dm:paneSlots';

function readStoredSlots(): [SurfaceId, SurfaceId] {
  try {
    const raw = window.localStorage.getItem(PANE_SLOTS_KEY);
    if (!raw) return DEFAULT_SLOTS;
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      isSurfaceId(parsed[0]) &&
      isSurfaceId(parsed[1]) &&
      parsed[0] !== parsed[1]
    ) {
      return [parsed[0], parsed[1]];
    }
    return DEFAULT_SLOTS;
  } catch {
    // Private mode / blocked storage — default to ring+console, the layout a fresh
    // viewer sees anyway.
    return DEFAULT_SLOTS;
  }
}

function writeStoredSlots(slots: [SurfaceId, SurfaceId]): void {
  try {
    window.localStorage.setItem(PANE_SLOTS_KEY, JSON.stringify(slots));
  } catch {
    // Preference is a convenience only — ignore storage failures.
  }
}

/**
 * Wide-layout (`Cmd/Ctrl+N`) placement rule (§3.4): if the surface is already visible in
 * either slot, side-by-side shows both slots anyway, so there is nothing to do. Otherwise
 * it goes into the slot that does not already show it — preferring slot 1, so `Cmd+3` from
 * the default layout puts the workshop where the console was and leaves the ring alone.
 */
function placeSurfaceSideBySide(
  surfaceId: SurfaceId,
  slots: [SurfaceId, SurfaceId]
): [SurfaceId, SurfaceId] {
  if (slots.includes(surfaceId)) return slots;
  return [slots[0], surfaceId];
}

/**
 * Tabbed-layout placement: pressing a shortcut or tapping a tab for a surface already
 * held by the *other* slot just flips which slot is on screen — that surface is already
 * one tap away, and overwriting the active slot with it would create a duplicate the
 * moment the viewer widens back to side-by-side. Otherwise the surface replaces whatever
 * the active slot currently shows.
 */
function placeSurfaceTabbed(
  surfaceId: SurfaceId,
  slots: [SurfaceId, SurfaceId],
  activeSlot: 0 | 1
): { slots: [SurfaceId, SurfaceId]; activeSlot: 0 | 1 } {
  if (slots[activeSlot] === surfaceId) return { slots, activeSlot };
  const otherSlot: 0 | 1 = activeSlot === 0 ? 1 : 0;
  if (slots[otherSlot] === surfaceId) return { slots, activeSlot: otherSlot };
  const next: [SurfaceId, SurfaceId] =
    activeSlot === 0 ? [surfaceId, slots[1]] : [slots[0], surfaceId];
  return { slots: next, activeSlot };
}

const SHORTCUT_KEYS = new Map(SURFACES.map((surface, index) => [String(index + 1), surface.id]));

function orderedMountedSurfaces(
  surfaces: typeof SURFACES,
  slots: [SurfaceId, SurfaceId],
  everMounted: Set<SurfaceId>
): typeof SURFACES {
  const bySlot = [slots[0], slots[1]]
    .map((id) => surfaces.find((surface) => surface.id === id))
    .filter((surface): surface is (typeof SURFACES)[number] => surface !== undefined);
  const rest = surfaces.filter(
    (surface) => surface.id !== slots[0] && surface.id !== slots[1] && everMounted.has(surface.id)
  );
  return [...bySlot, ...rest];
}

export default function Terminal({ roomId }: TerminalProps) {
  const [slots, setSlots] = useState<[SurfaceId, SurfaceId]>(readStoredSlots);
  // Which slot the tab bar shows on a narrow screen. Defaults to slot 1 (console in the
  // default layout), matching the tabbed view's pre-existing default before surfaces were
  // generalised — a fresh mobile viewer still lands on the console, not the ring.
  const [activeSlot, setActiveSlot] = useState<0 | 1>(1);
  const [isSideBySide, setIsSideBySide] = useState(false);
  const [ringWidthFraction, setRingWidthFraction] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);

  // Surfaces that have been shown at least once *in this room*, so their component stays
  // mounted (state-preserving, §3.6) even after being swapped out of a slot. A surface
  // never in this set is not rendered at all — `useDeckWorkshop` fires tRPC queries on
  // mount, so an always-mounted workshop would poll for every player on every room load
  // whether or not they ever open it (§3.6 "cost to confirm before building").
  const [everMounted, setEverMounted] = useState<Set<SurfaceId>>(() => new Set(slots));
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const roomIdRef = useRef(roomId);
  // Effects run after render. On a route change, rendering the previous room's
  // `everMounted` set once would mount every previously visited surface with the new
  // room id and start its queries before the reset effect can run. Gate the render
  // synchronously as well as resetting the retained state below.
  const mountedInCurrentRoom = roomIdRef.current === roomId
    ? everMounted
    : new Set<SurfaceId>(slots);

  // A room switch must not carry over a previous room's "has this been shown" state —
  // see docs/room-scoping.md. Terminal itself is not remounted on room change (the parent
  // route re-renders with a new `roomId` param rather than unmounting), so this has to be
  // done explicitly rather than falling out of component lifecycle.
  useEffect(() => {
    if (roomIdRef.current === roomId) return;
    roomIdRef.current = roomId;
    setEverMounted(new Set(slotsRef.current));
  }, [roomId]);

  const markMounted = useCallback((surfaceId: SurfaceId) => {
    setEverMounted((prev) => (prev.has(surfaceId) ? prev : new Set(prev).add(surfaceId)));
  }, []);

  // Persist both slots per viewer, following the `dm:ringRosterCollapsed` precedent in
  // RingPane.tsx: same try/catch shape, same "a blocked store is not an error" stance.
  useEffect(() => {
    writeStoredSlots(slots);
  }, [slots]);

  // Detect layout breakpoint
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsSideBySide(entry.contentRect.width >= 1024);
      }
    });

    const container = containerRef.current;
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Keyboard shortcuts: Cmd/Ctrl+1/2/3 map to the surfaces in registry order (§3.4).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const surfaceId = SHORTCUT_KEYS.get(e.key);
      if (!surfaceId) return;
      e.preventDefault();
      markMounted(surfaceId);
      if (isSideBySide) {
        setSlots((prev) => placeSurfaceSideBySide(surfaceId, prev));
      } else {
        const result = placeSurfaceTabbed(surfaceId, slots, activeSlot);
        setSlots(result.slots);
        setActiveSlot(result.activeSlot);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isSideBySide, slots, activeSlot, markMounted]);

  const handleTabSelect = useCallback(
    (surfaceId: SurfaceId) => {
      markMounted(surfaceId);
      const result = placeSurfaceTabbed(surfaceId, slots, activeSlot);
      setSlots(result.slots);
      setActiveSlot(result.activeSlot);
    },
    [markMounted, slots, activeSlot]
  );

  const handleSlotSelect = useCallback(
    (slotIndex: 0 | 1, surfaceId: SurfaceId) => {
      markMounted(surfaceId);
      setSlots((prev) => {
        const next: [SurfaceId, SurfaceId] = [...prev];
        next[slotIndex] = surfaceId;
        return next;
      });
    },
    [markMounted]
  );

  const handleResize = useCallback((fraction: number) => {
    setRingWidthFraction(fraction);
    if (containerRef.current) {
      containerRef.current.style.setProperty('--ring-pane-width', `${(fraction * 100).toFixed(1)}%`);
    }
  }, []);

  function isVisible(surfaceId: SurfaceId): boolean {
    return isSideBySide ? slots.includes(surfaceId) : slots[activeSlot] === surfaceId;
  }

  return (
    <div
      ref={containerRef}
      className="terminal-shell"
      data-layout={isSideBySide ? 'side-by-side' : 'tabbed'}
    >
      {/* Tab bar — only visible on narrow screens; lists every surface, not just the two
          remembered slots (§3.2). */}
      <CatchUpBanner roomId={roomId} />

      {!isSideBySide && (
        <div className="terminal-tabs" role="tablist" aria-label="Switch panes">
          {SURFACES.map((surface) => (
            <button
              key={surface.id}
              className={`terminal-tab${isVisible(surface.id) ? ' active' : ''}`}
              role="tab"
              aria-selected={isVisible(surface.id)}
              aria-controls={`pane-${surface.id}`}
              id={`tab-${surface.id}`}
              onClick={() => handleTabSelect(surface.id)}
            >
              {surface.label}
            </button>
          ))}
        </div>
      )}

      <RingFeedProvider roomId={roomId}>
        {/*
          Rendered with slot 0's surface first, slot 1's second, and any other
          ever-mounted-but-currently-hidden surface last — deliberately NOT the fixed
          registry order the tab bar uses above.

          This ordering was originally required because `PaneDivider` found the left pane
          by first-match `querySelector('.terminal-pane')`; it now addresses the slot
          directly via `data-pane-slot`, so the divider no longer depends on DOM order.

          It is kept for a different reason that does still hold: DOM order is keyboard
          focus and screen-reader reading order, and `gridColumn` places the slots visually
          without moving them in the tree. Left before right in the DOM is the only thing
          keeping Tab from jumping to the right-hand pane first.

          React reconciles these by the `key` below, not by array position, so reordering
          on a slot swap moves the existing DOM node rather than remounting it — pane state
          (workshop selection, console scroll) survives.
        */}
        {orderedMountedSurfaces(SURFACES, slots, mountedInCurrentRoom).map((surface) => {
          const slotIndex = slots.indexOf(surface.id) as -1 | 0 | 1;
          const visible = isVisible(surface.id);
          const siblingSurfaceId = slotIndex === -1 ? undefined : slots[slotIndex === 0 ? 1 : 0];

          const style: CSSProperties = isSideBySide
            ? slotIndex === -1
              ? { display: 'none' }
              : { gridColumn: slotIndex === 0 ? '1' : '3', borderRight: slotIndex === 1 ? 'none' : undefined }
            : {};

          return (
            <div
              key={`${surface.id}-${roomId}`}
              id={`pane-${surface.id}`}
              // `PaneDivider` measures the left pane to work out the drag's starting
              // fraction. It used to find it with `querySelector('.terminal-pane')`, which
              // only worked because Ring and Console happen to render that class — the
              // Workshop renders `.workshop-view`, so the divider would have measured
              // nothing with the Workshop on the left. The slot, not the surface inside it,
              // is what the divider actually cares about, so it is addressed explicitly
              // here rather than by borrowing a class off whatever happens to be mounted.
              data-pane-slot={slotIndex >= 0 ? slotIndex : undefined}
              className={`terminal-slot${visible ? ' active' : ''}`}
              style={style}
              role={!isSideBySide ? 'tabpanel' : undefined}
              aria-labelledby={!isSideBySide ? `tab-${surface.id}` : undefined}
              hidden={!visible}
            >
              {surface.render({
                roomId,
                isActive: visible,
                // Hidden, previously mounted surfaces must not leave focusable host
                // controls in the accessibility tree. Narrow mode retains just the
                // route action because surface choice lives in the tab bar.
                headerActions: visible ? (
                  <>
                    {isSideBySide && slotIndex !== -1 && siblingSurfaceId && (
                      <PaneSelector
                        value={surface.id}
                        excludeSurfaceId={siblingSurfaceId}
                        onChange={(next) => handleSlotSelect(slotIndex, next)}
                        slotLabel={slotIndex === 0 ? 'left pane' : 'right pane'}
                      />
                    )}
                    {surface.route && (
                      <Link
                        className="pane-open-full"
                        to={surface.route(roomId)}
                        aria-label={`Open ${surface.label} as a full page`}
                        title={`Open ${surface.label} as a full page`}
                      >
                        ⤢
                      </Link>
                    )}
                  </>
                ) : undefined,
              })}
            </div>
          );
        })}

        {isSideBySide && <PaneDivider onResize={handleResize} containerRef={containerRef} />}
      </RingFeedProvider>
    </div>
  );
}
