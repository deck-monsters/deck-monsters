---
type: Architecture
title: Web workspace
description: Terminal panes, routes, the breakpoint, and navigation for the web client.
status: stable
audience: internal
tags: [web, workspace, layout]
---
# Web workspace

Read before: changing `Terminal`, workspace surfaces, pane slots, routes, the 1024px
breakpoint, pane persistence, the divider, or navigation into a gameplay surface.

## Surface registry and hosts

`apps/web/src/components/surfaces.ts` is the canonical surface registry. It currently
defines, in keyboard-shortcut order:

| Shortcut | Surface | Full-page route |
|---|---|---|
| `Cmd/Ctrl+1` | Ring | workspace only |
| `Cmd/Ctrl+2` | Console | workspace only |
| `Cmd/Ctrl+3` | Workshop | `/room/:roomId/workshop` |
| `Cmd/Ctrl+4` | Fights | `/room/:roomId/fights` |
| `Cmd/Ctrl+5` | Leaders | `/room/:roomId/leaderboard` |

Workshop, Fight Log, and Leaderboard are layout-agnostic panels. A route host wraps the
panel as a full page; `Terminal` can render the same panel in a slot. Do not create a
second implementation for a pane.

Other routes remain outside the workspace: `/rooms`, `/room/:roomId/settings`, `/account`,
`/leaderboard`, authentication/reset pages, and invite links.

## Help and guides

`HelpPanel` (`components/HelpPanel.tsx`) is the Help page; `HelpView` hosts it full page at `/room/:roomId/help` and, outside a room, `/help`. The header menu (desktop nav and
the ☰ menu) has a **Help and guides** link to those routes, like Workshop and Fight log.

Help is **deliberately not a registered surface**: the phone tab bar already overflows at
390px with five tabs, so a sixth would make it worse. It is a route only, and `App.tsx`
lazy-loads `HelpView` so the bundled guides are a separate chunk.

Its text is not fetched. `PLAYER_HANDBOOK.md`, `MONSTERS.md`, `CARDS.md` and `ITEMS.md` at
the repo root are imported with Vite `?raw` and bundled at build time, so **`pnpm run
build:docs` (then a web build) refreshes what players read**; `apps/web/railway.toml` lists
those files in `watchPatterns` so a regeneration redeploys the web service. Railway builds
from the monorepo root, so they are in the build context. The **Commands** section renders
`COMMAND_CATALOG`, the same data as the Console's `CommandReference`, which also supplies
its category labels and order.

`lib/markdown.tsx` is a small purpose-built renderer for the shapes those guides use (no
Markdown dependency; it emits React elements, never HTML strings). Tables and code blocks
scroll inside their own focusable `.help-table-region` / `.help-pre` box, never the page.
Adding Markdown syntax to a generator means checking the renderer handles it.

## Two slots and the breakpoint

`Terminal` stores exactly two distinct `SurfaceId`s. Fresh viewers get
`['ring', 'console']`.

- At a container width of **1024px or more**, both slots are visible side by side and each
  has a selector that excludes the surface already in its sibling slot.
- Below **1024px**, one slot is visible and the tab list exposes all registered surfaces.
  A tab that already occupies the hidden slot activates that slot instead of duplicating
  the surface.
- Wide shortcuts place a missing surface into slot 1, preserving the default Ring in slot
  0. Narrow shortcuts use the same activation rule as tabs.

The slot pair is stored in `localStorage` as `dm:paneSlots`. Reads validate both ids and
the no-duplicates invariant; missing, blocked, or stale storage falls back to defaults.

## Mounting and room changes

Only the two initial slot surfaces mount on room entry. A surface mounts lazily the first
time it is shown, then stays mounted and is hidden with CSS when switched out. This
preserves selection, drag state, filters, expansion state, and scroll position without
issuing every surface's queries on every room load.

Transient UI state is instance-local. A full-page Workshop in another tab and a Workshop
pane share server data through room-scoped queries and invalidation, but do not synchronize
drag selections or scroll position.

Retained surfaces are room-local. On `roomId` change, `Terminal` synchronously gates the
old retained set, resets it to the current slots, and keys rendered surfaces with the new
room. A previously visited surface must never issue a query for the new room merely because
it was open in the old one.

## Slot, divider, and DOM contracts

`.terminal-slot` is the layout, visibility, container-query, and divider boundary. It
carries `data-pane-slot="0|1"`. `PaneDivider` measures slot 0 through that attribute; it
must not infer a slot from a child surface class.

Mounted surfaces render in this DOM order:

1. slot 0;
2. slot 1;
3. retained hidden surfaces.

CSS grid may place the slots visually, but DOM order remains left then right for keyboard
focus and screen-reader reading order. React keys by surface and room, so swapping slots
moves an existing node instead of remounting it.

The divider is shown only in wide mode, supports pointer drag and keyboard arrows, and
keeps both panes at least 300px wide during pointer drag.

## Responsive component boundary

A surface can be full-page, a resized desktop pane, or the only phone pane. Surface layout
therefore responds to its container, not the viewport. `.terminal-slot` establishes
`container-type: inline-size`; standalone panels establish their own named containers.

Do not key component layouts to `.terminal-slot` or to viewport media queries. The same
panel CSS must work at full-page, approximately half-page, narrow divider positions,
393px, and 200% zoom. Horizontal scrolling is allowed only on a deliberately labelled
internal region, such as the leaderboard table or Workshop monster rail; the surface root
must not overflow.

## Navigation boundary

Tabs, pane selectors, shortcuts, command links, and other in-app surface links **reveal the
surface in the current workspace**. They do not navigate away from the Ring.

Only the explicitly labelled “Open … as a full page” control uses a surface's route.
Entering or bookmarking that route still opens the standalone page. On mobile, reveal
selects the one visible slot. Returning to the workspace restores the persisted pair.

## Ring feed row heights

The Ring event list is a Virtuoso window. It mounts when ring history has been applied,
because Virtuoso reads `heightEstimates` only while its size tree is empty and the empty
placeholder fills that tree. Narration is one or two lines and a card box is a tall fenced
frame, so the list passes a per-row `heightEstimates` value
(`apps/web/src/utils/feed-row-height.ts`) until the row is measured. The guess is the
feed's CSS line box and the pane's measured column width; a taller line still corrects
`scrollTop` once the row mounts. Without that guess, scrolling up into earlier fights
corrects `scrollTop` against the gesture (#196). The
follow-the-bottom re-pin still scrolls the scroller's own `scrollHeight` (#159). The
fight-log box (`.fight-log-events`) is a separate scroller and does not use this estimate.
The list also waits for a real width. A pane hidden with `display: none` (the other slot
under 1024px) measures 0, and Virtuoso reads the guesses only once, so mounting it there
froze the 48-column `FEED_WRAP_COLUMNS_FALLBACK` into them: on a wider pane, narration was
booked at up to twice its height. ResizeObserver reports the width when the pane is shown,
and the list mounts then. Without ResizeObserver the fallback is used.

## Card frames

A card box is the 34-column character frame from `formatCard`
(`packages/engine/src/helpers/card.ts`). The web draws that text in a monospace panel
(`.event-card-block`); it does not replace the characters with a CSS border. Pictographs
count as two columns and variation selectors as none, because that is the width the feed
font advances. Only text that needs it takes that path; plain text keeps `word-wrap`'s
breaks. Both give 32 columns after the one-space indent, and each authored line is wrapped
on its own, so a stats block keeps its line breaks. Counting UTF-16 units instead let a BMP pictograph (`⏳`) paint past the
`=` border (#197). Astral pictographs (`💪`, `🦄`) are already two units, so they already
met the frame. Discord receives the same string. Fenced card text is not a place for
inline sprites: a sprite is wider than the column the emoji was counted as
(`format-event-text.tsx`).

## Change checklist

- [ ] Add a surface once in `SURFACES`; tabs, selectors, and shortcuts derive from it.
- [ ] Preserve two distinct slots and validated `dm:paneSlots` fallback.
- [ ] Never mount an unopened lazy surface just to hide it.
- [ ] Reset retained surface state and all query inputs on room change.
- [ ] Keep `data-pane-slot` as the divider contract.
- [ ] Keep slot 0 before slot 1 in DOM order.
- [ ] Use container queries for surface layout.
- [ ] Reveal in-workspace by default; reserve route navigation for the labelled full-page action.
