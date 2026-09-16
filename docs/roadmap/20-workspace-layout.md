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

### 3.1 One implementation per surface, two hosts

**Every surface can be viewed full page *or* as a pane.** That is a property of the host,
not of the surface: a surface is a plain component taking `roomId`; a route renders it
inside `AppShell`, and a slot renders it inside `.terminal-pane`. Neither host knows
anything special about which surface it holds.

```
components/WorkshopPanel.tsx     surface  (roomId prop, layout-agnostic)
views/WorkshopView.tsx           host: route     AppShell + surface
components/Terminal.tsx          host: pane      .terminal-pane + surface
```

Do **not** build a second copy for the pane. Two implementations of one surface is the
drift risk this project has already been bitten by — see the duplicated event-visibility
predicate that leaked private events (`10b-bugs-fixed.md` #109).

**This applies to every surface, not just the workshop.** The fight log and the leaderboard
are already routes (`/room/:roomId/fights`, `/room/:roomId/leaderboard`) with exactly the
workshop's problem: you must leave the feed to read them. Each becomes a pane by the same
cheap extraction, and keeps its full-page route.

**Consequence for the components**: a surface must not assume it owns the viewport. Use
container queries, not viewport media queries (§4) — the same component renders at 1440px
as a page and at ~400px as a phone pane.

**Affordance**: a pane header gets an "open full page" control linking to that surface's
route. The reverse (full page → "open as pane") is nice-to-have, not required, since the
terminal is one click away.

### 3.1a Surface registry

One table maps `SurfaceId` to its component, label, icon and route. The tab bar, both pane
selectors, and the keyboard shortcuts all read from it, so adding a surface later is one
entry rather than four edits. Keep it in `components/surfaces.ts`.

### 3.2 Pane model — surfaces in slots

The first draft pinned the ring and made only the second pane selectable. That was two
mechanisms where one will do. What we are actually building is **a tab interface**: a set
of *surfaces*, and one or two visible *slots* to put them in.

```
type SurfaceId = 'ring' | 'console' | 'workshop';   // later: 'fights', 'leaderboard'
slots: [SurfaceId, SurfaceId]                        // wide:  both rendered
slots[activeSlot]                                    // narrow: one rendered
```

- **Side-by-side (≥1024px)**: two slots, each with its own selector. Default
  `['ring', 'console']`, which is today's layout.
- **Tabbed (<1024px)**: one slot; the tab bar lists every surface. This is already a tab
  bar — it just grows from two entries to three.

**This generalisation is the point, not a flourish.** One `PaneSelector` component used
once per slot replaces a bespoke second-pane switcher, and the fight log and leaderboard —
today full-page routes with exactly the workshop's problem, that you must leave the feed to
read them — become surfaces later for free, with no further layout work.

**Guard rails, because two free slots can get confusing:**

- **No duplicates.** A surface already shown in one slot is not offered in the other's
  selector. Two copies of the console is never what anyone meant.
- **The ring stays the default left slot** and is what a fresh viewer sees. Freedom to move
  it is not a reason to make losing it the default.
- **Per-slot persistence** (§3.5), so a layout you chose is the layout you return to.
- If a future surface must never be hidden during a fight, that is a property of *that*
  surface, not a reason to special-case the ring now.

**Cost to keep honest:** this is more state than a pinned ring, and "where did my feed go"
is a real failure mode. The mitigation is the defaults and the no-duplicates rule, not a
warning dialog. If in play it turns out people lose the ring and dislike it, pinning slot 0
is a one-line change on top of this model — whereas the reverse, generalising a pinned
design later, is not.

### 3.3 The switch control

The tab bar is hidden above 1024px, so side-by-side needs its own control. Put a **small
selector in each pane's header**, showing which surface that slot holds and offering the
others (minus whatever the sibling slot is showing). Pane-local, because it is a
pane-local choice — not in the global nav.

Keep it quiet. The pane header is already carrying a timer badge and a summons counter on
the ring; a heavy segmented control there would crowd them. A compact control that reads as
part of the header chrome is the target.

### 3.4 Keyboard

`Cmd/Ctrl+1/2/3` map to ring / console / workshop, extending today's 1 and 2. In tabbed
mode a shortcut selects that surface. In side-by-side it should select the surface **into
the slot that does not already show it**, preferring slot 1 — so `Cmd+3` from the default
layout puts the workshop where the console was and leaves the ring alone.

### 3.5 Persistence

Remember **both slots** per viewer in `localStorage`, following the
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

**The other half of that cost, found in review**: `WorkshopPanel` keeps `selectedCards`,
`activeMonsterFilter`, `message`, `error` and `inventoryRef` in local `useState`/`useRef`.
The moment the same surface can be open as a pane *and* at its full-page route, those are
two independent instances — a selection made in one is invisible in the other, and
`refetchInterval` being per-observer doubles the polling. Neither is a bug today, because
nothing double-mounts yet. Before Phase 2 ships alongside the route, decide one of: lift
that state into `useDeckWorkshop` (or a small shared store) so both instances agree, or
accept divergence and say so in the UI. Do not discover this in play.

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

**Phase 5 — more surfaces.** Extract `FightLogPanel` and `LeaderboardPanel` from their
existing views by the Phase 1 pattern and add them to the registry. Cheap once the model
exists, and the payoff of §3.1 generalising rather than special-casing the workshop.

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

## 7. Resolved decisions

1. **Both slots are swappable** (revised — see §3.2). The first draft pinned the ring;
   the owner's read that "it's almost a tab interface we're building" is correct, and
   generalising to surfaces-in-slots removes a special case rather than adding one. It also
   makes the fight log and leaderboard — which have exactly the workshop's problem — free
   to add later. Guarded by a no-duplicates rule and a ring-left default, not by a dialog.
2. **No warning when switching away from a live fight on a phone.** The tab bar stays
   visible, the feed is not lost, and a confirm dialog on a tab press would be worse than
   the problem. The ring feed also replays on return.
3. **Every surface keeps a full-page route AND becomes available as a pane** (revised —
   see §3.1). Full page stays the better surface for a long deck-building session or for
   reading a fight log properly; the pane is for glancing without leaving the feed. Since a
   surface is just a component, supporting both costs one thin route wrapper each — and it
   is why surfaces must be layout-agnostic.
