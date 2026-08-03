import { FIGHT_DELAY_SECONDS, MAX_MONSTERS, MIN_MONSTERS } from './player-handbook-content.js';

/** Section titles present in root DMG.md but never in CARDS.md. */
export const DM_ONLY_MARKERS = [
	'How to Run a Session',
	'Operator Concurrency Notes',
	'── Admin Commands',
	'Per-monster-type modifiers',
	'Card-to-card pacing',
] as const;

/** Internal operator markers that must not appear in the in-game `look at dm guide` output. */
export const FILE_ONLY_OPERATOR_MARKERS = [
	'How to Run a Session',
	'Operator Concurrency Notes',
	'DECK_MONSTERS_SKIP_DELAYS',
	'DECK_MONSTERS_',
	'activeFlows',
	'roomId:userId',
	'Ensure the server process is running',
] as const;

export const HOW_TO_RUN_SESSION = `
── How to Run a Session ──────────────

Deck Monsters runs as a room-scoped game engine behind connector adapters.
Each room has its own persisted game state, shop inventory, and event stream.

Web (deck-monsters.com):
  • Players sign in, join or create a room from the lobby, then use the
    Console pane for text commands and the Ring pane for the live fight feed.
  • The Workshop page supports drag-and-drop deck management; console commands
    remain available for the same operations.
  • Room Settings (gear icon) lets room owners reset game state or manage members.

Discord:
  • Each guild maps to one or more rooms. Slash commands (/spawn, /ring, /equip,
    /shop, /status, /create-room, /join-room, …) and free-text DMs both dispatch
    into the same engine command parser.
  • Interactive prompts arrive as DM button menus or free-text collectors; players
    must be able to receive DMs from the bot for multi-step flows.
  • /create-room and /join-room set the caller's active room for subsequent commands.

Starting a session:
  1) Ensure the server process is running with database connectivity configured.
  2) Load or create the target room (web navigation or Discord guild default).
  3) Players spawn monsters, equip decks, and send fighters to the ring.
  4) Once ${MIN_MONSTERS}+ monsters are in the ring, the fight timer arms automatically.

State saves debounce (~30 s) on engine mutations; fights and prompts do not block saves.
`.trim();

export const FIGHT_PACING_OPERATOR = `
── Fight Pacing ──────────────────────

Ring quorum: fights require at least ${MIN_MONSTERS} monsters in the ring (up to
${MAX_MONSTERS}). When quorum is met, a ${FIGHT_DELAY_SECONDS}-second countdown
re-arms after each encounter.

During a fight:
  • Each contestant plays the next card in its deck (wraps when exhausted).
  • Card-to-card pacing uses veryShortDelay (~2–4 s between plays in production).
  • Round transitions use shortDelay (~3–6 s).
  • Sub-event pacing within a single card play (~1 s between roll/hit/damage) is
    separate and much shorter — do not confuse the two layers.

Tests and harness runs set DECK_MONSTERS_SKIP_DELAYS=1 to zero all timers.
Operators may tune midpoints via DECK_MONSTERS_*_DELAY_MIDPOINT_MS env vars
(see packages/engine/src/helpers/delay-times.ts); no secrets are required.

Ring fights run on an internal timer chain outside server command lanes — they
interleave with player commands by design.
`.trim();

export const FIGHT_PACING_PUBLIC = `
── Fight Pacing ──────────────────────

Ring quorum: fights require at least ${MIN_MONSTERS} monsters in the ring (up to
${MAX_MONSTERS}). When quorum is met, a ${FIGHT_DELAY_SECONDS}-second countdown
re-arms after each encounter.

During a fight each contestant plays the next card in its deck (wraps when
exhausted). Card-to-card transitions are paced for readability in live feeds;
sub-event pacing within a single card play is much shorter.
`.trim();

export const OPERATOR_CONCURRENCY = `
── Operator Concurrency Notes ────────

These rules prevent "commands ignored" and workshop/console interleaving bugs.
Full detail: docs/engine-concurrency-and-timing.md

  • Interactive console commands serialize per roomId:userId — never room-wide.
    A user's multi-prompt flow must not starve other members.
  • Workshop mutations (equip, presets, …) use a room-wide lane plus a same-user
    guard so they cannot interleave with that user's active console flow.
  • activeFlows: at most one interactive console flow per user per room.
  • Ring fights are not awaited by the server and are not inside any lane.
  • Cross-user console commands may run concurrently on the shared Game — intentional.
    Shared mutations (shop, ring roster) stay on the room lane.
  • Never put a user-input wait inside a room-wide serialized lane.

Discord mirrors web lane keys via connector-local flow locks; prompt collectors
resolve outside the lane so answers can release waiting actions.
`.trim();
