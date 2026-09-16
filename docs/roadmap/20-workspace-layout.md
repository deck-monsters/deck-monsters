# Workspace Layout — a switchable second pane

**Category**: Web UX / Information architecture
**Priority**: High — the workshop being a separate route is a live friction point during fights
**Status**: 📋 Planned

## 1. The problem

The workshop is a **route**, not a pane: `/room/:roomId/workshop`, rendered full-page
inside `AppShell`. Changing a deck therefore means navigating away from the ring feed. You
do that *between* fights — but the moment you most want to change a deck is right after
watching a monster lose, which is exactly when leaving the feed costs the most.

Meanwhile `Terminal` is a fixed two-pane shell: ring on the left, console on the right,
with a draggable divider above 1024px and a two-tab layout below it.

**Target**: the left pane stays pinned to the ring — it is the thing you are watching. The
**second pane's content becomes selectable**: console or workshop. On a phone the same
choice appears as a third tab.

## 2. Current architecture (verified)

- `Terminal.tsx` holds `activeTab: 'ring' | 'console'`, a `ResizeObserver` that flips
  `isSideBySide` at **1024px**, and `Cmd/Ctrl+1` / `Cmd/Ctrl+2` shortcuts.
- `.terminal-shell` is a 3-column grid: `var(--ring-pane-width) var(--divider-width) 1fr`.
- Below 1024px the grid collapses to one column, `.terminal-pane { display: none }` and
  `.terminal-pane.active { display: flex }`. **Both panes stay mounted** and visibility is
  CSS-only — which is why pane state survives tab switching today, and is the behaviour the
  workshop pane must inherit.
- Panes are keyed by room (`key={ring-${roomId}}`), so a room change remounts them.
- `useDeckWorkshop(roomId)` is already room-scoped and self-contained. It takes `roomId` as
  an argument, not from `useParams`, so it can be lifted into a pane unchanged.
- `WorkshopView` reads `useParams()` and wraps itself in `AppShell`. Those two things are
  what make it a page rather than a component.

## 3. Design

### 3.1 One workshop implementation, two hosts

Do **not** build a second workshop for the pane. Extract the body of `WorkshopView` into
`components/WorkshopPanel.tsx` taking `roomId` as a prop, then:

- `views/WorkshopView.tsx` → `AppShell` + `<WorkshopPanel roomId={fromParams} />`
- `components/Terminal.tsx` → `<WorkshopPanel roomId={roomId} />` inside a `.terminal-pane`

The route stays working, deep links keep working, and there is exactly one workshop to
maintain. Two implementations of the same surface is the drift risk this project has
already been bitten by elsewhere (see the duplicated event-visibility predicate,
`10b-bugs-fixed.md` #109).

### 3.2 Pane model

`Terminal` gains `secondPane: 'console' | 'workshop'`, independent of `activeTab`.

- **Side-by-side (≥1024px)**: ring, divider, then whichever second pane is selected. The
  grid stays three columns — workshop and console occupy the same slot.
- **Tabbed (<1024px)**: three tabs — The Ring / Console / Workshop. `activeTab` becomes
  `'ring' | 'console' | 'workshop'`; `secondPane` follows it when a non-ring tab is chosen
  so the two models stay coherent when the viewport crosses the breakpoint.

### 3.3 The switch control

The tab bar is hidden above 1024px, so side-by-side needs its own control. Put a **small
segmented control in the second pane's header** (`Console | Workshop`), which is where the
thing it switches lives. Not in the global nav — this is a pane-local choice.

### 3.4 Keyboard

`Cmd/Ctrl+3` selects the workshop, matching the existing 1/2 shortcuts. In side-by-side it
sets `secondPane`; in tabbed it sets `activeTab`.

### 3.5 Persistence

Remember `secondPane` per viewer in `localStorage`, following the
`dm:ringRosterCollapsed` precedent in `RingPane.tsx` — same key shape (`dm:secondPane`),
same try/catch around every access, same "a blocked store is not an error" comment.

### 3.6 Mounting

Keep both second-pane candidates **mounted** and toggle visibility with CSS, matching
today's behaviour. This preserves workshop selection state, in-progress drags and scroll
position across a switch.

**Cost to confirm before building**: `useDeckWorkshop` issues tRPC queries on mount, so an
always-mounted workshop fetches for every player on every room load, whether or not they
open it. Measure it. If it matters, gate the queries on "has ever been shown" rather than
unmounting the pane — unmounting would throw away the state this decision exists to keep.

## 4. The hidden cost: the workshop is a wide layout

This is the part most likely to be underestimated. `WorkshopView` assumes a full-page
width: `.workshop-monster-row` lays monster panels horizontally and
`.workshop-card-grid.inventory-grid` is a multi-column card grid. Dropping it into a
~half-width laptop pane, and then into a 393px phone pane, is **real responsive CSS work,
not a wiring exercise**.

Expect to:
- make `.workshop-monster-row` wrap or scroll horizontally under a container query;
- reduce the inventory grid's minimum column width, or switch to a list below a threshold;
- re-check the drag-and-drop affordances at narrow widths, where they are already the
  weakest part of the workshop (which is why the explicit equip button was added).

Prefer **container queries** over viewport media queries here: the workshop's available
width is now a function of the divider position, not the window.

## 5. Phases

**Phase 1 — extract, no behaviour change.** `WorkshopPanel` component; `WorkshopView`
becomes a thin wrapper. Existing workshop tests must pass untouched. Ship this alone.

**Phase 2 — the pane.** `secondPane` state, the segmented control, `Cmd/Ctrl+3`, the third
tab, localStorage persistence. Workshop renders inside `.terminal-pane`.

**Phase 3 — responsive.** The §4 work, driven by container queries, at three widths: wide
laptop, half-pane laptop, phone.

**Phase 4 — the rest of the hub** (roadmap 19 §6): items panel, spawn/revive/send, shop.
These become tractable only once there is a pane to put them in, which is why this doc
precedes them.

## 6. Test plan

- **Phase 1**: existing `workshopView.review-regressions.test.tsx` and
  `inventoryPanel.equip.test.tsx` pass with no edits. That is the proof the extraction was
  behaviour-neutral.
- **Phase 2**: `secondPane` defaults to console; switching preserves console scroll
  position and workshop selection; `Cmd/Ctrl+3` works in both layouts; the choice survives
  a reload; a blocked `localStorage` still renders.
- **Crossing the breakpoint** with the workshop selected leaves the workshop selected.
- **Room switch** remounts the workshop pane (keyed by `roomId`) and does not leak the
  previous room's monsters — the room-scoping rule (`docs/room-scoping.md`) applies to a
  pane exactly as it does to a route.
- **Phase 3**: render the workshop at 1440px, ~700px and 393px and check no horizontal
  overflow — the same failure class as `10b-bugs-fixed.md` #98.

## 7. Open questions

1. Should the **ring** pane also be swappable (e.g. ring ↔ fight log), or is pinning it
   the point? Pinning is simpler and matches "the thing you are watching".
2. On a phone, should tapping "Workshop" from a live fight warn that you will stop seeing
   the feed, or is the third tab enough? Leaning: enough — the tab bar stays visible.
3. Does `/room/:roomId/workshop` stay a full page, or redirect into the terminal with the
   workshop pane selected? Keeping both is cheap once §3.1 is done, and full-page is still
   the better surface for a long deck-building session.
