# Ring feed ordering and harness motivation

This note records **why** the local simulation harness (`@deck-monsters/harness`) was added: to reproduce and study **public ring message ordering** and related stability issues without running the full web stack.

## Initial issue (reported)

Users observed the browser **Ring** pane showing **battle narration in a logically inconsistent order**. Examples from real sessions included:

- **HP and outcomes appearing out of sync** — e.g. lines suggesting a creature was killed or at a given HP adjacent to text that implied a different game state (healing, damage, or “killed” lines not reading as a single coherent timeline).
- **Turn / round headers** (`round N, turn M`) sometimes appearing **next to the wrong actions** relative to a strict turn-by-turn reading.
- **Interleaved or duplicated-looking blocks** when multiple narrations were active in one fight.
- Separate reports that the experience **“potentially also caused crashes”** (client or server not fully pinned down at the time of investigation).

The legacy **`battlefield.js`** demo exercised an older API surface and did not mirror the **event bus → WebSocket ring feed** path the web app uses today, so it was a poor fit for validating ordering hypotheses.

## Likely contributing factors (hypotheses)

These are **hypotheses** for follow-up work; the harness is meant to help confirm or rule them out.

1. **Concurrent engine entry points per room**  
   The server’s `game.command` handler **does not await** the full engine action (to avoid holding HTTP open on long interactive flows). Only a **per-user** lock prevents one user from overlapping their own commands. **Two different users** in the same room can still invoke `handleCommand` concurrently on the **same `Game`**, which can interleave async work (including `ring.fight()` / `card.play()` chains) and therefore **interleave `eventBus.publish` calls**.

2. **Async combat loop**  
   Ring combat advances through promises and short delays between card plays. If multiple fights or commands overlap (see above), **publish order** can diverge from a single sequential narrative.

3. **Weak total ordering on events**  
   Events use `Date.now()`-based ids/timestamps. Bursts of publishes in the same millisecond are still uniquely identified, but **timestamp alone is not a monotonic sequence number** for sorting or reconciliation after reconnect.

4. **Exploration and creature timers**  
   Unrelated long-lived `setTimeout` / `setInterval` loops (exploration tick, passive healing on creatures) were found to keep **Node processes alive** during early harness experiments; some of that cleanup is now handled in `Game.dispose()` / `Ring.clearRing()` / `BaseCreature.disposeTimers()`. These are more about **script exit and resource hygiene** than message order, but they matter for reliable automated runs.

## What the harness is for

- Run **extended, repeatable** ring scenarios locally (`DECK_MONSTERS_SKIP_DELAYS` for fast fights).
- Capture the **public** `RoomEventBus` stream **in delivery order** (`capturePublicFeed`) to test ordering hypotheses.
- Add scenarios that mirror **production wiring** (`createTestGame`, `runCommand`, auto-responders) without HTTP or Postgres.
- Support **seeded RNG** (`--seed`) for deterministic fight replays when investigating race conditions vs. logic bugs.

## Related code (starting points)

| Area | Role |
|------|------|
| `packages/server/src/trpc/router.ts` | `game.command` — fire-and-forget actions, per-user `activeFlows` lock |
| `packages/engine/src/events/room-event-bus.ts` | Synchronous fan-out to subscribers; order follows **call order** of `publish` |
| `packages/server/src/trpc/router.ts` (`ringFeed`) | WebSocket subscription queue for live events |
| `packages/engine/src/channel/index.ts` | Legacy `ChannelManager` batching (Slack-era); not the web ring path |
| `packages/harness/` | CLI + public feed capture + scenarios |

## Outcome

The harness does **not** by itself fix ordering bugs; it provides a **controlled environment** to reproduce them and to verify fixes (e.g. room-wide command serialization) under load. Update this document when a root cause is confirmed or a mitigation ships.
