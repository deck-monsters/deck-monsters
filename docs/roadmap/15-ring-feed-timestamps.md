# Ring feed: timestamps and “time ago” display

**Status**: Implemented (Ring pane v1)  
**Related**: `06a-web-app.md` (web UI), `14-fight-stats.md` (fight log)

## Goals

- Show **human-readable relative time** (“2 min ago”) for **key ring moments** without crowding the terminal-style feed.
- Put **full absolute timestamps** on **every** feed row as **hover/tooltip** (and structured HTML metadata) so power users can inspect exact times.
- Prefer **small, focused dependencies**: `timeago.js` (~2KB) for relative strings; **`Intl.DateTimeFormat`** / **`Intl.RelativeTimeFormat`** for absolute tooltips and future i18n (no heavy i18n framework required for v1).

## Key events (Ring public feed)

| Event type | Meaning | Notes |
|------------|---------|--------|
| `ring.add` | Monster enters the ring | Single clear moment |
| `ring.remove` | Monster leaves the ring | |
| `ring.fight` | Fight **begins** vs **ends** | Distinguish via `payload.eventName === 'fightConcludes'` (end); otherwise start (including `announceFight`) |
| `ring.countdown` | Optional: fight countdown | Treat as secondary; can omit inline badge if too noisy |

Private outcome events (`ring.win`, etc.) are not in the public feed; fight **end** is visible as `ring.fight` with `fightConcludes` or as `announce` lines—UI keys off `ring.fight` + payload first.

## Placement options (chosen default: **D**)

**A. Right-aligned meta column**  
Small column on the right: `2m ago` only for key rows. Clean scan line; may compete with scrollbars on narrow panes.

**B. Inline suffix**  
Append `· 2m ago` in dim text after the first line of the message. Very compact; can wrap oddly on long lines.

**C. Second line**  
Dim second line under the message for key events only. Clear separation; uses more vertical space.

**D. End of row, flex (default)**  
Flex row: message `flex: 1`, key-meta `flex-shrink: 0` with `timeago` + optional short label (`Fight began`). Keeps one line height where possible; key meta uses smaller/dimmer font.

**E. Left gutter icon + time**  
Narrow left column with a dot or icon for key events only. Strong visual rhythm; slightly more layout work.

We implement **D** with **tooltip (`title`) + `data-event-at` on every `<li>`** for all events, and inline `timeago` only for **key** events.

## Metadata (HTML)

Every feed item:

- `data-event-at="{ISO8601}"` — machine-readable instant (event `timestamp` ms → ISO).
- `title="{locale absolute string}"` — full date/time on hover (e.g. `Intl.DateTimeFormat` with `dateStyle` + `timeStyle`).

Key-event inline span (optional):

- `class="event-key-timeago"` for potential `timeago.js` `render()` hooks later.

## Updating relative strings

- React `useEffect` + `setInterval` (e.g. 30s) calling `timeago.format()` so “2 min ago” advances without full page reload.
- Optional later: `timeago.js` `render` on a ref container for DOM-driven updates (not required if interval is acceptable).

## Out of scope (v1)

- Localizing game **content** strings (still English engine text).
- Showing relative time on **Console** private feed (can reuse same utilities later).

## Tasks

- [x] This proposal doc
- [x] Add `timeago.js` to `apps/web`
- [x] `useTimeAgo` + `formatEventHoverTitle` using `Intl.DateTimeFormat`
- [x] `RingPane`: `data-event-at` + `title` on every row; inline timeago for key events only (`ring.add`, `ring.remove`, `ring.fight` start/end)
