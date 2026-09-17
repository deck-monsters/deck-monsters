# Workspace Layout — a switchable second pane

**Category**: Web UX / Information architecture
**Priority**: High — the workshop being a separate route is a live friction point during fights
**Status**: 🔧 Active — phases 1–3 and 5 code-complete; Phase 4 and visual validation remain

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
`dm:ringRosterCollapsed` precedent in `RingPane.tsx` — same try/catch around every access,
same "a blocked store is not an error" comment. Shipped as `dm:paneSlots` (not
`dm:secondPane` as drafted here — the model moved from "a pinned ring + a switchable second
pane" to two independently swappable slots per §3.2, and the key name follows that).

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
nothing double-mounts yet.

**Decision for Phase 3: transient UI state is instance-local.** A pane and a full-page
Workshop opened in another browser tab are separate workspaces. Card data still converges
through the server and tRPC invalidation/refetch, but selections, filters, notices and scroll
position do not cross a browser-tab boundary. Do not introduce `BroadcastChannel`, storage
events or a global store for ephemeral drag state. The full-page control navigates in the
current tab; it does not imply that an in-progress selection will transfer. Label it as
navigation ("Open Workshop full page"), not as a pop-out. This keeps the ownership rule
simple and avoids synchronising stale selection IDs after either instance mutates a deck.

The query cost is bounded separately: Terminal's `everMounted` gate means the Workshop is
not mounted or polled until first use. Once used, it remains mounted for state preservation.
Two actual browser tabs may each poll; that is normal per-tab application behaviour and is
not a reason to couple their UI state.

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

**Phase 2 — the pane. Done.** `slots: [SurfaceId, SurfaceId]` state in `Terminal.tsx`,
`PaneSelector` per slot, `Cmd/Ctrl+1/2/3`, the third tab, `dm:paneSlots` persistence.
`components/surfaces.ts` holds the `SurfaceId` registry (§3.1a) the tab bar, both
selectors and the shortcuts all read.

Two implementation notes for whoever extracts the next surface (Phase 5):

- **The pane header lives in `Terminal.tsx`, not inside each surface.** §3.3 describes the
  selector as living "in each pane's header", but `RingPane` and `ConsolePane` already
  render their own `<header class="pane-header">` internally, and reaching into either to
  splice in a selector would have meant two implementations agreeing on layout again — the
  exact drift §3.1 warns about. Instead `Terminal` wraps every surface in a `.terminal-slot`
  (the actual grid item now) with its own slim `.terminal-slot-header` above the surface's
  own content, carrying the `PaneSelector` (side-by-side only) and the "open full page"
  link. It reads as an extra thin toolbar row on ring/console, not as a redesign of their
  header — but it is a second header-shaped element stacked above the first, which is a
  real, visible deviation from "in each pane's header" worth knowing about before it
  surprises someone.
- **`PaneDivider.tsx` was left untouched** (out of scope for this phase) but assumes the
  left pane is `document.querySelector('.terminal-pane')`'s first match, which only the
  ring and console (not the workshop) render as their own root class. `Terminal` keeps this
  working two ways rather than editing the divider: it renders slot 0's surface first in
  the DOM (slot assignment reorders a stable-keyed list rather than the fixed
  ring/console/workshop tab order, so React moves the existing node instead of remounting
  it — state survives), and it stamps the slot 0 wrapper itself with an extra
  `.terminal-pane` class so the divider finds a real match even when the workshop is the
  one on the left. Worth revisiting if `PaneDivider` is ever touched for its own reasons.

**Phase 3 — responsive workshop and unified pane chrome. Code-complete.** The surfaces now accept
host-owned header actions, the duplicate slot header is gone, and the Workshop responds to
its own container with compact, pane and roomy presentations. Automated coverage is green;
the 1440px, ~700px, 393px and 200%-zoom manual checks in 3D still require sign-off.

**Phase 4 — finish the monster-management hub. In progress** (roadmap 19 §6). Item use now
ships in both Workshop and Ring, and the room-scoped shop supports browse/buy. Typed revive
and send-to-ring actions also ship. Prompt-free spawn, web selling and final parity remain.
Detailed as work packages 4A–4D in §5c.

**Phase 5 — more surfaces. Code-complete.** `FightLogPanel` and `LeaderboardPanel` were extracted from their
existing views by the Phase 1 pattern, made container-responsive, and added to the registry.
Leaderboard tables use labelled, keyboard-focusable scroll regions. Detailed as work
packages 5A–5C in §5d.

## 5a. Contracts established in Phase 2 — do not undo these

Two things look incidental and are not. Both were introduced deliberately in review, so a
future reader who "tidies" them will reintroduce a real bug.

**1. `PaneDivider` addresses the slot, not the surface.** The divider reads the left pane's
width to compute a drag's starting fraction. It used to find it with
`querySelector('.terminal-pane')`, which worked only because Ring and Console happen to
render that class — the Workshop renders `.workshop-view`, so with the Workshop on the left
the divider would have measured nothing. Each slot wrapper now carries
`data-pane-slot={index}` and the divider queries `[data-pane-slot="0"]`.

An earlier attempt stamped `.terminal-pane` onto the slot-0 wrapper instead. That nested a
pane inside a pane and avoided a double border only by accident of an unrelated
`.terminal-pane:last-child` rule. Do not reach for the class again: `.terminal-slot`
already carries every rule `.terminal-pane` was contributing, and the divider's dependency
is on the *slot*, which is what the attribute names.

**2. The mounted-surface array is ordered slot 0, slot 1, then hidden.** The original reason
(the divider's first-match `querySelector`) no longer applies after contract 1. It is kept
for a reason that does: **DOM order is keyboard focus and screen-reader reading order**, and
`gridColumn` positions the slots visually without moving them in the tree. Without the
ordering, Tab reaches the right-hand pane first whenever the slots are swapped.

React reconciles by `key`, so reordering moves the existing DOM node rather than remounting
it — which is also what keeps pane state alive across a swap.

## 5b. Phase 3 implementation plan — responsive workshop and pane chrome

Ship Phase 3 as two focused commits (3A–3B, then 3C–3D) so the structural header change is
reviewable independently from the visual breakpoint work.

### 3A. Establish a host-actions contract and remove the extra header row

The selector and full-page link are host concerns, but rendering a second header merely to
keep that ownership pure wastes vertical space. Extend `SurfaceRenderProps` with an optional
`headerActions: ReactNode`. `Terminal` still constructs the `PaneSelector` and full-page
link; each surface only exposes a placement slot in its existing header:

- `RingPane` and `ConsolePane` render the node at the trailing edge of `.pane-header`;
- `WorkshopPanel` renders it in `.workshop-header`;
- route hosts omit it, so the same surface remains usable full-page;
- hidden, previously mounted surfaces receive no interactive header actions; and
- narrow mode continues to use the tab bar, with only the full-page action in the active
  surface header. Do not render a hidden focusable selector.

Delete `.terminal-slot-header` after all three surfaces accept the contract. Keep
`.terminal-slot` and `.terminal-slot-body`: they are still the layout, visibility and
divider boundary. Preserve the `data-pane-slot` contract and mounted-surface DOM ordering
from §5a.

**Acceptance:** one visual header row per surface; selector labels remain associated with
"left pane"/"right pane"; the open-full-page link has a text-equivalent accessible name;
tab order is left slot then right slot; all Phase 2 slot tests remain green.

### 3B. Make the Workshop respond to its container

Set `container-type: inline-size` on the Workshop's host (`.workshop-view` is sufficient;
name the container if rules could otherwise bind to an unintended ancestor). Replace the
Workshop's viewport media queries with container queries. Use content-driven thresholds,
validated at the required examples, rather than treating 700px and 393px as magic viewport
breakpoints:

- **roomy (roughly 900px+)**: keep the current wrapping monster cards and inventory grid;
- **pane (roughly 520–900px)**: make monster panels a single horizontal, snap-scrollable
  row so each monster remains a useful width; tighten padding and card-grid minimums;
- **compact (below roughly 520px)**: stack header/summary controls, make all controls meet
  the existing coarse-pointer target rules, use two card columns where they fit and one
  only when necessary, and keep explicit tap-to-select/equip usable without drag-and-drop.

Every flex/grid child that contains player or monster text needs `min-width: 0` and an
intentional wrapping rule. Horizontal scrolling is allowed only for the labelled monster
rail; the Workshop root, inventory, presets, item rows and card grid must not overflow.
Do not key these rules to `.terminal-slot`: the full-page host must exercise the identical
component CSS.

### 3C. Preserve behaviour through resize and room changes

Add regression coverage for crossing 1024px in both directions with Workshop selected,
including a surface held in slot 0. Assert that the selected surface and local selection
survive a resize (the node is hidden/moved, not remounted). Then switch `roomId` and assert
that the old Workshop instance is removed and the new room's query inputs are used. All
new tRPC calls and invalidations must continue carrying that `roomId`.

### 3D. Visual and accessibility verification

Create a deterministic test fixture with multiple monsters, long names, a full deck,
presets and all three item tiers. Capture the Workshop at a 1440px full page, an
approximately 700px slot (also drag the divider narrower and wider), and a 393px viewport.
At each size verify: no document/root horizontal overflow; monster rail is the only planned
horizontal scroller; focus indicators are not clipped; keyboard and touch-equivalent
actions remain available; and zoom at 200% does not hide actions.

**Phase 3 exit gate:** behaviour tests, web typecheck/lint/build, and the three visual
checks pass; the screenshots are attached to the PR. Do not begin Phase 4 to paper over a
layout defect discovered here.

## 5c. Phase 4 implementation plan — finish the management hub

Phase 4 is ordered by dependency and risk, not by where controls happen to render. Each
mutation needs server authorization, room membership validation, room-scoped cache
invalidation, pending/error UI, and a focused server + web test before its button ships.

### 4A. Item use end to end

Add a typed `use item` tRPC procedure that delegates to the existing engine operation
rather than duplicating usability rules. Its input identifies `roomId`, item and target;
the server obtains the acting character from authenticated room membership. Return a
structured result suitable for an immediate notice and invalidate the room inventory and
live ring state as applicable.

Turn eligible `ItemsPanel` rows into explicit use actions. Before a fight, allow valid
character/monster targets; during a fight, show only actions the server says are usable by
that monster from its carried inventory. Put the same compact action in the live ring
roster/pane so emergency use is one interaction rather than a console prompt chain. Treat
server validation as authoritative if state changes between render and click.

### 4B. Monster lifecycle actions

Expose typed procedures/UI for spawn and revive, then send-to-ring. Reuse engine command
methods and their validation; do not recreate costs, eligibility or encounter rules in
React. Spawn and revive can submit directly with clear pending state. Sending to the ring
must show a confirmation naming the monster and room because it is room-visible and
consequential. Refresh Workshop inventory and ring state after success.

Keep action placement contextual: monster-specific actions belong on
`MonsterWorkshopPanel`; spawn belongs at Workshop level. Empty/loading/error states must be
usable at compact widths established in Phase 3.

### 4C. Room-scoped shop

First expose a read model containing room shop stock, prices, affordability and enough item
metadata to render without importing engine internals into the web app. Every read and buy
mutation includes `roomId`, validates membership, and operates on that room's `Game.shop` /
`commitShop()` state. Render browse/buy inside the Workshop with explicit quantity,
balance, pending state and a post-purchase inventory refresh. Selling is not required by
this phase unless separately specified; do not silently grow scope while implementing buy.

Add a two-room isolation test: stock changes and purchases in room A neither read nor
invalidate room B. This is a release-blocking application of the room-scoping rule.

### 4D. Parity, feedback and integration

Update the command reference alongside each new web action, not in a cleanup sweep. Add
success/error announcements with `aria-live`; prevent duplicate submission while pending;
and exercise the full hub at all Phase 3 widths. The console remains supported, but the
acceptance journey is command-free: spawn a monster, prepare cards/items, revive if needed,
confirm sending it to the ring, use an eligible item, and buy from the current room's shop.

**Phase 4 exit gate:** that command-free journey passes; mutation authorization and
room-isolation tests pass; roadmap 19's remaining item-use and hub bullets can be marked
shipped.

## 5d. Phase 5 implementation plan — fight log and leaderboard surfaces

Do these as two extraction commits followed by one registry/integration commit. Avoid a
single change that mixes component extraction, table redesign and five-surface slot state.

### 5A. Extract layout-agnostic panels

- Move fight-log query/state/rendering to `FightLogPanel({ roomId, headerActions? })`.
  `FightLogView` becomes `useParams` + room shell + panel, retaining its no-room fallback.
- Move leaderboard query/state/rendering to
  `LeaderboardPanel({ roomId?, initialScope?, headerActions? })`. The global
  `/leaderboard` route remains supported; the pane always receives a room and defaults to
  room scope. `LeaderboardView` becomes a thin host.
- Replace the views' large inline layout/style blocks with named classes owned by the
  surfaces. This is prerequisite responsive work, not cosmetic cleanup.

The existing routes and deep-link behaviour are compatibility requirements. Existing
fight expansion and leaderboard filter state stays local to each mounted surface and
survives pane switches under the Phase 2 mounting contract.

### 5B. Make both panels container-responsive

Fight cards may stack naturally, but expanded events need bounded internal scrolling and
long text wrapping. Leaderboard tables cannot assume 960px: use a labelled scroll region
for the full table or a compact row/card representation under a container query. Keep all
columns and headers accessible; never hide data solely with CSS. Verify both surfaces at
the same full-page, half-pane and phone widths as Phase 3.

### 5C. Register and integrate

Add `fights` and `leaderboard` to `SurfaceId` and `SURFACES`, including room routes and
labels. Replace the fixed three-entry shortcut map with a registry-derived lookup. Assign
`Cmd/Ctrl+4` to fights and `Cmd/Ctrl+5` to leaderboard, expose the shortcut in control
help, and ensure five tabs remain usable on 393px (scrollable tablist or compact labels;
do not squeeze unreadable buttons).

Migrate persisted `dm:paneSlots` defensively: valid old two-slot values continue to load,
unknown/removed IDs fall back to defaults, and the no-duplicates rule still holds. Preserve
lazy first mount so adding two surfaces does not issue fight/leaderboard queries on every
room visit. Add tests for registry order, shortcuts 1–5, selectors, lazy mount, state
survival, route links and room switch.

**Phase 5 exit gate:** all five surfaces can occupy either slot without duplicates; each
has a working full-page route where applicable; hidden never-opened surfaces do no data
work; and keyboard, focus, responsive and room-scoping checks pass.

## 5e. Delivery order and dependency summary

1. **3A–3B:** header contract + container CSS (unblocks reliable pane UI).
2. **3C–3D:** lifecycle tests + visual/a11y proof (closes Phase 3).
3. **4A:** item-use API and both Workshop/Ring affordances (highest player value).
4. **4B:** spawn/revive/send lifecycle actions.
5. **4C–4D:** room-scoped shop, parity and end-to-end hub acceptance (closes Phase 4).
6. **5A:** extract Fight Log and Leaderboard separately.
7. **5B–5C:** responsive presentations + registry integration (closes Phase 5).

Phase 4 depends on Phase 3's compact component contract. Phase 5 depends on Phase 3's
header-actions contract, but not on Phase 4; it can be scheduled independently after Phase
3 if product priority changes. No remaining phase depends on the balance simulation
harness because none changes combat balance.

## 5f. Current state, review findings and next work

| Area | State | Remaining work |
|---|---|---|
| Phase 3 header/responsive contract | Code-complete | Capture the 3D width and 200%-zoom evidence before visual sign-off. Post-"code-complete" this pass still found #113 (zero-monster workshop collapsing to a 6px strip) and #116 (the workshop crushing its own monster row instead of scrolling, at phone width) — both exactly what the pending visual sign-off exists to catch, and both invisible to the unit tests. |
| Phase 4A item use | ✅ Done | Prompt-free engine-backed use is available from the Workshop and the fighting monster's carried items appear in the Ring pane. |
| Phase 4B lifecycle | Partial | Revive and confirmed send-to-ring shipped; prompt-free spawn remains. "Shipped" did not mean "worked": #115 found send-to-ring confirming and then failing whenever any other owned monster was already in the ring, because the button checked only the monster being sent. |
| Phase 4C shop | ✅ Browse/buy shipped | Room-scoped read/buy APIs and the Workshop shop are complete; web selling remains optional parity work. |
| Phase 4D parity | Not started | Command reference, command-free journey, and final responsive/a11y pass depend on 4A–4C. |
| Phase 5 panels | Code-complete | Pair manual full-page/pane/phone verification with the Phase 3 visual pass. The same gap produced #114 (the leaderboard's "scrollable" region had the `role`, `tabIndex` and aria-label but no CSS) and #119 (fight log and leaderboard rendering a bare frame with no rows and no empty state). |

The post-implementation reviews found and fixed four issues: stale lazy surfaces briefly
querying a newly selected room; incomplete tab/tabpanel semantics; panel container rules
that did not reliably apply on full-page routes; and leaderboard overflow moving the whole
surface instead of a labelled, focusable table region. Regression coverage now protects
the room transition, accessibility relationship and panel structure. Item use, spawn, shop
and the command-free acceptance journey remain functional gaps, so this roadmap stays Active.

## 6. Test plan

- **Phase 1**: existing `workshopView.review-regressions.test.tsx` and
  `inventoryPanel.equip.test.tsx` pass with no edits. That is the proof the extraction was
  behaviour-neutral.
- **Phase 2 — done, see `apps/web/src/__tests__/terminal-panes.test.tsx`**: default slots
  (`['ring', 'console']`); the no-duplicates rule on each `PaneSelector`; switching a slot;
  `Cmd/Ctrl+3` in both layouts (including the "already in the other slot" case, which flips
  the active slot rather than duplicating); persistence round-trips through `localStorage`;
  a blocked `localStorage` still renders; a swapped-out surface is hidden, not unmounted
  (state survives the round trip).
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


## 5g. The monster carousel and its position indicator

Below the 900px container breakpoint `.workshop-monster-row` stops being a grid and
becomes a scroll-snapped horizontal carousel: each `.workshop-monster-panel` takes
`min(82cqw, 32rem)` — `min(88cqw, 25rem)` below 520px — so a phone shows one panel and a
roughly 44px sliver of the next.

That sliver was doing two jobs badly. It was the only signal that a player had more than
one monster, and because it cuts the neighbour mid-word (`Fo…`, `Wee…`, `PRE…`) it read as
a rendering fault rather than as an affordance — it was reported as one.

`.workshop-monster-dots` now carries that job: one marker per monster, the current one
filled, rendered only when there is more than one monster and only inside the same
`@container workshop (max-width: 900px)` block that makes the row scroll. Above that
width every panel is already on screen and there is nothing to indicate.

Three things about it are deliberate and worth keeping:

- **The dots are buttons, not decoration.** Tapping one scrolls that monster into view,
  honouring `prefers-reduced-motion`. A position indicator you cannot act on adds a row of
  pixels and no capability.
- **Each is labelled with its monster's name**, not "2 of 3". The name is what a player is
  navigating by; the ordinal is not information they have.
- **The button is the 44px tap target and draws nothing** — the visible marker is a
  `::before`. Sizing the button itself does not work: a border drawn for the marker wraps
  the whole tap target, which renders the dots as tall vertical bars. That was caught in
  Chromium at 393px and is exactly the kind of defect the unit tests cannot see.

The active dot tracks scroll position by measuring which panel sits nearest the row's left
edge, which is where `scroll-snap-align: start` parks them. It is a scroll listener rather
than an `IntersectionObserver` because the answer wanted is "which panel is snapped", not
"which panels intersect" — with a peeking neighbour, two panels always intersect.
