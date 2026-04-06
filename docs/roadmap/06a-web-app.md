# Web App — Rebuilt from Scratch

**Category**: Feature / Connector  
**Priority**: High  
**Status**: In progress — `06-web-app.md` describes the previous implementation; this document supersedes it with a revised vision. The old implementation is preserved as reference material while the rebuild takes shape.

---

## The Vision

Deck Monsters is a text-based game. That is not a limitation — it is the game. The web app should look like it belongs to the same world as MOOs, MUDs, BBS doors, Commodore 64 BASIC prompts, glowing green terminal phosphor, and all-night telnet sessions. Not as a nostalgic costume layered over a normal web UI, but as a genuine design commitment. The charm of the original Slack game came from its unabashed simplicity: a stream of text, a few lines of input, a shared feed of battle events that everyone in the channel could follow. We want to bring that same feeling to the browser.

The fantasy lineage matters too. This is a game about monsters and magic cards, rooted in D&D, Magic: The Gathering, and a healthy dose of whimsy — think Tom Bombadil wandering into your combat encounter and narrating it in rhyme, or the chaos of a late-night session where the DM is clearly enjoying themselves a little too much. That spirit should come through in the writing, the event feed, the way the game talks to you. The aesthetic is: **dungeon master via modem**.

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

Mobile is likely the primary play surface. The two-pane layout collapses on mobile into **two tabs** — Ring and Console — with the active tab filling the screen. The ring feed is available to spectate even without interacting; the console tab is where you play.

On mobile:
- The input field is always docked at the bottom of the screen (above the keyboard)
- Inline choice buttons are full-width tappable rows, not compact inline chips
- Quick-action suggestions are a horizontal scroll strip above the input field
- Text is comfortable to read without zooming (minimum 16px effective font size)
- Auto-scroll behavior: the Ring tab auto-scrolls to the latest event; the Console tab auto-scrolls unless the player has manually scrolled up to review history

On desktop:
- Both panes are side by side and independently scrollable
- The Ring pane can be resized or optionally collapsed (for players who prefer a bigger console)
- Keyboard-first: all interactions should be completable without reaching for the mouse

---

## The Aesthetic

### Typography and Color

The game should feel like a terminal. Suggested baseline:

- **Font**: monospace throughout — `JetBrains Mono`, `IBM Plex Mono`, `Fira Code`, or system monospace fallback
- **Colors**: dark background (#0d0d0d or similar near-black), a primary text color in the green-amber spectrum (classic phosphor green `#33ff33`, or a slightly warmer/dimmer variant like `#a8d060` for less eye strain), dim gray for secondary/system text, a brighter accent for prompts and player input
- **No rounded corners, no drop shadows, no gradients** on game elements — square, flat, terminal
- **Cursor**: blinking block or underline cursor on the input field
- **Scanline effect**: optional, subtle CRT scanline CSS overlay (off by default — toggle in settings)

### Typography Hierarchy

```
[system / timestamp]    dim gray, smaller
> player input          bright white or accent
game response           primary green
  choices / options     indented, slightly dimmer, brackets around numbers
-- section dividers --  dashes, pure ASCII
ROUND 7                 ALL CAPS for structural events
```

No icons, no emoji in the core game stream unless the server sends them (node-emoji output from the game engine is fine — those are part of the game's voice, not a design system). No avatars. No reaction buttons. No thread nesting.

### Sound (Optional, Off by Default)

A setting to enable subtle retro sound effects: keyclick on input, soft chime on private event, deeper resonance for combat events. Off by default. Not in scope for the first pass but worth noting as a future toggle.

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

The goal is for the web client to behave like the Slack or Discord connector: it sends text commands and receives events. The server's game engine doesn't need to know it's talking to a browser.

### Event Protocol

The server emits `GameEvent` objects over the WebSocket subscription:

```typescript
type GameEvent = {
  id: string                  // monotonic event ID for reconnection/replay
  roomId: string
  type: GameEventType         // 'announce' | 'prompt' | 'prompt_timeout' | ...
  targetUserId?: string       // undefined = public (Ring), set = private (Console)
  text?: string               // pre-formatted announce text from the engine
  prompt?: {
    question: string
    choices?: string[]        // if present, render as clickable options
    flowName?: string         // e.g. "Spawning a monster" — for context label
    stepHint?: string         // e.g. "Step 2 of 4" — for progress context
    timeoutSeconds?: number
  }
  version: number             // server protocol version — see Versioning below
}
```

The client should be able to render any event it receives using `text` alone (graceful fallback), with richer rendering when `prompt` or structured payload is present.

### Command Protocol

The client sends commands as text strings:

```typescript
// tRPC mutation
sendCommand({ roomId, command: 'send stonefang to the ring' })
```

This mirrors the chat connector model exactly. The server calls `game.handleCommand({ command })` and the result flows back through the event bus. The web client doesn't need to know what commands are valid — it passes them to the engine and the engine responds.

### Quick-Action Metadata

To support suggested quick actions without hard-coding them in the client, the server can optionally emit a `GameEvent` of type `'quick_actions'` after relevant state changes:

```typescript
type QuickActionsEvent = {
  type: 'quick_actions'
  targetUserId: string
  actions: Array<{ label: string; command: string }>
}
```

The client renders these as suggestions; they're advisory and the client can ignore them if the server doesn't send them. This keeps the feature optional and server-driven.

### Versioning and Client Sync

Every event includes a `version` field — the server's protocol version number. The client stores the version it was built against. On connection, the server sends a handshake event with the current version. If the client detects a version mismatch (server is newer than client), it:

1. Displays an inline system notice in the Console: `"A new version of the game is available. Reloading..."`
2. Forces a hard reload after a short delay (or immediately on next command)

This prevents stale clients from silently misbehaving when the protocol changes.

The client itself is versioned via a `BUILD_VERSION` env var (set at deploy time from the git commit SHA or release tag). The server exposes this version in the handshake, and the client can compare to know if a reload is available even without a protocol-level change.

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

## Tasks

### Phase 1 — Core Terminal

- [ ] Scaffold new `apps/web` (or replace in place) with clean slate
- [ ] Build Ring pane: WebSocket subscription → auto-scrolling monospace text stream
- [ ] Build Console pane: private event stream + text input + submit
- [ ] Implement inline choice rendering for `prompt.choices` events (tappable/clickable)
- [ ] Implement quick-action suggestions strip above input field (populated from `quick_actions` events)
- [ ] Implement two-tab layout for mobile (Ring / Console tabs)
- [ ] Implement two-pane layout for desktop (side-by-side, resizable)
- [ ] Style terminal aesthetic: dark background, monospace, phosphor-ish color palette
- [ ] Reconnection with event replay and "caught up" indicator
- [ ] Version handshake: detect mismatch → inline notice → hard reload
- [ ] Onboarding: first-time character creation flows in-console (no special UI, just the natural command flow)

### Phase 2 — Room & Account Management

- [ ] Room lobby page: create / join / list rooms, invite link generation
- [ ] Room settings (admin-only): ring configuration
- [ ] Account page: profile, settings, linked accounts
- [ ] Auth pages: login, register, OAuth (Supabase — largely reuse from previous implementation)

### Phase 3 — Polish and Mobile Refinement

- [ ] Tune mobile input dock behavior (keyboard avoidance, safe areas)
- [ ] Quick-action suggestions horizontal scroll strip on mobile
- [ ] Scroll-to-bottom button when user has scrolled up in active feed
- [ ] Prompt timeout countdown (inline, visible in Console)
- [ ] Optional CRT scanline CSS toggle in settings
- [ ] Accessibility: keyboard navigation, focus management, ARIA labels on interactive elements
- [ ] Performance: virtualized scroll for long-running sessions (if needed)
