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
| `Cmd/Ctrl+3` | Chat | `/room/:roomId/chat` |
| `Cmd/Ctrl+4` | Workshop | `/room/:roomId/workshop` |
| `Cmd/Ctrl+5` | Fights | `/room/:roomId/fights` |
| `Cmd/Ctrl+6` | Leaders | `/room/:roomId/leaderboard` |

Shortcuts are registry indexes, so inserting a surface renumbers the ones after it (Chat took 3
in roadmap 41; Workshop, Fights and Leaders moved up one). Nothing in the app's help text names
a shortcut number.

### The Chat surface (roadmap 41)

`ChatPanel` renders the room's chat from `useChat()` (`hooks/useChat.ts`); it never calls
`chat.*` itself. `Terminal` mounts `RingFeedProvider` and `ChatProvider` around the tab bar
and every pane, so the Console, the Chat tab and the unread badge share one state. The
standalone route (`views/ChatView.tsx`) brings its own providers because it never mounts
`Terminal`. Row building (time dividers at a 30-minute gap or a new local day, fight dividers
when `fightNumber` changes, the new-since marker) is the pure `utils/chat-rows.ts`.

- **Mark-read rule.** The panel calls `markRead(newest id)` only when it is the visible
  surface (`isActive`), the document is visible, and the list is scrolled to the bottom, and
  never before the opening scroll has settled. A panel left mounted behind another tab, or in
  a background browser tab, never marks messages seen. A message you send scrolls you to the
  bottom. While scrolled up, new messages show a `↓ New messages` button
  (`jump-to-bottom`, title `Jump to the newest messages`).
- **Opening.** The new-since position is captured when the panel becomes visible and
  `useChat().loaded` is true (a live frame can arrive before history, when `lastReadId` is
  still 0), and again each time it returns to screen. The list then scrolls to the
  `New since you were last here` marker, not the bottom, and the player marks it read by
  reaching the bottom. The marker goes before the first later message from someone else, and
  is omitted when nothing was ever read.
- **Midnight.** `ChatPanel` re-renders its dividers when the local date changes, so
  `Today` / `Yesterday` never go stale.
- **Composer.** The input clears when a send starts (a ref guards a second Enter); a refusal
  gives the text back unless the player typed something newer, and editing clears the
  refusal. A chosen recipient highlights the To picker itself (`dm-preview-name`, shared with
  the Console's DM preview) rather than adding a line. DM rows read like the Console:
  `✉️ Ben to you: …`, `✉️ You to Ben: …`. `ChatView` keys its providers and panel by room.
- **Tab badge hook.** A surface may define `badge(state) => number` (and `badgeNoun`) in the
  registry; `state` is `{ chatUnread }`, read by `TerminalTabs` (the tab bar, a component of
  its own so it can call `useChat`). A positive count draws `.terminal-tab-badge` (capped
  `99+`, `aria-hidden`) and sets the tab's `aria-label` to `Chat, {n} unread`. `useChat`
  already excludes your own messages from `unread`. The badge sits in the tab's top-right
  corner, 13px tall so it ends above the label. It exists only in the tabbed layout; side by
  side `PaneSelector` writes the same count into the option (`Chat · 3 unread`). The ☰ menu and
  desktop nav also link Chat (title: the surface description).

## One name per place

The tab names win (roadmap 39 B4): **The Ring, Console, Chat, Workshop, Fights, Leaders**. The
tabs, pane selectors, ☰ menu, desktop nav links, panel headings and aria-labels use them;
the routes keep their old paths (`/fights`, `/leaderboard`) so links do not break. The
menu's former "Terminal" link goes to `/room/:roomId`, which renders the workspace whose
default is The Ring, so it is labelled "The Ring". "Help and guides" and the command
reference `?` keep their names.

On a phone (`max-width: 480px`) the six tabs share the bar's width instead of scrolling it:
`flex: 1 1 auto` (each tab starts from its label's width; equal shares starved "Workshop" once
there were six), 0.15rem side padding, 0.75rem font, `min-height: 44px`. Measured in Chromium:
at 390px the tabs are 75, 67, 46, 75, 60 and 67 px wide with no scrolling (360px and 320px also
fit). The unread badge is positioned over the tab's corner so it adds no width. Covered by
`tab-names-css.test.ts`.

Fights and Leaders also read `game.ringState` (via `useFightOnRing`) so their empty states
say "A fight is on in the ring" instead of claiming nothing has happened.

Workshop, Fights, and Leaders are layout-agnostic panels. A route host wraps the
panel as a full page; `Terminal` can render the same panel in a slot. Do not create a
second implementation for a pane.

Other routes remain outside the workspace: `/rooms`, `/room/:roomId/settings`, `/account`,
`/leaderboard`, authentication/reset pages, and invite links.

## Every button and place says what it is for

Every `<button>` carries a `title`: one line saying what it does, shown on hover and read by
screen readers. A phone never shows a `title`, so on a phone the **visible label** has to
carry the meaning (an icon-only control is a universal one such as ☰, ✕ or ↓, or it gets
words: ⟲ became "Unequip all"). Each surface also has a `description` in the registry
(`surface-descriptions.ts`, re-exported as `surfaceDescription` from `surfaces.ts`; a
separate file because the panels import it and `surfaces.ts` imports the panels). It is the
tab's `title` and the subtitle under the panel heading. `button-titles.test.ts` fails, naming
`file:line`, on any `<button` without a `title=`, so a new button needs its line decided
(roadmap 39 batch 3).

## The Console while a prompt is open

While `ConsolePane` has an open prompt (`activePromptId`), it renders neither the
quick-action chips nor the getting-started guide, so the question is on screen on a
phone (roadmap 39 B1; the walk found both covering it). They come back when the prompt
closes; the guide is only unrendered, not dismissed, and a `quick_actions` event that
arrives meanwhile is kept. The "A command is waiting for your answer. Command suggestions
are paused." banner still shows when the prompt is scrolled out of view, and is now true.

## Chat in the Console

`ConsolePane` reads the room's shared chat state with `useChat()` (one `ChatProvider` per
room, mounted in `Terminal`; the Console never calls `chat.history` itself, roadmap 41).

- **Live lines only.** It subscribes with `subscribeLive` and adds each message that arrives
  while it is mounted, deduped by message id (our own send is announced both directly and by
  its frame). The backlog is not replayed; the Chat tab holds it. Lines read `💬 {name}: {text}`,
  `💬 You: {text}`, `✉️ {name} to you: {text}` and `✉️ You to {name}: {text}`
  (`chatLineText`, `lib/direct-message.ts`), and carry the class `console-chat`.
- **Unread line.** Once, on the first non-zero unread count, unless a live chat line has
  already shown: `💬 {n} new {message|messages} in Chat.`
- **Chat while a question is open.** `submitInput` checks `isChatLine` before the prompt
  branch, so a line starting `msg `, `message ` or `dm ` followed by text goes to
  `game.command` (the server catches it before its flow checks, see
  [the command pipeline](engine-concurrency-and-timing.md#2-server-command-pipeline-packagesserversrctrpcrouterts))
  and the question stays open. While a question is open `m` is NOT a chat command, and neither
  is a bare `msg`: "M Jones" is a plausible answer to a naming prompt, and posting it to the
  whole room would be worse than a missed chat. Outside a question `m` works. The typed line is
  not echoed; the chat line is the echo. The input clears at once and the text is put back on a
  refusal (with a picked player's pick), unless the player has typed something newer.
- **Who a DM goes to is visible before it is sent.** While the input starts `dm ` (leading
  whitespace ignored, as on the server), a line above the input (`.dm-preview`, in an
  `aria-live="polite"` region) shows `To: {name}` with the name in `.dm-preview-name`, the
  warning when another player's name also fits, or the same refusal the server would give: no
  match yet, `That's you`, two players with one name, or the usage hint for a bare `dm `. The
  match is the engine's `matchRecipient` over the server's own candidate list (`chat.dmNames`:
  character names and account display names of current members, you included), so the preview
  cannot disagree with the send. Names are compared with any Unicode space as one space and
  zero-width characters removed. Two players whose names are identical are refused on the typed
  path (`ambiguous`); picking from the list still works.
- **Suggestions after `dm `** are the room's players (`orderDmSuggestions`): the player you
  last sent a DM to, then the player who last sent you one if different, then players with a
  monster in the ring (`game.ringState`), then everyone else A to Z. A player appears once.
  Typing narrows it.
- **Picked means exact.** Choosing a suggestion remembers that player's id. While the input
  still begins `dm {that exact name} `, submit sends with `useChat().send(message, toUserId)`:
  the id, never re-parsed from text, so a player renamed to catch messages cannot steal a pick.
  Editing the name forgets the id. A TYPED name the preview resolved to one player is sent by
  that player's id too, so what the preview showed is what is sent even if the member list
  changed meanwhile (the server still checks the player is a member). Names are re-fetched on
  every feed handshake and, throttled to once per 10 s, as a `dm ` line starts. A line the
  preview could not resolve, or a name with no message, goes to the server so each refusal text
  has one home.

## The getting-started guide

One hook, `hooks/useGuidedStart.ts`, decides the step; `components/GuidedStartBox.tsx`
renders it in the Console (command chip and hint, hidden while a prompt is open) and in the
Workshop (words only, under the Train row, hidden while a Console flow is running, never on
`spawn`). Steps, from `myInventory`: `spawn` (no monster), `equip` (a living monster outside
the ring with fewer cards than slots; the old `equip_send` step suggested sending a monster
whose deck was not full and the send was refused), `send` (full deck, none in the ring),
`waiting` (a monster in the ring, no fight yet; says a boss can be summoned, with
`BOSS_SUMMON_LIMIT` from the engine), `fallen`, `change_card`, `hidden`. `fallen` wins over
`change_card`. `change_card` ends when the deck fingerprint (each monster's cards, order
ignored) differs from the one taken as the step began, which is how the web sees an equip,
unequip or move however it was made (Console or Workshop); in-memory baseline, so a reload
re-takes it.

Dismissal and completion are one flag per user **and room** in local storage,
`ftuxComplete:${userId}:${roomId}`, shared by both surfaces, so dismissing in either hides
both while another room is unaffected. The older per-user `ftuxComplete:${userId}` (and the
plain `ftuxComplete`) still count as complete in every room, so nobody who dismissed the
guide before sees it again. Whether the player is *established* (a monster that has fought,
past ring outcomes in console history, or more than one monster) is decided **once per
room**, from the first load of inventory and history; a new player is marked
`ftuxStarted:${userId}:${roomId}`. Testing it on every change ended the guide the moment a
new player's first fight made `battles > 0`, so no step could follow the first fight. The
guide stays hidden until that first load settles, and stays hidden if the history query
fails (a veteran cannot be told from a new player without it).

Details that were reviewed: `waiting` outranks `equip` (a monster already in the ring means
the player is waiting on a fight, whatever another monster's deck is); every dead monster in
the inventory is revivable, because a permanently destroyed monster is dropped from the
character (`Ring.handleLoser`'s `dropMonster`) and so never appears, and `revivesAt` is null
until a revival is started; "a fight was fought" is sticky for the session, so burying the
only monster that fought does not rewind the guide; and `change_card` compares only monsters
present in both the baseline and the current inventory (by name), so training or burying a
monster is not read as changing a card.

## Help and guides

`HelpPanel` (`components/HelpPanel.tsx`) is the Help page; `HelpView` hosts it full page at `/room/:roomId/help` and, outside a room, `/help`. The header menu (desktop nav and
the ☰ menu) has a **Help and guides** link to those routes, like Workshop and Fights.

Help is **deliberately not a registered surface**: the phone tab bar is full at
390px with five tabs, so a sixth would not fit. It is a route only, and `App.tsx`
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

## First-time mechanic notes

The first time a player sees a ring event, an ambush, bosses turning on each other or a
boss temperament, one dim `.mechanic-note` line (prefixed `ⓘ `) appears under that line in
the Ring feed and the Console feed. The engine tags the lines (`payload.mechanic`, or
`payload.ringEvent.id`); `lib/mechanic-notes.ts` holds the note text, keyed `ring-event:<id>`,
`ambush`, `boss-rivals`, `boss-temperament`, and a test fails for any ring event without one.
State is a per-player set in local storage, `mechanicsExplained:${userId}`, shared by both
feeds. The first row to ask for a key claims it in memory for the session, because the feeds
are virtualized and a row re-renders: without the claim, showing the note would hide it on
the next render. The Ring waits for the handshake's user id before claiming. Nothing is
blocked or delayed; there is no modal. The Console only has the lines it is given (private
events, highlights and console history), so a public-only line reaches it via history.

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
placeholder fills that tree. An event with `payload.lines` is several blocks (one per
line, or one composed sentence), and a card is a tall frame, so the list passes a per-row
`heightEstimates` value (`apps/web/src/utils/feed-row-height.ts`) until the row is
measured. The guess sums the same blocks `FeedLines` draws, using the feed's CSS line box,
the pane's measured column width, and the gap between lines (`--feed-line-gap`). A taller
line still corrects `scrollTop` once the row mounts. Events stored before lines existed
fall back to the old text guess.

The guess reads the live CSS, so a theme can set its own feed type. The feed's size, line
height and letter spacing are tokens (`--feed-font-size`, `--feed-line-height`,
`--feed-letter-spacing`, on `:root` in `theme-phosphor.css`), and `readFeedMetrics` in
`utils/feed-row-height.ts` measures the line box, the character advance, the row and card-block
chrome and the list's gutter from a hidden probe row in the pane. It runs when the list mounts
and when the theme changes, never per event. Because Virtuoso reads the guesses only once, a
theme change unmounts the list, measures, and mounts it again; a lazily loaded theme
(Millefleur) is measured only after its stylesheet has arrived (`themeAssetsReady` in
`useTheme.ts`). Under jsdom the reader returns `DEFAULT_FEED_METRICS`, which equal the old
constants (14 px × 1.4, 8.4 px per character). Millefleur sets 12.5 px on a 1.65 line, its
design's transcript (roadmap 46). Reading the CSS also corrected one theme: Street Fighter's
card block has a wider border, so its card chrome is 32.8 px, not the 30.8 px the old constant
assumed (bug 234). A row that needs a wider box must not change its content width: Millefleur's
boss-arrival card reaches into the gutter with a negative inline margin and matching padding,
so its text wraps exactly like every other row. Without that guess, scrolling up into earlier fights
corrects `scrollTop` against the gesture (#196). The
follow-the-bottom re-pin still scrolls the scroller's own `scrollHeight` (#159). The
fight-log box (`.fight-log-events`) is a separate scroller and does not use this estimate.
The list also waits for a real width. A pane hidden with `display: none` (the other slot
under 1024px) measures 0, and Virtuoso reads the guesses only once, so mounting it there
froze the 48-column `FEED_WRAP_COLUMNS_FALLBACK` into them: on a wider pane, narration was
booked at up to twice its height. ResizeObserver reports the width when the pane is shown,
and the list mounts then. Without ResizeObserver the fallback is used.

## Card frames

When an event has `payload.lines`, the web draws those lines (`components/FeedLines.tsx`,
blocks from `utils/feed-lines.ts`) instead of the engine's `text`. A `card` line is the
frame's title and body with the ASCII rules already removed: the panel (`.event-card-block`)
paints a title, a CSS rule (`.feed-card-title`) and the body. Spacing between lines is the
CSS gap, not blank lines baked into `text`. Millefleur (`feedStyle` `millefleur`) replaces
some kinds with composed sentences — a round is a divider, a play names the card, a roll
is one dim sentence, a bloodied HP line gains a rose ", bloodied" inside the sentence.
Every other theme is `terminal`: one block per line, the engine's own words. `text` is
not rewritten. Discord and pacing still use it.

Events with no lines (history from before roadmap 46, private command replies) still draw
`text`. A card box there is the 34-column character frame from `formatCard`
(`packages/engine/src/helpers/card.ts`), in the same monospace panel. Pictographs
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
