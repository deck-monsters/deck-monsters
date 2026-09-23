# Analytics and history

Status: Current
Read before: changing fight outcome payloads, event/history persistence, leaderboards,
fight summaries, catch-up, coin/XP projections, or retention.

## Three durable views

The server derives three different read models from room events:

| Model | Tables | Purpose |
|---|---|---|
| Raw event history | `room_events` | Reconnect fallback, Ring/Console history, fight detail |
| Career projection | `room_player_stats`, `room_monster_stats` | Room and global leaderboards |
| Fight summaries | `fight_summaries`, `rooms.fight_counter` | Fight Log, per-monster history, catch-up |

These are projections. The room's serialized engine state remains authoritative for the
live character, balance, monsters, and ring.

## Projection subscribers

`RoomManager` attaches the event persister, `FightStatsSubscriber`, and
`FightSummaryWriter` to every active room and detaches them on unload/reset/delete.

`FightStatsSubscriber` reads `ring.fightResolved.participants` and upserts one player and
monster row per non-boss participant. Outcomes increment W/L/draw; XP comes only from the
resolved participant payload. Boss owner id `'boss'` is not a profile UUID and is filtered
before any foreign-key write.

Coin rewards arrive on private `ring.xp` events. The stats subscriber is therefore a
trusted `includePrivate` room projection and increments `coins_earned` there. On room load,
the current character balance repairs a zero/stale historical projection with
`GREATEST(existing, balance)`. Balance is only a lower bound on lifetime earnings because
purchases reduce it; reconciliation never replaces a larger projected total.

`FightSummaryWriter` records fight start time on `ring.fight`, an optional public card drop,
and consumes `ring.fightResolved`. It snapshots and clears pending metadata synchronously,
then performs a serialized, retried transaction that increments the room fight counter and
writes one summary. If the process restarted after start metadata was lost, the summary is
still written with `startedAt === endedAt`.

`participants` is authoritative for any fight size. Winner/loser columns are only a 1v1
convenience and may be null. `notable_cards` is reserved and is currently not populated.

## Query scope and identity

Room leaderboard, fight-log, fight-detail, per-monster history, and catch-up procedures all:

1. require authentication;
2. validate room membership;
3. filter by the requested `roomId`.

Room player rankings prefer the current room character alias; global player rankings use
the public profile display name. Global leaderboard procedures are authenticated but do not
require membership in one room. They intentionally aggregate career rows across rooms.

Monster identity is `(room_id, stable monster id)` in room projections. Current names can
come from the live room game; stored names preserve a historical/fallback value. Resetting
a room clears player stats, monster stats, summaries, and the fight counter together.

Email-derived profile names are masked on every public projection. Fight participant owner
names are masked before rows reach the client.

## Private reward and fight-detail visibility

Raw fight detail is selected by the summary's start/end time because `room_events` has no
fight id. That interval can include private XP/coin narration and prompts from multiple
players. `loadFightEventsForSummary` therefore combines:

- `room_id = requested room`;
- the summary time window;
- `eventVisibilityFor(viewerUserId)`.

Never replace that predicate with room membership. A trusted stats projection may observe
all private reward events with `includePrivate`; a player-facing history query may not.

## History and catch-up paths

- `ringHistory`: public room events, newest 500 in 24 hours; if fewer than 20, up to 20
  from 7 days.
- `consoleHistory`: viewer's private events, newest 200 in 24 hours; if fewer than 20, up
  to 20 from 7 days.
- reconnect replay: raw events after a cursor, first from the 200-event memory buffer and
  then durable storage.
- `recentFights`: paged summaries ordered by `ended_at DESC`.
- `fight`: one room summary plus only raw events visible to the viewer.
- `monsterFightHistory`: JSONB participant containment, so multi-contestant fights are not
  lost when 1v1 convenience columns are null.
- `catchUp`: summaries since explicit `since`, otherwise member `last_seen_at`, otherwise
  one hour. It returns count, rows, and rendered text, computes current win streaks from up
  to 80 recent fights, and normally touches `last_seen_at`.
- the engine text command uses the same room analytics callbacks and updates last-seen
  after rendering.

## Retention and failure policy

There is currently no automated pruning job for `room_events` or `fight_summaries`.
History reads use 24-hour/7-day windows, but that is a read policy, not deletion. Summary
retention remains undecided; do not claim a 30-, 90-, or 7-day deletion contract until a
job and operational policy exist.

Event, stats, and summary writes are best-effort relative to gameplay: failures are logged
and do not crash a fight. Event and summary writers retry transient failures with bounded
backoff. Stats isolate each participant so one invalid row does not discard everyone after
it.

## Change checklist

- [ ] Outcome payloads keep stable ids, owner ids, outcome, XP, level, and display fields.
- [ ] Boss sentinels are filtered before profile-UUID writes.
- [ ] XP/W/L are counted once from `fightResolved`; coin-only rewards come from `ring.xp`.
- [ ] Trusted private-event projection is not confused with viewer visibility.
- [ ] Room queries validate membership and filter by room.
- [ ] Global procedures are explicit aggregates, not accidental missing filters.
- [ ] Multi-contestant history uses `participants`, not only winner/loser columns.
- [ ] A retention claim names an implemented deletion job; read windows are not retention.
