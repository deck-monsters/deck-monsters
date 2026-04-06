# Web App — Rebuilt from Scratch

**Category**: Feature / Connector  
**Priority**: High  
**Status**: In progress — `06-web-app.md` describes the previous implementation; this document supersedes it with a revised vision. The old implementation is preserved as reference material while the rebuild takes shape.

---

## The Vision

Deck Monsters is a text-based game. That is not a limitation — it is the game. The web app should look like it belongs to the same world as MOOs, MUDs, BBS doors, Commodore 64 BASIC prompts, glowing green terminal phosphor, and all-night telnet sessions. Not as a nostalgic costume layered over a normal web UI, but as a genuine design commitment. The charm of the original Slack game came from its unabashed simplicity: a stream of text, a few lines of input, a shared feed of battle events that everyone in the channel could follow. We want to bring that same feeling to the browser.

The fantasy lineage matters too. This is a game about monsters and magic cards, rooted in D&D, Magic: The Gathering, and a healthy dose of whimsy — think Tom Bombadil wandering into your combat encounter and narrating it in rhyme, or the chaos of a late-night session where the DM is clearly enjoying themselves a little too much. That spirit should come through in the writing, the event feed, the way the game talks to you. The aesthetic is: **dungeon master via modem**.

### Influences

The look and feel should draw from a specific lineage of computing and design. None of these need to be literally referenced — they're a mood board for the team:

- **Edward Tufte** — high data-ink ratio. Every pixel earns its place. No chartjunk, no decorative frames around things that can stand alone. The text *is* the interface; the chrome should disappear. Density is fine when the density is meaningful.
- **Jeffrey Zeldman / CSS Zen Garden** — the same semantic HTML can wear radically different visual themes. Markup describes meaning, CSS describes presentation, and the two stay separable. We design once and re-skin freely.
- **Remy Sharp** — progressive enhancement. The page works as plain HTML and gets better with JavaScript. A view-source on a Deck Monsters page should be readable and meaningful.
- **Atari and Amiga** — chunky, confident, color-on-black UI. Not photorealistic, not skeuomorphic. Pixels and text doing exactly what they need to do, and looking cool while doing it.
- **Bell Labs / Plan 9 / Unix** — the philosophy of a small number of well-defined primitives composed by the user. Pipes and prompts. The system trusts you to know what you're doing and gets out of the way.
- **Apollo Guidance Computer** — dense, mission-critical, monospace, glowing. A small character grid carrying enormous consequence. Every glyph matters.
- ***Sneakers* and *WarGames*** — the cinematic terminal. Modems chirping, DEFCON climbing, "would you like to play a game?", green-on-black with a soft glow at the edge of the CRT. Harrison Ford squinting at a screen on the *Millennium Falcon* and somehow knowing exactly what those scrolling glyphs mean.

The throughline: **the screen is content first, ornament second**. The game engine is already producing beautiful text. Our job is to frame it without getting in the way.

---

## Core UX Concept: Two-Pane Terminal

The original Slack game had a natural two-channel structure:

- **The Ring** (public channel): shared feed of all ring events — battles, knockouts, victors, commentary. Everyone in the room sees this. Spectators and players alike watch the same stream.
- **Your Console** (DM with the bot): where you do almost everything — spawn monsters, equip decks, send a monster to the ring, buy items, respond to prompts. Private between you and the game.

The web app should replicate this structure directly. **Two panels, side by side on desktop, toggled on mobile:**

```
┌─────────────────────────────────────┬──────────────────────────────────┐
│  THE RING  [Room: Tavern Basement]  │  YOUR CONSOLE  [Beastmaster: X]  │
│─────────────────────────────────────│──────────────────────────────────│
│  > ROUND 7                          │  > look at monsters              │
│  Stonefang attacks Whisperwind      │  You have 2 monsters:            │
│  with Righteous Cleave!             │    1. Stonefang  [Basilisk, L4]  │
│  1d20 + 4 vs AC 14... 17. Hit!      │    2. Mirebell   [Jinn, L2]      │
│  11 damage. Whisperwind has 3 HP    │                                  │
│  remaining.                         │  > send mirebell to the ring     │
│                                     │  Mirebell slinks toward the ring │
│  Whisperwind uses Whimsy!           │  and eyes her opponents.         │
│  A nearby cat watches judgmentally. │                                  │
│                                     │  > _                             │
│  [scrolling...]                     │                                  │
└─────────────────────────────────────┴──────────────────────────────────┘
```

The Ring pane is **read-only** — a live, auto-scrolling feed of `announce` events from the server's public channel. The Console pane is where the player types commands and sees private replies.

Both panes render the same way: **monospace font, dark background, no cards, no panels, no sidebars, no modals**. The game talks to you in text and you respond in text. This is the aesthetic foundation everything else is built on.

### Layout Breakpoints (and Why Width Matters So Much)

The game engine outputs text cards that are **34 characters wide** (`formatCard` in `packages/engine/src/helpers/card.ts` wraps content to width 32 inside a 34-character border). These cards do not soft-wrap — if the readable area is narrower than 34 monospace characters, the borders will visually break and cards will look wrong. Some other engine output is wider still (combat lines, multi-column stats). A safe minimum is **about 40 monospace characters** of *clear, gutter-free content area* per pane, with **48–60 characters** being comfortable.

This shapes the layout in three ways:

1. **Side-by-side desktop layout** — used when each pane can comfortably host at least ~48 characters of monospace text plus minimal padding. On a typical 16px monospace font (~10px per character), this means each pane needs ~480px of usable width, or ~960px total plus a small divider. Comfortably above ~1024px viewport width, side-by-side is the default.
2. **Tabbed desktop layout** — when the desktop window is narrow (laptop in split-screen, narrow browser window, etc.), gracefully fall back to **the same tabbed layout used on mobile**. Tabs are cheap; flipping back and forth is fine. This is much better than cramming two panes into widths that mangle the cards.
3. **Mobile single-pane** — phone-width screens always use tabs. The active tab fills the viewport edge to edge, with the input dock at the bottom.

### Chrome Budget

The number-one design rule for the game viewport: **do not steal horizontal space**. Every pixel taken by side padding, margins, frames, scrollbars, or decorative borders is a pixel that can't be used to render game text. Specifically:

- No fixed sidebars in the gameplay screen. Navigation lives in a small top header that does not consume horizontal space, or a slide-out drawer toggled by a hamburger.
- No avatar columns, no nested padding, no card-shaped containers around text content. The text *is* the container.
- Scrollbars should be overlay-style where supported, or use thin styling that doesn't subtract from content width.
- Padding inside each pane is minimal (e.g., `0.5rem`), enough to keep text from touching the edge but no more.
- Font size on mobile may need to be slightly smaller than typical body text (e.g., 13–14px) so 40+ characters fit on a 360px-wide phone screen. On desktop, 14–16px is comfortable. This is the kind of decision that should be testable across themes — see the theming section.

---

## Interaction Model: Inline, Not Popup

The current implementation uses popovers/modals for interactive prompts (equip, shop, spawn). These are being dropped entirely. Instead:

**Interactive prompts render inline in the Console stream**, exactly like they would in a text adventure or a chat-style interaction. The game asks a question, the question appears in the feed, and the player answers. The thread continues below.

```
> spawn a monster

What type of monster would you like to spawn?

  [1] Basilisk       [2] Gladiator
  [3] Jinn           [4] Minotaur
  [5] Weeping Angel

>
```

The numbered options are **clickable** — clicking `[2]` is equivalent to typing `2` and pressing Enter. On mobile, tappable buttons are even more important since there's no keyboard present for quick input. But they're not cards or modals — they're styled inline choices that look like they belong in the same text stream.

Similarly, the Console can surface **quick-action suggestions** beneath the input field: short command snippets relevant to the current game state (e.g., "send stonefang to the ring", "look at monsters", "visit the shop"). Tapping one fills the input or submits it directly. These are aids, not required UI — you can always type freely.

### Rules for Inline Interactions

- Every prompt, choice, and response renders in the Console text stream in order
- No overlays, popovers, slide-in panels, or modals for game interactions
- Choices are clickable/tappable, but the raw text input always works too
- Multi-step flows are visible as a conversation thread — you can scroll back and see the whole exchange
- Cancelled or timed-out flows leave a visible tombstone in the stream ("This action timed out. Try again.")

---

## Mobile-First

Mobile is likely the primary play surface. As described in the breakpoints section above, the layout uses tabs whenever there isn't enough horizontal room to host both panes comfortably — which on phones is always.

On mobile:
- The input field is always docked at the bottom of the screen (above the soft keyboard, respecting safe areas / iOS notches)
- Inline choice buttons are full-width tappable rows, not compact inline chips
- Quick-action suggestions are a horizontal scroll strip above the input field
- Text is sized to fit the engine's 34-character cards without horizontal scroll, even on the smallest commonly-supported viewport (~320px wide). This may mean a 13–14px font size — smaller than typical web body text, but appropriate for monospace and the terminal aesthetic
- Auto-scroll behavior: the Ring tab auto-scrolls to the latest event; the Console tab auto-scrolls unless the player has manually scrolled up to review history (then a "jump to bottom" affordance appears)
- Tab switching preserves scroll position in each tab so flipping back and forth doesn't lose your place

On desktop:
- Both panes side by side when the viewport is wide enough (≥ ~1024px)
- Tabs fallback when narrower — same component, same behavior as mobile
- The divider between panes can be dragged to favor one pane over the other (within sane minimums that still fit a 34-char card)
- Keyboard-first: all interactions should be completable without reaching for the mouse, including switching tabs (e.g., `Ctrl/Cmd+1` for Ring, `Ctrl/Cmd+2` for Console)

---

## The Default Aesthetic

The shipped default theme should feel like a terminal. Suggested baseline:

- **Font**: monospace throughout — `JetBrains Mono`, `IBM Plex Mono`, `Fira Code`, or system monospace fallback (loaded via `@fontsource` so we don't depend on a CDN)
- **Colors**: dark background, primary text in the green-amber phosphor spectrum, dim gray for secondary/system text, a brighter accent for prompts and player input
- **No rounded corners, no drop shadows, no gradients** on game elements — square, flat, terminal
- **Cursor**: blinking block or underline cursor on the input field
- **Scanline effect**: optional, subtle CRT scanline overlay — off by default, toggle in settings

### Typography Hierarchy

```
[system / timestamp]    dim, smaller, secondary color
> player input          accent color
game response           primary text color
  choices / options     indented, slightly dimmer, brackets around numbers
-- section dividers --  dashes, pure ASCII
ROUND 7                 ALL CAPS for structural events
```

No icons, no emoji in the core game stream unless the server sends them (node-emoji output from the game engine is fine — those are part of the game's voice, not a design system). No avatars. No reaction buttons. No thread nesting.

### Sound (Optional, Off by Default)

A setting to enable subtle retro sound effects: keyclick on input, soft chime on private event, deeper resonance for combat events. Off by default. Not in scope for the first pass but worth noting as a future toggle.

---

## Theming: Semantic Markup, Swappable Skins

The default theme is green phosphor on black, but **the markup should never assume that**. We follow the CSS Zen Garden principle: HTML describes meaning, CSS describes appearance, and a player should be able to switch between (or build) themes without touching the HTML or JS.

This matters because tastes vary — some players will prefer:

- Amber on black (vintage Hercules / IBM 5151 monochrome)
- Black on white / "paper terminal" (closer to a printed adventure module)
- Apollo blue on black
- High-contrast accessibility theme
- A toned-down "modern dark" theme for people who find phosphor green to be too much
- Custom themes contributed by the community

All of these should be reachable by swapping a single stylesheet (or toggling a `data-theme` attribute on `<html>`), with **no markup or component changes**.

### How to Build It

**1. Semantic HTML.** Use elements that describe what they are, not what they look like:

```html
<main class="terminal">
  <section class="pane pane-ring" aria-label="The Ring">
    <ol class="event-feed">
      <li class="event event-announce" data-event-type="combat">
        <time datetime="...">12:04:31</time>
        <p>Stonefang attacks Whisperwind with Righteous Cleave!</p>
      </li>
      <li class="event event-system">
        <p>-- ROUND 7 --</p>
      </li>
    </ol>
  </section>

  <section class="pane pane-console" aria-label="Your Console">
    <ol class="event-feed">
      <li class="event event-input">
        <span class="prompt-glyph">&gt;</span>
        <p>send mirebell to the ring</p>
      </li>
      <li class="event event-prompt">
        <p>What type of monster?</p>
        <ol class="choices">
          <li><button data-choice="1">[1] Basilisk</button></li>
          <li><button data-choice="2">[2] Gladiator</button></li>
        </ol>
      </li>
    </ol>
    <form class="command-input">
      <label for="cmd">&gt;</label>
      <input id="cmd" type="text" autocomplete="off" />
    </form>
  </section>
</main>
```

Class names describe **role**, not **style**: `event-announce`, `event-prompt`, `pane-ring`. Never `green-text` or `bordered-box`.

**2. CSS custom properties for everything visual.** A single `:root` block defines the theme tokens, and every selector uses them:

```css
:root {
  /* Theme tokens — overridden by alternate themes */
  --color-bg: #0a0e0a;
  --color-fg: #a8d060;
  --color-fg-bright: #d4f0a0;
  --color-fg-dim: #5a7050;
  --color-accent: #ffe28a;
  --color-system: #6a6a6a;
  --color-prompt-glyph: var(--color-accent);

  --font-family: 'JetBrains Mono', ui-monospace, monospace;
  --font-size: 14px;
  --line-height: 1.4;

  --pane-padding: 0.5rem;
  --event-spacing: 0.25rem;

  --crt-scanline-opacity: 0; /* default off */
}

[data-theme='amber'] {
  --color-fg: #ffb000;
  --color-fg-bright: #ffd060;
  --color-fg-dim: #805500;
  /* ...etc */
}

[data-theme='paper'] {
  --color-bg: #f4f1e8;
  --color-fg: #1a1a1a;
  --color-fg-bright: #000000;
  --color-fg-dim: #5a5a5a;
  --color-accent: #8b3a00;
  --crt-scanline-opacity: 0;
}

.event-announce { color: var(--color-fg); }
.event-input { color: var(--color-fg-bright); }
.event-system { color: var(--color-system); font-size: 0.85em; }
```

A theme is just an override block. New themes are pure CSS, no JS changes needed.

**3. Honor user preferences automatically.** The default theme picks up `prefers-color-scheme`, `prefers-reduced-motion` (disables blink/scanline animations), and `prefers-contrast: more` (swaps to high-contrast tokens). Users can override these via the settings page.

**4. Theme swapping at runtime.** Setting `document.documentElement.dataset.theme = 'amber'` instantly re-skins the entire app. The choice is persisted in `localStorage`. No component re-renders required — the browser handles it.

### What's Themeable vs. What's Not

| Themeable (CSS) | Fixed (HTML/JS) |
|---|---|
| Colors, fonts, sizes | The two-pane / two-tab layout structure |
| Padding, line-height, letter spacing | Which events appear in which pane |
| Cursor style, blink behavior | Input handling, command submission |
| Scanline overlay, glow effects | Choice routing back to the server |
| Choice button shape (still as terminal-feeling brackets) | The text content of game events (server-owned) |

The distinction: themes can change *how* the terminal looks, but they cannot change *what* the terminal does. This keeps the contract between the engine and the client clean.

---

## What Lives Outside the Terminal

Not everything in the app is part of the text game. Some things benefit from normal web UI and should live there:

### Room & Ring Management

Creating rooms, sharing invite links, configuring ring settings, managing who has admin, viewing room members — these are administrative tasks, not gameplay. A normal-looking settings/lobby UI is appropriate here. It doesn't need to pretend to be a terminal.

### Account Management

Profile settings, auth (login/register/OAuth), notification preferences, linked accounts (Discord, etc.) — standard web forms are fine.

### Separation

These non-terminal views should feel visually consistent with the overall dark/retro theme but don't need to rigidly follow the monospace-only rule. Think: "dark mode settings page" rather than "more terminal." The contrast between the terminal game and the settings area should be clear and intentional.

---

## Server–Client Protocol: Loose Coupling

This section is the heart of the rebuild. If we get this right, the rest of the project becomes easy — the server can grow new commands, new monster types, new card mechanics, and the web client just keeps working. If we get it wrong, every game change will require client changes too, and we'll burn out fighting tight coupling.

The principle: **the web client is a dumb terminal**. It does not know what a "monster" is. It does not know what cards exist. It does not know what commands are valid. It knows how to do four things:

1. Send text to the server and receive text back, plus a few structured fields
2. Display that text in two streams (public Ring, private Console)
3. Render clickable affordances when the server tells it to
4. Reconnect cleanly and catch up when the network blips

Everything else is the server's job. New game features should land on the server and "just work" in the client without a web release.

### The Big Picture

Here is the complete data flow, end to end:

```
┌─────────────┐                                    ┌─────────────┐
│   Browser   │                                    │   Server    │
│             │                                    │             │
│  ┌───────┐  │  1. HTTP: POST /auth/login         │  ┌───────┐  │
│  │  UI   │──┼───────────────────────────────────►│  │ Auth  │  │
│  └───┬───┘  │  ◄── JWT token                     │  └───┬───┘  │
│      │      │                                    │      │      │
│      │      │  2. WS: connect /ws?token=<JWT>    │      ▼      │
│      │      │      &lastEventId=<id?>            │  ┌───────┐  │
│      │      ├───────────────────────────────────►│  │  WS   │  │
│      │      │  ◄── handshake { protocolVersion,  │  │ hub   │  │
│      │      │       buildVersion, serverTime }   │  └───┬───┘  │
│      │      │                                    │      │      │
│      │      │  3. WS: subscribe { roomId }       │      ▼      │
│      │      ├───────────────────────────────────►│  ┌───────┐  │
│      │      │  ◄── event { id: 1042, ... }       │  │ Room  │  │
│      │      │  ◄── event { id: 1043, ... }       │  │ event │  │
│      │      │  ◄── event { id: 1044, ... }       │  │  bus  │  │
│      │      │            (continuous stream)     │  └───┬───┘  │
│      │      │                                    │      │      │
│      │      │  4. tRPC: command { roomId,        │      ▼      │
│      │      │           text: "send mire..." }   │  ┌───────┐  │
│      └──────┼───────────────────────────────────►│  │ Game  │  │
│             │  ◄── { accepted: true,             │  │engine │  │
│             │       commandId: "c-7741" }        │  └───────┘  │
│             │                                    │             │
│             │  (events 1045, 1046, 1047 arrive   │             │
│             │   on the WS as the engine runs     │             │
│             │   the command)                     │             │
└─────────────┘                                    └─────────────┘
```

The two channels — the WebSocket subscription (server → client events) and the tRPC mutation (client → server commands) — are completely decoupled. **Sending a command does not directly return an event**. The command is acknowledged ("yes, I got it"), and the consequences of running it arrive separately as one or more events on the WebSocket. This is the same pattern Slack and Discord use: you post a message, and the bot's responses arrive through the normal message stream.

### Why Decouple Like This?

A junior engineer's first instinct is usually "make `sendCommand` return the result." That's how RPC normally works. But it's the wrong fit here because:

- **Multiple consumers.** A command from the web client also needs to update everyone *else* watching the same room. If the result only came back to the caller, the public Ring would never see it.
- **Asynchronous game flow.** A single command can produce many events, sometimes spread out over time (a fight runs for many rounds). There's no single "result" to return.
- **Reconnection.** If the network drops between command and result, an RPC-style call would lose the response forever. With an event stream, the client just reconnects and replays missed events from `lastEventId`.
- **Connector parity.** This is exactly how the Slack and Discord connectors work, so the engine doesn't need a special path for the web.

### The Event Object

Every message flowing from server to client over the WebSocket is a `GameEvent`. Junior engineers should think of this as the *only* shape of data we care about — not "responses to commands," not "notifications," not "pushes" — just events.

```typescript
type GameEvent = {
  // Identity & ordering
  id: number                  // server-assigned, monotonic per room. Used for replay.
  roomId: string              // which room this event belongs to
  serverTime: string          // ISO 8601 timestamp from the server's clock
  protocolVersion: number     // version of the event protocol (see Versioning)

  // Routing
  channel: 'public' | 'private'   // public = Ring pane, private = Console pane
  targetUserId?: string           // required when channel === 'private'

  // Content
  type: GameEventType         // see below
  text?: string               // pre-formatted text from the engine — always safe to render
  payload?: Record<string, unknown>  // optional structured data for richer rendering

  // Optional context
  causedByCommandId?: string  // if this event was caused by a specific command, the
                              // commandId is echoed back so the client can correlate
}

type GameEventType =
  | 'announce'        // generic text the engine wants to say
  | 'prompt'          // the engine is asking the user for input
  | 'prompt_timeout'  // a previous prompt timed out
  | 'prompt_cancel'   // a previous prompt was cancelled
  | 'quick_actions'   // suggested commands for the current state
  | 'system'          // connection / version / replay messages from the protocol layer itself
  | 'handshake'       // first message after connect
```

**Rendering rules for the client:**

- If `type === 'announce'`, render `text` as a line in the appropriate pane. Done.
- If `type === 'prompt'`, render `text` (the question) followed by `payload.choices` as inline tappable options. The client also remembers that a prompt is open so it can route the next user response to it.
- If `type === 'quick_actions'`, render `payload.actions` as suggestion chips above the input field. These are advisory.
- If `type === 'system'`, render with system styling (dimmer, dashes, "-- reconnected --" style).
- If the client encounters an unknown `type`, it falls back to rendering `text` as a plain announce. **Unknown types must never crash the client.** This is what makes the protocol forward-compatible: the server can introduce new event types and old clients still display them as text.

### Prompts in Detail

Prompts are the only client → server interaction that has any state on the client side. Here's the lifecycle:

1. The server emits a `prompt` event with `payload.promptId`, `payload.question`, `payload.choices` (optional), `payload.flowName` (optional), and `payload.timeoutSeconds`.
2. The client renders the question inline in the Console stream and remembers `promptId` as the active prompt.
3. The user clicks a choice or types a response and presses Enter.
4. The client sends a `respondToPrompt` tRPC mutation: `{ promptId, response: '2' }` (or whatever they typed).
5. The server validates the prompt is still open and resolves the engine's pending question.
6. The engine continues the flow and emits more events (which arrive on the WebSocket as usual).

What about typing a *new command* while a prompt is open? Two options, both server-driven:

- **Strict mode** (default): the server treats any text input from a user with an open prompt as the response to that prompt. This matches Slack behavior.
- **Cancel-and-replace**: the user types `cancel` or presses Esc, the client sends `cancelPrompt({ promptId })`, the server emits a `prompt_cancel` event, and the user can then type a new command.

The client doesn't need to know which mode the engine is in — it just sends what the user typed and lets the server interpret. If the server cancels the prompt, the client receives the `prompt_cancel` event and clears its active-prompt state.

### Commands

Sending a command is a fire-and-forget tRPC mutation:

```typescript
const result = await trpc.game.command.mutate({
  roomId,
  text: 'send mirebell to the ring',
});
// result: { accepted: true, commandId: 'c-7741' }
//     or: { accepted: false, error: 'You are not in this room' }
```

`accepted: true` means *the server received your command and queued it for the engine*. It does NOT mean the command succeeded — that information will arrive later as `announce` events on the WebSocket. If the engine rejects the command (unknown command, invalid state), it does so by emitting an announce event explaining the rejection, just like the Slack bot would.

The optional `commandId` in the response is echoed back on any events the engine produces in response, via `event.causedByCommandId`. The client can use this to correlate events with the command that caused them — useful for showing a tiny "sending..." indicator next to the player's input line until the first caused event arrives, then clearing it.

### Quick-Action Metadata

The server may emit `quick_actions` events whenever the player's relevant state changes. These are short, contextual suggestions — not a menu of every possible command, just a few that make sense right now:

```typescript
{
  type: 'quick_actions',
  channel: 'private',
  targetUserId: 'user_abc',
  payload: {
    actions: [
      { label: 'Send Stonefang to the Ring', command: 'send stonefang to the ring' },
      { label: 'Look at My Monsters',        command: 'look at monsters' },
      { label: 'Visit the Shop',             command: 'shop' },
    ],
  },
}
```

The client renders these as a horizontal scroll strip above the input. Tapping one fills the input *or* immediately submits, depending on a setting. **The client does not generate quick actions itself.** This keeps the suggestions consistent across all connectors and ensures new game features get suggested without a web release.

### Versioning: Two Numbers, Two Reasons

There are two version numbers tracked by the protocol, and they exist for different reasons. Don't conflate them:

**1. `protocolVersion` (integer, server-defined)** — the shape of the event/command schema. Bumped only when we make a breaking change to the protocol (new required field, removed field, renamed type). Backwards-compatible additions (new optional fields, new event types) do not bump it.

**2. `buildVersion` (string, e.g. git SHA or `2026.04.06-1`)** — the deployed version of the server code. Bumped every deploy. Used to detect that the server has new features even when the protocol is unchanged.

On WebSocket connect, the server sends a handshake message:

```typescript
{
  type: 'handshake',
  protocolVersion: 3,
  buildVersion: '2026.04.06-1',
  serverTime: '2026-04-06T19:22:11Z',
  yourUserId: 'user_abc',
}
```

The client compares against the values it was built with:

| Comparison | Action |
|---|---|
| Server `protocolVersion` > Client `protocolVersion` | **Hard reload required.** Show an inline notice "The game has been updated. Reloading..." and reload after a short delay. The old client cannot safely talk to the new server. |
| Server `protocolVersion` < Client `protocolVersion` | Server is older than client (rare — happens during a rolling deploy). Show "Reconnecting to the latest game server..." and retry the connection after a few seconds. |
| Server `protocolVersion` == Client, server `buildVersion` differs | **Soft notice.** Show a small unobtrusive "A new version is available. [Reload]" indicator. Don't force the reload — the client still works fine. |
| All match | No action. |

The client's own `buildVersion` is set at build time (Vite injects `import.meta.env.VITE_BUILD_VERSION` from the CI environment).

### Reconnection and Replay

WebSocket disconnects happen all the time on mobile (screen off, network switch, tunnel). The client must handle this transparently.

**On disconnect:**
- The client immediately enters a "reconnecting..." state (subtle indicator, doesn't block the UI)
- Cached events stay visible — the user can still scroll back through history
- Pending command mutations are NOT retried automatically (the user can re-issue if needed)

**On reconnect:**
- The client opens a new WebSocket with `?token=<JWT>&lastEventId=<highest event ID seen>`
- The server validates the JWT and looks up missed events for the user's rooms in the **event log** (a per-room ring buffer in memory + a `room_events` table in Postgres for longer outages — see `02-backend-hosting.md`)
- The server replays missed events in order, tagging them with `payload.replayed: true` so the client can render them slightly dimmed if desired
- After all missed events are sent, the server sends a `system` event: `{ text: '-- caught up --' }`
- The client displays a single boundary marker in each pane: `-- reconnected — replayed 14 missed events --`

**Backstop:** If the disconnection was so long that the server cannot replay (events outside the log retention window), the server sends a `system` event saying so and the client offers a "Reload to resync" button. This is rare but must be handled.

### Ordering Guarantees

Events are delivered in **per-room monotonic order** per client. The `id` field is strictly increasing within a room. The client can rely on this to:

- Detect gaps (if it receives event 1042 followed by 1045, it knows it missed 1043 and 1044 — request a replay)
- De-duplicate (if a replay sends an event the client already has, it can drop it by `id`)
- Sort confidently when rendering

The server is the single source of truth for ordering. The client never reorders events based on its local clock.

### Error Handling

The protocol explicitly distinguishes three kinds of failures so the client can react appropriately:

| Failure | Surface | Client behavior |
|---|---|---|
| **Network error** (WS disconnected, mutation timed out) | Status indicator | Reconnect WS automatically; on a mutation, show "send failed — tap to retry" inline next to the user's input line |
| **Auth error** (JWT expired, invalid) | Modal / redirect | Refresh token if possible; otherwise log out and return to the login page |
| **Game error** (engine rejected the command, prompt timed out, room no longer exists) | Inline event in the Console | The server emits an `announce` event explaining what went wrong. The client treats this exactly like any other announce — no special UI |

The point: **the client doesn't need a "game error UI."** Game errors are just text the engine sends, rendered like everything else. This keeps the client tiny and the engine in control of the player's experience.

### Rate Limiting and Backpressure

The client applies a simple submission lock: after sending a command, the input is disabled until either (a) the mutation acknowledges, or (b) a short timeout elapses (~500ms). This prevents accidental double-submission from rapid Enter presses. It is not a real rate limit — that lives on the server, which can reject commands with an `announce` event explaining the cooldown.

The server applies backpressure on the WebSocket if a slow client falls behind: events are queued per-connection up to a generous limit, then the server drops the connection and lets the client reconnect with `lastEventId` to catch up. This is simpler and more robust than trying to throttle individual senders.

### Why This Will Hold Up

If we follow these rules — text-first events with optional structured payload, server-driven prompts and quick actions, versioned handshake, monotonic event IDs with replay — the client will keep working as the game engine evolves. New cards, new monsters, new commands, new event flavors all land on the server and reach the player automatically. Web releases become rare and are mostly visual or theming changes, not feature catch-ups.

That is the goal. The web client should age slowly.

---

## Views and Navigation

| View | Location | Notes |
|------|----------|-------|
| Terminal (Ring + Console) | Main gameplay screen | The entire game lives here |
| Room Lobby | Separate page | Create / join / list rooms, invite links |
| Room Settings | Modal or page | Admin-only ring configuration |
| Account / Profile | Separate page | Auth, settings, linked accounts |
| Onboarding | Inline in Console | First-time character creation flows naturally in the console stream |

Navigation between views is minimal — the terminal is the default landing page after login. A small header bar (or slide-out drawer on mobile) provides access to the non-terminal views without cluttering the gameplay area.

---

## Reconnection and Replay

On WebSocket reconnect, the client sends its `lastEventId`. The server replays missed events from the ring buffer or database event log. Both panes catch up silently — the Ring replays public events, the Console replays private events. A subtle system message marks the replay boundary:

```
-- reconnected — replaying missed events --
[replayed events...]
-- caught up --
```

---

## Future Hooks (Not in Scope for First Pass)

The following are acknowledged as future directions. Design decisions now should avoid blocking them, but we are not building them yet:

- **Graphics / sprites**: Monster sprites or icons beside names in the feed. The event protocol already supports `payload` for structured data — attach sprite identifiers there when ready. CSS classes on event rows will allow targeted styling without a full redesign.
- **Multiple saved decks / hot-swap**: Out of scope for v1. Will need additional UI in the Console stream (list/select/equip flow) and server-side deck storage.
- **Sound effects**: Optional toggleable ambient audio. CSS custom properties and a settings object in local storage provide enough hooks.
- **Achievements / history**: Scrollback buffer, session history, lifetime stats. The event log in the database already captures this — it's a display problem, not a data problem.
- **Spectator mode**: Pure Ring-only view, no Console, no auth required (for public rooms). The Ring pane already works like this; gating auth to the Console unlocks it.
- **Push notifications** (web): Already handled by the mobile roadmap pattern. Service worker + Push API when ready.

---

## Tech Stack

No changes to the core server stack — the web app is a thin client against the existing tRPC + WebSocket API.

- **Frontend**: React (or Preact for smaller bundle), with `@trpc/react-query` for typed API calls
- **Styling**: Plain CSS or CSS Modules — no component library. The terminal aesthetic is custom enough that a design system would fight us. Minimal dependencies.
- **Font**: `JetBrains Mono` or `IBM Plex Mono` loaded via `@fontsource` (no external CDN dependency)
- **State**: React state + tRPC query cache. No Redux or Zustand — keep it simple. The server is the source of truth.
- **Build**: Vite (already in use), targeting modern browsers only (no IE, no legacy polyfills)
- **Auth**: Supabase Auth (unchanged — login/register pages sit outside the terminal)

---

## Implementation Approach

The existing `apps/web` is preserved as reference. We will rebuild from a clean slate so we don't fight architectural decisions baked into the old implementation. Once the rebuild covers existing functionality and we're confident in it, the old code can be removed in a single cleanup commit.

Suggested approach:

1. Build the new app at `apps/web` after archiving the current implementation to a sibling directory like `apps/web-legacy/`. This keeps the old code reachable for reference (and `git blame`able) but unambiguous about which is shipping.
2. Borrow freely from the legacy app where it makes sense — the Supabase auth integration, the tRPC client setup, and the WebSocket subscription scaffolding are all reusable. Don't borrow component structure or styling.
3. Coordinate with the server to add any new event types or metadata needed by the protocol (`quick_actions`, `handshake`, prompt context fields). Where possible, add these to the engine in backwards-compatible ways so the legacy client doesn't break mid-rebuild.

## Tasks

### Phase 0 — Preparation

- [x] Move current `apps/web` to `apps/web-legacy` and update the workspace config to keep it building (so we can compare behaviors during the rebuild)
- [x] Audit the legacy `tRPC` client and Supabase auth setup; note what's directly reusable
- [x] Add the new `quick_actions`, `prompt.timeout`, `prompt.cancel`, `system`, `handshake` event types to the engine; add `cancelPrompt` to `RoomEventBus`; add `commandId` correlation; add `cancelPrompt` tRPC mutation
- [x] Add the `handshake` message and version negotiation on the WebSocket server (`ringFeed` subscription)
- [x] Server integration tests for `prompt.timeout`, `cancelPrompt`

### Phase 1 — Core Terminal

- [x] Scaffold new `apps/web` with clean slate (Vite + React + tRPC client + Supabase auth, Vitest, no UI library)
- [x] Establish the semantic HTML structure (`<main class="terminal-shell">`, `<section class="terminal-pane">`, `<ol class="event-feed">`, etc.)
- [x] Set up CSS custom properties and the default phosphor theme (`src/styles/theme-phosphor.css`)
- [x] Build Ring pane: WebSocket subscription → auto-scrolling monospace text stream (`RingPane.tsx`)
- [x] Build Console pane: private event stream + text input + submit + active-prompt tracking (`ConsolePane.tsx`)
- [x] Implement inline choice rendering for `prompt.request` events — tappable/clickable, keyboard-navigable (`InlineChoices.tsx`)
- [x] Implement quick-action suggestions strip above input field (populated from `quick_actions` events)
- [x] Implement responsive layout: side-by-side ≥1024px (`ResizeObserver`), tabbed below
- [x] Implement tab keyboard shortcuts (Cmd/Ctrl+1 / Cmd/Ctrl+2)
- [x] Reconnection with `lastEventId` replay and de-duplication by event id
- [x] Version handshake: hard reload on `protocolVersion` mismatch, soft notice on `buildVersion` mismatch (`useHandshake.ts`)
- [x] Onboarding: first-time character creation flows in-console (no special UI, just the natural command flow)
- [x] Draggable pane divider (desktop) — `PaneDivider.tsx`
- [x] Navigation / routing: `/login`, `/rooms`, `/room/:roomId`, `/room/:roomId/settings`, `/account` (`App.tsx`)
- [x] AppShell header with room name, account link, theme toggle, sign-out (`AppShell.tsx`)
- [x] Scroll-to-bottom jump button in both panes
- [x] Prompt timeout countdown (inline, visible in Console)
- [x] Unit tests: `useTheme`, `useHandshake`, `InlineChoices` (16 passing)

### Phase 2 — Room & Account Management

- [x] Room lobby page: create / join / list rooms (`RoomLobbyView.tsx`)
- [x] Room settings (admin-only): invite code copy, member list, delete room (`RoomSettingsView.tsx`)
- [x] Account page: profile, theme picker, sign-out (`AccountView.tsx`)
- [x] Auth pages: login + signup with Discord OAuth and email/password (`LoginView.tsx`)

### Phase 3 — Polish, Theming, and Mobile Refinement

- [x] Mobile input dock: `position: sticky; bottom: env(safe-area-inset-bottom)` in `terminal.css`
- [x] Quick-action suggestions horizontal scroll strip (mobile-friendly)
- [x] Scroll-to-bottom button when user has scrolled up in active feed
- [x] Prompt timeout countdown (inline, visible in Console)
- [x] CRT scanline CSS toggle via `--crt-scanline-opacity` custom property (`effects.css`)
- [x] Amber-on-black alternate theme (`theme-amber.css`)
- [x] Theme selection UI (radio buttons in AccountView) + `localStorage` persistence (`useTheme.ts`)
- [x] Honor `prefers-reduced-motion` and `prefers-contrast` in `base.css`
- [x] Accessibility: `role="log"`, `aria-live="polite"`, `role="listbox"` on choices, ARIA labels on all interactive elements, keyboard navigation for choice buttons and pane divider
- [ ] Performance: virtualized scroll for long-running sessions (deferred — profile first)
- [ ] Cleanup: remove `apps/web-legacy` once the rebuild is confirmed at parity in production
