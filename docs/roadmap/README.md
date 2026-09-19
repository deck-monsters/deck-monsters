# Deck Monsters — Roadmap

**Last updated**: September 2026

This directory tracks all planned, active, and completed work on the Deck Monsters revival.
Each document covers one area; this README is the authoritative index of status and priority.

---

## Status at a Glance

| Doc | Area | Status |
|-----|------|--------|
| [01 — Modernize Stack](01-modernize-stack.md) | TypeScript, Mocha, pnpm/Turborepo, CI | ✅ Done |
| [02 — Backend Hosting](02-backend-hosting.md) | Supabase, Railway, Drizzle ORM, tRPC | ✅ Done — live in production |
| [03 — Auth & Identity](03-auth-and-identity.md) | JWT, Supabase Auth, Discord + Google OAuth | ✅ Phase 1 + 2 done; Apple deferred |
| [04 — Multi-Room/Groups](04-multi-room-groups.md) | RoomManager, invite codes, web UI, Discord | ✅ Done |
| [15 — Ring Feed Timestamps](15-ring-feed-timestamps.md) | `timeago.js`, hover tooltips | ✅ Done |
| [18 — Live Ring Roster](18-live-ring-roster.md) | Live HP/AC scoreboard during fights | ✅ Done |
| [06a — Web App](06a-web-app.md) | Terminal UI, ring feed, lobby, rooms | ✅ Done — live at deck-monsters.com |
| [13 — Leaderboard](13-leaderboard.md) | Player/monster stats, web UI | ✅ Done |
| [16 — Card Management](16-card-management.md) | Inventory, presets, web workshop | ✅ Done — card workshop shipped |
| [Boss Encounters](../boss-encounters.md) | Boss summoning, ring events, teams/targeting | ✅ Done — architecture doc, not a roadmap item |
| [10 — Bug Fixes](10-bug-fixes.md) | Open bugs, UX polish, cleanup | 🚨 Active — **item J: fight rewards (coins/xp) may never be credited** (supersedes #145), plus 2 non-blocking pacing items |
| [10b — Bugs Fixed (Archive)](10b-bugs-fixed.md) | Resolved bugs, historical record | ✅ Archive — nothing to action |
| [05 — Discord Connector](05-discord-connector.md) | Slash commands, event bus, embeds | ✅ Done — full command surface, admin roles, tests; needs production use |
| [14 — Fight Stats](14-fight-stats.md) | Fight summaries, catch-up feed | ✅ Done — core shipped; optional enhancements remain |
| [20 — Workspace Layout](20-workspace-layout.md) | Surfaces in two switchable pane slots | 🔧 Active — phases 1–5 code-complete; device/browser visual sign-off remains |
| [19 — Player Agency & Items](19-player-agency-and-items.md) | Items as the live lever, targeting scrolls, competence/attachment surfacing | 🔧 Active — first-class item docs, Workshop/Ring use and room shop browse/buy (items, cards and back room, at parity with the console) shipped, and the shop's card stock (previously always empty, #147) now actually draws real cards; feedback, prompt-driven web use and web selling remain |
| [11 — Balance & Mechanics](11-balance-and-mechanics.md) | Stat reform, initiative, saving throws | 🔧 Active — coin economy audit and early-progression front-loading (Sept 18 2026) shipped; stat reform/initiative/crit fail still 📋 backlog (needs battle sim harness) |
| [12 — New Content](12-new-content-backlog.md) | Cards, monsters, items, adventures | 📋 Post-launch backlog |
| [09 — Graphics](09-graphics.md) | Sprites, icons, optional visual polish | 📋 Post-launch, low priority |
| [17 — Pixel Art Fight Animations](17-pixel-art-fight-animations.md) | SNES theme only, progressive enhancement | 📋 Post-launch, fun |
| [07 — Mobile App](07-mobile-app.md) | React Native + Expo | ⏸️ Deferred indefinitely |
| [08 — Slack Connector](08-modernize-slack-connector.md) | Bolt SDK, replace Jane/Hubot | ⏸️ Deferred indefinitely |

---

## What's Done

Everything below shipped and is not expected to need revisiting:

- **TypeScript migration** — all JS converted (303 `.ts` files), strict mode, ESM
- **Monorepo** — pnpm workspaces + Turborepo; packages: `engine`, `server`, `connector-discord`, `harness`, `shared-ui`; apps: `web`
- **CI** — GitHub Actions: typecheck + lint + tests on every push and PR
- **Production infrastructure** — Supabase project provisioned (Postgres + Auth + Realtime), Railway deployment configured, deck-monsters.com live
- **Hosting architecture** — Drizzle ORM + tRPC API + Fastify server + Docker multi-stage build; deployment docs complete
- **Auth** — Supabase Auth + JWT validation; `user_connectors` table; Discord auto-creation; web email/password; Google OAuth; Discord OAuth — all live
- **RoomManager** — lazy load/unload, invite codes, idle room sweeps, room-scoped character data
- **Discord connector** — slash commands (`/spawn`, `/ring`, `/equip`, `/preset`, `/shop`, `/buy`, `/sell`, `/use`, `/status`, `/monsters`, `/dismiss`, `/revive`, `/ring-status`, `/summon-boss`, `/create-room`, `/join-room`, `/set-announcement-channel`, `/help`), event bus bridging, button/select-menu prompts, guild-room mapping, embed rendering, admin role detection (guild room owner → `isAdmin`), slash command test coverage
- **Web app** — all three phases complete and live at deck-monsters.com: terminal aesthetic, ring pane, console pane, inline choices, quick-action suggestions, responsive layout, tab shortcuts, room lobby, room settings, account page, theme picker (phosphor + amber + CRT toggle), mobile input dock, accessibility pass, reduced-motion/contrast support; `apps/web-legacy` removed
- **Themes** — four terminal palettes: phosphor (green), amber, **ember (red)**, and street-fighter (SNES). Each defines a dedicated health-bar ramp; `theme-palettes.test.ts` enforces token completeness, WCAG AA body-text contrast, and a luminance-ordered HP ramp for every theme
- **Live ring roster** — a persistent scoreboard above the ring feed showing every contestant's live HP (bar + numbers), AC, level, team/boss tag and owner, pushed on the existing `ring.state` broadcast after each resolved card. Collapsible, per-viewer preference remembered
- **Ring feed timestamps** — `timeago.js` integration, absolute-time hover tooltips, key-event markers, opt-in toggle in Account settings
- **Leaderboard** — `room_player_stats` / `room_monster_stats` tables, `FightStatsSubscriber`, tRPC procedures, win-streak tracking, web leaderboard page
- **Fight stats** — `fight_summaries` table, `FightSummaryWriter`, catch-up text command, web fight log page with expandable detail, last-fight ticker in ring pane
- **Card workshop** — full card management shipped: unequip/move commands, preset save/load/delete, drag-and-drop web workshop at `/workshop`
- **Battle history persistence** — stored in `options.battles`, capped at 20, survives restarts
- **Boss encounters** — player boss summoning (3 per rolling 24h, per room) and Ring Events: random encounter modifiers that trigger multi-boss gauntlets, free-for-alls, player alliances, and team battles by surfacing the engine's existing team/targeting machinery. `victoryMode: 'last-team'` for Common Cause and House War: combat ends when one faction survives and all survivors win. Centralized activation (`Ring.activateRingEvent`), quorum-drop event clearing, free-for-all centralized in `getTarget`, contestant-level XP team overrides, and restart-gap fix for the boss summon quota (`bossSummonsPending`). Documented in [`docs/boss-encounters.md`](../boss-encounters.md)
- **Bug fixes** — all tracked audit items resolved; see `10b-bugs-fixed.md` for the archive, including DMG/CARDS content differentiation (#3), batch-equip UX (#19), per-room card shop scoping (#26), boss-sentinel leaderboard fixes (#27–#33), combat/event findings (#34–#50), the 2026-08-03 audit fixes (#51–#58, #59–#63, #64, #65–#69, #70–#73, #74–#85), Fastify tRPC batch `maxParamLength` 404s (#86), the preset casing / parsing fixes (#87–#88), nested card-play pacing (#89), the missing fight-winner banner (#90), the equip deck-accounting / starting-deck refill bugs (#91–#92), the jump-button / command-echo / email-display / beginner-level fixes (#93–#96), the turn-banner collapse (#97), the shop's always-empty card stock (#147), passive healing surviving room downtime (#151), the ring roster falling back to a stale polled snapshot right when a fight concluded (#152), a Console prompt banner re-opening itself right after the player answered it (#153), every fight's `clearRing()` disposing player monsters' healing and revival timers so a revived monster sat at 1 hp until the room was restored (#154), a Delayed Hit answering a turn-old blow after an unrelated Heal (#155), the waiting banner covering the prompt choices it explained (#156), and the September 16 2026 mobile UI pass (#98–#110), which also produced the ring's current voice — players call their monsters in, the house (`👑 The Editor`) commands bosses.

---

## Active Work — In Order of Priority

Real-time sync bugs, quick actions, batch-equip UX, card shop room-scoping, DMG/CARDS content differentiation (#3), the 2026-08-03 audit fixes (#51–#85), and Fastify tRPC batch `maxParamLength` 404s (#86) are all archived in `10b-bugs-fixed.md`. The preset casing and parsing fixes (#87–#88) are archived there too, along with the September 2026 live-play fixes (#89–#97). `10-bug-fixes.md` now carries two open non-blocking pacing items from that pass: cards that emit two roll blocks in the same tick, and the burst of messages at the very start of a fight. The email-defaulted profile migration shipped as #135. The **September 16 2026 mobile UI pass** (#98–#110) is fully archived in `10b-bugs-fixed.md`. Layout and rendering: feed text clipped off the right edge of both panes because `.event-feed`'s padding sat on the Virtuoso scroller, whose absolutely-positioned viewport resolves `width:100%` against the padding box (#98); engine `*bold*` / `_italic_` markup printed literally everywhere, not just in the fight log (#99); `in 1 rounds` (#100); the turn banner's 21 unrenderable dice glyphs (#101). Voice: every boss arrival **and departure** credited a randomly generated beastmaster who does not exist, now the house — `👑 The Editor` (#102); a player-summoned boss announced twice, out of order, under two names (#103); the ring-exit line said the opposite of what happened, resolved as part of a wider reframe where a player's monster *answers a call* and a boss is *commanded* (#104); a missing full stop (#105); a three-monster fight's summary dropping a contestant its own title named (#106). Feed and connection: dividers marking where the reader joined and lost connection (#107) and a heartbeat watchdog so a silently dead connection is noticed (#108). Found along the way: the fight log returned **other players' private events**, because a fight's events are resolved by time window and the query filtered on room and time but not on viewer (#109); and console fight highlights, which required `announceHit` to stop publishing an empty payload (#110). Screenshots are in `assets/ui-bugs-2026-09/`.

### 1. Balance & mechanics (11-balance-and-mechanics.md)

Design doc is ready. Blocked on a battle simulation harness for safe regression testing. Key items: crit fail for all cards, stat variance reform, initiative rolls, saving throws. Start by building the sim harness, then iterate.

### 2. Player agency and items (19-player-agency-and-items.md)

Written after a research pass on what makes RPGs enjoyable. States the design frame — the
fight is hands-off on purpose, and the pleasure is commitment then surrender — and audits
the one real-time lever the game already has. Key finding: **items are usable mid-fight by
design, but only the ones the monster is already carrying** — `use.ts` narrows the pool to
`monster.items` while `inEncounter`, so the real lever is what you equipped before the bell.
The web client lists and uses items from the Workshop, while the Ring exposes a one-tap
affordance for the fighting monster's carried items. What remains is the broader feedback
loop, web selling and the one item whose own action still requires an interactive prompt.
Targeting scrolls already let players set `targetingStrategy`; teaching that strategy is a
separate design opportunity. Anything that changes item *power* wants the sim harness first.

### 3. Workspace layout (20-workspace-layout.md)

The workshop began as a separate route, so changing a deck meant leaving the ring feed —
worst right after watching a monster lose, which is when you most want to. Phase 1 (behaviour-
neutral extraction of `WorkshopPanel`) and phase 2 (surfaces-in-slots — see §3.2, generalised
beyond just "console ↔ workshop" to a `SurfaceId` registry so a future fight log or
leaderboard costs one entry, not a rewrite) are done. The two pane slots, the per-slot
`PaneSelector`, `Cmd/Ctrl+1–5`, and `dm:paneSlots` persistence live in `Terminal.tsx`.
All five implementation phases are code-complete: responsive pane chrome, the
monster-management hub, Fight Log and Leaderboard surfaces all ship. The final navigation
rule is explicit: normal in-app navigation reveals a surface in the workspace; only the
labelled expand action opens its full-page route. Cross-browser/device visual evidence at
the documented widths and 200% zoom is the remaining sign-off, not an implementation gap.

### 4. New content backlog (12-new-content-backlog.md)

New cards (10+ designs documented), two new monster types (Time Lord / Wizard, Bureaucrat / Cleric), equipment slots, adventures/job board, tournaments. Post-launch, driven by player demand.

### 5. Pixel art fight animations — SNES theme (17-pixel-art-fight-animations.md)

A fun post-launch enhancement: a retro SNES theme that layers pixel art fight animations on top of the text ring feed. All other themes stay clean and text-only — this is pure progressive enhancement. The animation module only loads when the SNES theme is active, so there's no cost for everyone else. Monster sprites (one idle + attack + hit + faint per monster type) can be generated with PixelLab and refined in Aseprite. See `docs/pixel-art-animations-in-js.md` for the full technical reference.

---

## Architecture Rule: Room-Level Scoping

**All game state, events, database queries, and API calls must be scoped to a room.**

Violations have caused bugs in the past — global state leaking across rooms, queries missing a `room_id` filter, events broadcasting to the wrong audience. See [`docs/room-scoping.md`](../room-scoping.md) for the full rule and checklist.

When touching anything that touches game data, always ask: _does this include the room?_

---

## Deferred Indefinitely

These are not on the active roadmap. They can be revisited if there is demand or a clear opportunity, but no work should be started or planned against them.

### Mobile App (07-mobile-app.md)

React Native + Expo for iOS and Android. The tRPC API is already mobile-compatible, so the technical path is clear when the time comes. Deferred until the game has a stable web presence and an active player base that wants a native app.

### Slack Connector (08-modernize-slack-connector.md)

Modernizing Jane (the original Hubot/Slack bot) with the Bolt SDK and the new event bus. Slack is not the focus of the revival. Deferred indefinitely; can be revisited if there is a specific workspace that wants to run the game.
