# Fight Stats and Catch-Up Feed

**Category**: Feature  
**Priority**: Medium (post-launch)  
**Status**: In progress (core implementation landed)

## Background

The ring runs continuously, fighting every 60 seconds. Players join rooms, get invested in their monsters, and then go to sleep, go to work, or simply close the tab. When they come back, they have no idea what happened. Did Stonefang win? Did my monster die? How many fights happened?

The engine's `ring.battles = []` array was intentionally never persisted (noted in `CLAUDE.md` as known debt). The `room_events` table now provides the raw event log, but there's no higher-level view over it — no "these 17 events constitute Fight #42" abstraction, and no dedicated UI to browse recent fights.

The web app already streams live events via the `ringFeed` WebSocket. The catch-up problem (reconnecting mid-session, last-seen event ID) is partially solved. But this feature is about a different kind of catch-up: arriving *hours later* and getting a readable summary of what you missed, not just a raw event replay.

There's also an analytics angle: players want to know if their deck is working. "My monster fought 10 times and lost 8 — maybe I should equip different cards."

## Design Goals

- **Catch-up summary**: a concise human-readable account of what happened in a room since a given time, suitable for reading in 30 seconds.
- **Per-fight breakdown**: detailed view of a specific fight — participants, rounds, card plays, outcome, XP changes.
- **Text command access**: "what happened" or "show recent fights" as a text command in the console, because Discord users need it too.
- **Web UI surface**: a "Recent Fights" section in the ring pane and/or a dedicated fight log page.
- **Low overhead**: build on the existing `room_events` data; no new real-time infrastructure.

## Architecture

### Fight Summaries Table

Raw `room_events` are granular — many events per fight. A fight summary is a derived, human-queryable record:

```typescript
// fight_summaries — one row per completed ring fight
fight_summaries: {
  id: bigserial primary key,
  roomId: uuid references rooms(id) on delete cascade,
  fightNumber: integer not null,         // sequential per room (1, 2, 3, ...)
  startedAt: timestamp not null,
  endedAt: timestamp not null,
  outcome: text not null,                // 'win' | 'draw' | 'fled' | 'permaDeath'
  winnerMonsterId: text,                 // null on draw
  winnerMonsterName: text,
  winnerOwnerUserId: uuid,
  loserMonsterId: text,
  loserMonsterName: text,
  loserOwnerUserId: uuid,
  roundCount: integer not null,
  winnerXpGained: integer not null default 0,
  loserXpGained: integer not null default 0,
  cardDropName: text,                    // null if no card dropped
  notableCards: text[],                  // card types played that caused significant effects
  startEventId: bigint references room_events(id),
  endEventId: bigint references room_events(id),
}
// index on (roomId, endedAt) — for "recent fights in room X" queries
// index on (roomId, winnerMonsterId) — for per-monster history queries
// index on (roomId, loserMonsterId)
```

`fightNumber` is a monotonically increasing counter per room, stored on the `rooms` table or derived from a `room_fight_counter` sequence. It gives fights a stable human-readable identity ("Fight #42").

### Population: FightSummaryWriter

A server-side event subscriber (`packages/server/src/fight-summary-writer.ts`) watches the event stream and assembles fight summaries:

1. On `ring.fight` event: record fight start (timestamp, participants from payload).
2. On each `card.played` event: accumulate notable cards (e.g., cards dealing ≥ 50% of a creature's HP in one hit).
3. On `ring.win`, `ring.draw`, `ring.fled`, or `ring.permaDeath` event: write the completed `fight_summary` row.

The subscriber is stateful per room — it holds an in-memory pending fight record while the fight is in progress. This state is reconstructed on server restart from recent `room_events` (any `ring.fight` event without a subsequent outcome event means a fight was interrupted; mark it as abandoned or simply skip it).

**Why not derive summaries from `room_events` at query time?** For ad-hoc queries with low volume it would work, but it requires joining and scanning potentially many event rows per fight. Pre-computing summaries is cheaper at read time and allows indexes on fight attributes (outcome, winner, loser) without scanning the raw event log.

### API: tRPC Procedures

Add `fightStats` procedures to the `game` router:

```typescript
game.recentFights({ roomId, limit?, before? })
// → FightSummary[]
// limit: 10 default, max 50
// before: timestamp — return fights that ended before this time (pagination cursor)
// Accessible to any room member.
// Sorted by endedAt DESC.

game.fight({ roomId, fightNumber })
// → FightSummary & { events: GameEvent[] }
// Returns the summary plus the raw events for that fight,
// so the client can replay/render a detailed breakdown.

game.monsterFightHistory({ roomId, monsterId, limit? })
// → FightSummary[]
// All fights in this room involving a specific monster.

game.catchUp({ roomId, since })
// → { fightCount: number, summaries: FightSummary[], textSummary: string }
// since: ISO timestamp (e.g., "2026-04-09T22:00:00Z")
// textSummary is a pre-rendered multi-line string the text command can emit directly.
```

### Text Command: "What Happened"

New command aliases wired in `commands/look-at.ts` (or a new `commands/history.ts` handler):

```
what happened
catch me up
show recent fights
show fight history
look at fight log
```

These call `game.catchUp({ roomId, since: lastSeenAt })` and emit the `textSummary` field as an announcement. If the player's `lastSeenAt` isn't tracked, default to the last hour.

Example output:

```
Since you were last here (3 hours ago):

Fight #38 — Stonefang defeated Whisperwind in 4 rounds
Fight #39 — Mirebell fled from The Horned Terror
Fight #40 — Draw between Copperclaw and The Horned Terror
Fight #41 — Stonefang defeated Mirebell in 6 rounds  ☠ Mirebell perished
Fight #42 — Stonefang defeated Copperclaw in 3 rounds (card drop: Brain Drain)

Stonefang is on a 3-fight winning streak.
```

The summary highlights win streaks, perma-deaths, and card drops because those are the things players actually care about after a long absence.

If nothing happened: "No fights since you were last here."

### "Last Seen" Tracking

To make "what happened since you were away" automatic, track each user's last active timestamp per room:

```typescript
// Add to room_members:
lastSeenAt: timestamp  // updated on every command or ringFeed subscription
```

When the player issues the catch-up command, `lastSeenAt` is the implicit `since` parameter. After the summary is delivered, `lastSeenAt` is updated.

Alternatively, the web client can pass an explicit `since` parameter (its local last-active timestamp), avoiding server-side state entirely. Both approaches work; the server-side tracking is more robust for cross-device scenarios.

### Web UI: Two Surfaces

**Surface 1: Live fight ticker in the Ring pane** (always visible)

After the ring event feed, show the last completed fight as a brief one-liner below the scrolling text:

```
Last fight: Stonefang defeated Whisperwind (#38) — 2 min ago
```

Clicking it expands to the full fight breakdown.

**Surface 2: Fight Log page/tab**

A dedicated page (normal web UI, not terminal aesthetic) showing a paginated list of fight summaries:

```
┌───────────────────────────────────────────────────────┐
│  DECK MONSTERS   [Room: Tavern Basement ▾]   [⚔ Ring] │
│  [Fight Log]   [Leaderboard]   [Profile]              │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Fight Log — Tavern Basement                         │
│                                                       │
│  #42   Stonefang vs Copperclaw          3 min ago    │
│        Stonefang won in 3 rounds                     │
│        ✦ Card drop: Brain Drain                      │
│                                                       │
│  #41   Stonefang vs Mirebell           17 min ago    │
│        Stonefang won in 6 rounds  ☠ Mirebell perished│
│                                                       │
│  #40   Copperclaw vs The Horned Terror  31 min ago   │
│        Draw after 8 rounds                           │
│        [Show card-by-card breakdown]                 │
│                                                       │
│  ... [Load 10 more]                                  │
└───────────────────────────────────────────────────────┘
```

Clicking a fight row expands it to show round-by-round card plays from the raw event log. This is the "card-by-card breakdown" link.

The Fight Log is accessible via a tab in the top navigation, same as Leaderboard. When a user arrives at the room after being away, the web app could automatically surface an inline catch-up banner:

```
╔══════════════════════════════════════╗
║  You were away for 3h 12m            ║
║  5 fights happened. [See what I missed] ║
╚══════════════════════════════════════╝
```

## Fight Event Payload Requirements

For `FightSummaryWriter` to populate summaries correctly, the `ring.win`, `ring.loss`, `ring.draw`, `ring.fled`, and `ring.permaDeath` event payloads need to carry structured participant data. Review current payloads in `packages/engine/src/announcements/` and ensure they include at minimum:

- `winnerMonsterId`, `winnerMonsterName`, `winnerOwnerUserId`
- `loserMonsterId`, `loserMonsterName`, `loserOwnerUserId`
- `xpGained` for each participant
- `cardDropName` if applicable

If any of these are missing, they need to be added to the relevant announcement modules during implementation. The `text` field already has the human-readable version; this adds the machine-readable structure alongside it.

## Relationship to Leaderboard (13-leaderboard.md)

Fight stats and leaderboard are complementary:

- The **leaderboard** answers "who's winning overall?" — aggregate career stats.
- **Fight stats** answer "what just happened?" and "how did my monster do in that fight?" — per-fight detail.

Both are populated from ring outcome events. The `FightStatsSubscriber` from `13-leaderboard.md` and the `FightSummaryWriter` here can share a single subscriber that handles all ring outcome events, or remain separate for clarity. Separate is probably cleaner — one writes to stats tables, one writes to `fight_summaries`.

## Non-Goals

- **Real-time fight animation**: replaying a fight card-by-card with delays and animations is a nice future feature (and ties into `09-graphics.md`) but out of scope here. The breakdown is static — all cards shown at once.
- **Fight search/filtering**: no search by card type or date range for now. Pagination and per-monster filtering are sufficient.
- **Fight replay on Discord**: Discord users get the text command catch-up. A rich embed showing round-by-round detail is post-launch.

## Tasks

### Database
- [x] Add `fight_summaries` table to Drizzle schema + Supabase migration
- [x] Add `lastSeenAt` column to `room_members` table
- [x] Add index on `fight_summaries(roomId, endedAt)` and per-monster indexes

### Server
- [x] Implement `FightSummaryWriter` — stateful event subscriber that assembles and writes fight summaries
- [x] Register `FightSummaryWriter` in server startup alongside `EventPersister` and `FightStatsSubscriber`
- [x] Update `lastSeenAt` in `room_members` on each `game.command` mutation and `game.ringFeed` subscription
- [x] Add `fightStats` tRPC procedures: `recentFights`, `fight`, `monsterFightHistory`, `catchUp`
- [x] Ensure `ring.win` / `ring.loss` / `ring.draw` / `ring.fled` / `ring.permaDeath` payloads carry structured participant data; update announcement modules if needed

### Engine / Commands
- [x] Add "what happened", "catch me up", "show recent fights", "show fight history" command aliases
- [x] Implement the catch-up text command handler — calls `catchUp` API, formats and emits the text summary

### Web UI
- [x] Add "Fight Log" tab/link to top navigation header
- [x] Implement `FightLogPage` component — paginated list of fight summaries, expandable rows
- [x] Implement inline catch-up banner shown on room join after absence (threshold: > 30 min away, > 0 fights)
- [x] Add "last fight" one-liner ticker to the bottom of the Ring pane
- [x] Implement expandable fight detail view (card-by-card breakdown from raw events)

## Open Questions

- **How long to retain fight summaries?** The raw `room_events` table has an open question about retention policy (7 days suggested in `02-backend-hosting.md`). Fight summaries are smaller and more valuable to keep longer — 30 or 90 days seems right. Decide during implementation.
- **Streak tracking**: "Stonefang is on a 3-fight winning streak" is compelling UX. Where does the current streak live — computed from recent `fight_summaries` at query time (simple, slightly expensive), or maintained as a counter on `room_monster_stats` (cheap to read, stateful)? Leaning toward computing it at query time for the first version.
- **Interrupted fights**: if the server restarts mid-fight, the `FightSummaryWriter`'s in-memory pending fight state is lost. These fights should be marked as abandoned (not win/loss/draw) rather than silently omitted. Add an `'abandoned'` outcome variant.
- **Multi-monster rings**: the current engine supports 2–12 monsters in the ring. Fight summaries assume 1v1 (winner + loser). Multi-monster fights need a richer participant array. Design the schema with this in mind even if the first implementation only handles 1v1 — use an array of participant objects rather than separate winner/loser columns.
