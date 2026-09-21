# Deck Monsters — Roadmap

**Last updated**: September 2026

This directory tracks remaining work for the Deck Monsters revival. Shipped plans live in
[`docs/archive/roadmap/`](../archive/roadmap/); [`10b-bugs-fixed.md`](10b-bugs-fixed.md)
remains here as the stable fixed-bug ledger.

## Now

| Doc | Remaining work | Status |
|---|---|---|
| [10 — Bug Fixes](10-bug-fixes.md) | Resolve item J (fight rewards) and two pacing items. | Active |
| [19 — Player Agency & Items](19-player-agency-and-items.md) | Item-driven web prompts, web selling, and the feedback loop. | Active |
| [20 — Workspace Layout](20-workspace-layout.md) | Real WebKit/iPhone and cross-browser visual sign-off. | Active |
| [22 — Small Leftovers](22-small-leftovers.md) | Decisions carried from shipped plans. | Backlog |
| [23 — Pixel Fight Animations](23-pixel-fight-stage.md) | Sprites moved into the roster rows; opt-in and off by default. Open: sprite density, per-room setting. | Shipped / follow-ups |

## Next

| Doc | Next work | Status |
|---|---|---|
| [11 — Balance & Mechanics](11-balance-and-mechanics.md) | Build the battle-simulation harness, then address stat reform, initiative, and crit fail. | Active / backlog |
| [12 — New Content](12-new-content-backlog.md) | Curated cards, monsters, items, adventures, and tournaments. | Backlog |
| [09 — Graphics](09-graphics.md) | Text-first visual polish, sprites, and icons. | Backlog |

## Deferred indefinitely

| Doc | Reason |
|---|---|
| [07 — Mobile App](07-mobile-app.md) | Wait for a stable web presence and player demand for native apps. |
| [08 — Slack Connector](08-modernize-slack-connector.md) | Slack is not the focus of the revival. |

## Shipped

| Plan | What shipped |
|---|---|
| [01 — Modernize Stack](../archive/roadmap/01-modernize-stack.md) | TypeScript migration, pnpm/Turborepo, CI, and dependency cleanup. |
| [02 — Backend Hosting](../archive/roadmap/02-backend-hosting.md) | Supabase/Railway infrastructure, Drizzle, Fastify, and tRPC. |
| [03 — Auth & Identity](../archive/roadmap/03-auth-and-identity.md) | Supabase Auth, account identity mapping, and live OAuth providers. |
| [04 — Multi-Room/Groups](../archive/roadmap/04-multi-room-groups.md) | Room lifecycle, invitations, and web/Discord room support. |
| [05 — Discord Connector](../archive/roadmap/05-discord-connector.md) | Discord commands, prompts, event delivery, and admin support. |
| [06 — Web App](../archive/roadmap/06-web-app.md) | Superseded first web-app plan. |
| [06a — Web App](../archive/roadmap/06a-web-app.md) | Live terminal-style web experience. |
| [13 — Leaderboard](../archive/roadmap/13-leaderboard.md) | Player and monster rankings. |
| [14 — Fight Stats](../archive/roadmap/14-fight-stats.md) | Fight summaries, catch-up feed, and history UI. |
| [15 — Ring Feed Timestamps](../archive/roadmap/15-ring-feed-timestamps.md) | Relative event times and feed markers. |
| [16 — Card Management](../archive/roadmap/16-card-management.md) | Card workshop, deck editing, and presets. |
| [17 — Pixel Art Fight Animations](../archive/roadmap/17-pixel-art-fight-animations.md) | Theme-gated pixel-art fight animations. |
| [18 — Live Ring Roster](../archive/roadmap/18-live-ring-roster.md) | Live contestant HP/AC roster. |
| [21 — September Follow-ups](../archive/roadmap/21-september-followups.md) | One vocabulary, workshop HP header and first-run training, global display name, 10 monster slots, pixel-fight animations, roadmap reorganisation (#160–#163). |
| [10b — Bugs Fixed](10b-bugs-fixed.md) | Fixed-bug ledger, kept here because code cites this stable path. |

### Bug ledger highlights

- **Bug fixes** — all tracked audit items resolved; see `10b-bugs-fixed.md` for the archive, including DMG/CARDS content differentiation (#3), batch-equip UX (#19), per-room card shop scoping (#26), boss-sentinel leaderboard fixes (#27–#33), combat/event findings (#34–#50), the 2026-08-03 audit fixes (#51–#58, #59–#63, #64, #65–#69, #70–#73, #74–#85), Fastify tRPC batch `maxParamLength` 404s (#86), the preset casing / parsing fixes (#87–#88), nested card-play pacing (#89), the missing fight-winner banner (#90), the equip deck-accounting / starting-deck refill bugs (#91–#92), the jump-button / command-echo / email-display / beginner-level fixes (#93–#96), the turn-banner collapse (#97), the shop's always-empty card stock (#147), passive healing surviving room downtime (#151), the ring roster falling back to a stale polled snapshot right when a fight concluded (#152), a Console prompt banner re-opening itself right after the player answered it (#153), unattended Cloud Agent builds failing at a `fuse.conf` prompt (#154), Railway CLI installation targeting an unwritable system prefix in Cloud Agents (#155), every fight's `clearRing()` disposing player monsters' healing and revival timers so a revived monster sat at 1 hp until the room was restored (#156), a Delayed Hit answering a turn-old blow after an unrelated Heal (#157), the waiting banner covering the prompt choices it explained (#158), the Ring and Console feeds silently lagging the newest narration after #148's 72px at-bottom tolerance disabled Virtuoso's snap-back (#159), the Deck Workshop's Train monster dead-ending for a player with no character while character creation opened on a choice of one class (#160), the Deck Workshop's monster header leading with a nearly-always-full deck-slot bar while hiding current HP, the number that actually drives revive/send-to-ring/wait decisions (#161), the pixel-fight band lingering ~90 s after a fight because its settle timer could wake a fraction of a millisecond early and never re-arm (#162), vocabulary drift between training, companion, ring-exit, and pronoun language across player surfaces — including the never-working Discord `/spawn [type] [name]`, repaired through `/train` and its `/spawn` alias (#163), the pixel-fight sprites shipping as six near-identical 16×16 blobs whose poses were whole-sprite translations (#164), the same animations being unreachable in normal play — activated only by a one-shot live event, overlaying the narration, and hidden at both mobile breakpoints (#165), those animations then arriving on by default for every themed player when they cost too much of a phone viewport to be unasked-for (#166), the animations duplicating the Ring roster from a canvas band until the sprites moved into the roster rows themselves (#167), and those sprites then squeezing monster names to one or two characters in the roster's two-up layout (#168), and the September 16 2026 mobile UI pass (#98–#110), which also produced the ring's current voice — players call their monsters in, the house (`👑 The Editor`) commands bosses.

## How to use this index

- Update a plan's status line and this index in the same PR.
- Move a plan to the archive only after it ships and its leftovers are carried into 22.
- Move fixed bugs from 10 to 10b with their root causes.
- Give a new roadmap area the next available number.
- Link new architecture docs from `AGENTS.md`.
