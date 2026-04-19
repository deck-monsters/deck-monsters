# Leaderboard

**Category**: Feature  
**Priority**: Medium (post-launch)  
**Status**: Done

## Background

The engine already has rudimentary in-memory rankings: `lookAtCharacterRankings` and `lookAtMonsterRankings` sort the current room's characters and monsters by XP and return a top-5 text list. This works for a single room that's continuously running, but has two hard limits:

1. **Stats are lost on restart.** Player XP and monster battle records survive (they're in the state snapshot), but the ranking *view* is computed on demand from live in-memory state. If you want historical stats — career win rates, all-time records — the data isn't there.
2. **Rankings are room-scoped.** There's no concept of a global leaderboard across rooms.

As multi-room play ramps up, players will want to know who the top Beastmasters are across the whole server, not just in their own room.

## Design Goals

- **Persisted stats**: win/loss/draw record and XP stored in the database, not just in the ephemeral game snapshot. Survives restarts, room resets, and monster dismissals.
- **Two scopes**: per-room rankings (who's winning *here*) and global rankings (who's winning *anywhere*).
- **Two surfaces**: a dedicated web UI leaderboard page and the existing text command interface.
- **Sortable**: sort by XP, wins, win rate, or coins. Default is XP (matches current behavior).
- **Two leaderboard types**: top players (Beastmasters) and top monsters (creatures). Both already exist as text commands; extend them with persistence and global scope.
- **No breaking changes to text commands**: "look at character rankings" and "look at monster rankings" keep working as before, now backed by DB data.

## Architecture

### New Database Tables

```typescript
// room_player_stats — career stats per player per room
room_player_stats: {
  roomId: uuid references rooms(id) on delete cascade,
  userId: uuid references profiles(id) on delete cascade,
  xp: integer not null default 0,
  wins: integer not null default 0,
  losses: integer not null default 0,
  draws: integer not null default 0,
  coinsEarned: integer not null default 0,
  updatedAt: timestamp default now(),
  primary key (roomId, userId)
}

// room_monster_stats — career stats per monster per room
// Monster identity uses the stable string ID embedded in the game state snapshot.
room_monster_stats: {
  roomId: uuid references rooms(id) on delete cascade,
  monsterId: text not null,       // stable engine-generated creature ID
  ownerUserId: uuid references profiles(id),
  displayName: text not null,
  monsterType: text not null,     // 'Basilisk' | 'Gladiator' etc.
  xp: integer not null default 0,
  level: integer not null default 1,
  wins: integer not null default 0,
  losses: integer not null default 0,
  draws: integer not null default 0,
  updatedAt: timestamp default now(),
  primary key (roomId, monsterId)
}
```

Global rankings are derived from these tables at query time using aggregate views or simple `GROUP BY userId` across all rooms, no separate global table needed.

### Stat Update Flow

Stats are updated by a server-side event subscriber that watches `ring.win`, `ring.loss`, `ring.draw`, and `ring.fled` events:

```
ring.win event emitted
  ↓
FightStatsSubscriber (packages/server/src/fight-stats.ts)
  ↓
upsert room_player_stats (winner +1 win, loser +1 loss)
upsert room_monster_stats (winning monster +1 win, losing monster +1 loss)
```

The event payload for `ring.win` / `ring.loss` already carries contestant info (monster ID, owner user ID, XP delta). The subscriber reads these and writes to the DB. This is the same pattern used by `EventPersister` (`event-persister.ts`) for writing raw events — a second lightweight subscriber alongside it.

XP changes from `ring.xp` events update both the player's and monster's `xp` column. Coin earnings from `ring.win` / `ring.cardDrop` events update `coinsEarned`.

**On stat write failures**: log the error, don't crash the game. Stat writes are best-effort analytics — a missed write means a fight isn't counted, which is acceptable. Do not retry in a tight loop.

### API: New tRPC Procedures

Add a `leaderboard` router:

```typescript
leaderboard.roomPlayers({ roomId, limit?, sortBy? })
// → { rank, displayName, xp, wins, losses, draws, winRate }[]
// sortBy: 'xp' (default) | 'wins' | 'winRate' | 'coins'
// limit: 10 default, max 50

leaderboard.roomMonsters({ roomId, limit?, sortBy? })
// → { rank, displayName, monsterType, ownerName, xp, level, wins, losses, winRate }[]

leaderboard.globalPlayers({ limit?, sortBy? })
// → { rank, displayName, xp, wins, losses, draws, winRate, roomCount }[]
// Aggregates across all rooms for each userId

leaderboard.globalMonsters({ limit?, sortBy? })
// → { rank, displayName, monsterType, ownerName, xp, level, wins, losses, winRate }[]
```

All procedures are `protectedProcedure` (require auth). Global procedures don't require room membership — the data is public within the game.

### Text Command Interface

The engine's existing `look at character rankings` and `look at monster rankings` commands remain the entry point. Instead of reading from in-memory state, they call the new tRPC leaderboard procedures (or the underlying DB query directly via the server's `RoomManager`).

New command aliases to consider:

```
leaderboard
show leaderboard
look at leaderboard
top players
top monsters
```

All route to the same room-scoped leaderboard. The text output format stays the same (the pre-rendered `text` field on the GameEvent), but now shows wins and win rate alongside XP:

```
Top 5 Players by XP:

 Vlad        305 XP   12W  3L  80%
 JaneSmith   198 XP    7W  5L  58%
 ...
```

For a "global" leaderboard via text: `global leaderboard` or `look at global rankings` — a new command variant that queries across rooms and formats the same way.

### Web UI: Leaderboard Page

The leaderboard web page **breaks from the terminal aesthetic** — the same pattern established in `06a-web-app.md` for room management UIs. It's a normal web page with sortable tables, not a terminal pane.

**Navigation**: accessible via a "Leaderboard" tab or link in the top header bar of the web app, visible from any room view. The header is already the designated place for nav that doesn't consume the pane's horizontal space.

**Layout**:

```
┌───────────────────────────────────────────────────────┐
│  DECK MONSTERS   [Room: Tavern Basement ▾]   [⚔ Ring] │
│  [Leaderboard]   [Profile]   [Settings]               │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Leaderboard                                          │
│                                                       │
│  ○ This Room  ○ Global     Players | Monsters         │
│                                                       │
│  Sort by: [ XP ▾ ]                                    │
│                                                       │
│  #   Name          XP     W    L   Win Rate           │
│  1   Vlad         305    12    3    80%               │
│  2   JaneSmith    198     7    5    58%               │
│  ...                                                  │
└───────────────────────────────────────────────────────┘
```

Two toggle groups:
- **Scope**: This Room / Global
- **Type**: Players / Monsters

One sort dropdown. No pagination for now — show top 25. "This Room" is the default when visiting from inside a room; "Global" is the default when visiting without a room context (e.g., from the home screen).

The monster leaderboard adds an "Owner" column and a "Type" column (Basilisk, Gladiator, etc.).

**Data freshness**: the leaderboard page polls or re-fetches on focus. No real-time subscription needed here — leaderboard data changing second-by-second is fine to show stale for a minute.

## Migration: Backfilling Stats

When this feature is deployed, existing rooms already have character XP and battle records in the game state snapshot. A one-time backfill job should read each room's state blob, deserialize it, and write the in-memory stats into the new DB tables. This ensures the leaderboard has data on day one rather than starting from zero.

The backfill runs as a one-off script, not as part of the regular server startup. After the backfill, the event subscriber keeps stats current.

## Non-Goals

- **ELO or ladder ranking**: a simple win count and XP sort is enough for now. Skill-based matchmaking and structured seasons are post-launch concerns.
- **Per-fight detailed stats on the leaderboard page**: that belongs to the fight stats document (`14-fight-stats.md`).
- **Leaderboard on Discord**: Discord embeds work but this is extra connector work. The text command interface is sufficient for Discord users.

## Tasks

### Database
- [x] Add `room_player_stats` table to Drizzle schema + Supabase migration
- [x] Add `room_monster_stats` table to Drizzle schema + Supabase migration
- [x] Write one-time backfill script to seed tables from existing state blobs

### Server
- [x] Implement `FightStatsSubscriber` — listens to `ring.fightResolved` (W/L/draw/XP for all participants) and `ring.xp` (coins only, to avoid double-counting XP) and upserts stats tables
- [x] Register `FightStatsSubscriber` alongside `EventPersister` in server startup
- [x] Add `leaderboard` tRPC router with `roomPlayers`, `roomMonsters`, `globalPlayers`, `globalMonsters` procedures
- [x] Update `lookAtCharacterRankings` and `lookAtMonsterRankings` in `Game` to read from DB (via `RoomManager`) instead of in-memory sort

### Engine / Commands
- [x] Add "leaderboard", "global leaderboard", "top players", "top monsters" command aliases in `commands/history.ts`
- [x] Add "global monster leaderboard" / "look at global monster rankings" command aliases

### Web UI
- [x] Add "Leaderboard" link/tab to top navigation header
- [x] Implement `LeaderboardPage` component (scope toggle, type toggle, sort dropdown, table)
- [x] Wire `LeaderboardPage` to tRPC `leaderboard.*` procedures
- [x] Pre-select "This Room" scope when navigating from a room context

## Pending

- [x] **Win streak in leaderboard**: room monster leaderboard shows consecutive wins from the last 80 fights (`winStreak` column + badge when ≥3); text leaderboard includes `streak N` when > 0.
- [x] **Win rate denominator in UI**: table headers use tooltips explaining W÷(W+L), draws excluded.

## Open Questions

- **Global leaderboard privacy**: should players be able to opt out of appearing in the global leaderboard? Easy to add a `profileVisibility` flag on `profiles`. Probably not needed for a private game server, but worth noting.
- **Monster identity across resets**: monster IDs are stable within a room's lifetime, but if a room is reset, old stats for those monster IDs become orphaned. Currently cleared on reset (`resetRoomState` in `RoomManager`). Verify this is working and document it.
