---
type: Reference
title: Feed lab and browser tests
description: How to run the real room UI with no server (the feed lab), what its scripted transport can do, and how the Playwright suite over it proves scrolling and reconnecting.
status: stable
audience: internal
tags: [web, testing, feeds, reconnect, playwright]
---
# Feed lab and browser tests

The unit tests under `apps/web/src/__tests__` run in jsdom, which has no layout: nothing has
a height and nothing scrolls. They cannot say whether a feed ends up where it should. The feed
lab and the suite over it can. Use them for any change to a feed, to scrolling, to the
`ringFeed` connection, or to a theme's feed type.

## The lab

`/lab` (and `/lab/<fixture>`) renders the real `AppShell` and `Terminal` on a scripted
transport. There is no server and no sign-in: `src/lab/LabRoute.tsx` supplies a fake signed-in
user and a tRPC client whose link (`lab-link.ts`) never leaves the page. It is a separate lazy
chunk, and it is reachable in production on purpose, so a phone can be checked against the
same script (roadmap 52, decision 3).

Run it with `pnpm --filter @deck-monsters/web dev` and open `http://localhost:5173/lab/duel`.
`lib/supabase.ts` throws without its two `VITE_SUPABASE_*` variables; any value will do for the
lab.

| URL parameter | Effect |
|---|---|
| `history=<n>` | The first n events are already in history when the page mounts |
| `play=1`, `speed=<x>` | Start playing at once, at x times real pacing |
| `latency=<ms>` | Delay every frame and every query by that long, from the first frame |
| `theme=<id>` | Start on that theme |
| `controls=0` | Hide the lab's control strip (the tests do) |
| `feedTimings=1` | Show the client timings overlay (works on real rooms too) |

### Fixtures

`apps/web/src/lab/fixtures/*.json` are recorded from real engine fights by
`pnpm --filter @deck-monsters/harness run sim:record-feed` (build the harness first). The
recorder runs the engine at production pacing on a virtual clock and keeps what a room member
receives on `ringFeed`. It is seeded: a re-run with no engine change writes the same bytes, so
a diff in a fixture means the engine's output changed. Re-record after such a change.

| Fixture | Events | What it is |
|---|---|---|
| `quiet-room` | 6 | Two monsters join; the countdown starts; no fight |
| `duel` | 209 | One two-monster fight, entry to results |
| `boss` | 292 | A player's monster against a summoned boss |
| `brawl` | 465 | Eight monsters, a ring event, many card frames |
| `long-session` | 936 | Three fights in a row, for soak runs |

Differences from production, all deliberate: the 60-second countdown is cut to 3 seconds; ids
end in a counter, not a random suffix; events that share a millisecond are 1 ms apart.

### `window.__feedLab`

`open(name, { historyCount, latencyMs })`, `ready()`, `play({ speed })`, `pause()`, `push(n)`
(a burst in one tick), `published()`, `remaining()`, `done()`, `setTheme(id)`, `state()`.

Connection faults: `drop({ downMs })` errors the subscription and refuses new ones while down;
`stall()` makes the open subscription go silent, heartbeats included, without closing it (a
dead socket the browser has not noticed; a new subscription is healthy); `resume()` ends a
stall without replaying; `setLatency(ms)`.

Evidence: `connectionLog()`, `deliveries()` and `deliveredIds()` (what reached the client and
how), and `timings()`.

The transport mirrors `ringFeed` in `packages/server/src/trpc/router.ts`: a handshake, replay
after `lastEventId`, a heartbeat every 8 seconds, `system.gap` when a cursor is unknown or a
replay hits its cap, and history without the types the server never persists. **It stands in
for tRPC's WebSocket client and for the server.** It does not exercise the real client's
reconnect and backoff, its socket keep-alive, a real network, or the server's replay from
Postgres. [The real-transport suite](#the-real-transport-suite) does.

## The real-transport suite

`packages/server/src/trpc/ring-feed-transport.pg.test.ts` (roadmap 52, D4) is the other half:
no browser and no React, but the real wire. It starts Fastify with tRPC's `useWSS` on an
ephemeral port, with the real router, a real `RoomManager` and `ChatService` on Postgres, real
room and member rows, and the server's own JWT check (a test key installed through
`_setJWKSOverride`, so the token still passes signature, issuer, audience and expiry checks).
The client is tRPC's real `createWSClient` and `wsLink`, built from
`apps/web/src/lib/ws-client-options.ts` (the same function `lib/trpc.ts` builds the app's
client from, so a change to the keep-alive numbers changes this suite) over Node's WebSocket.
Between them sits a TCP proxy (`src/shared/feed-transport-harness.ts`) that can reset every
connection, refuse new ones, or black-hole traffic without closing anything, and that reads
the WebSocket frames to see the client's `PING` and the cursor in each subscription it sends.

It covers what the lab cannot: the server answering `PING`; a healthy idle connection staying
open for 40 s with the app's settings; socket death recovered by the transport (reconnect,
the cursor re-sent, exactly the outage's events replayed, in order); a black hole; chat as the
last frame not wiping the cursor; the first subscribe, the Postgres replay for a cursor older
than the 200-event buffer, and `system.gap` at the 2000-row cap; a heartbeat id as a cursor;
and the app's resubscribe (what `useRingFeed` does: new input, `lastEventId`, `resumeAttempt`)
racing the transport's own reconnect, with the panes' id dedupe applied.

What it does not cover:

- **`useRingFeed` itself.** The hook's changes of input are replayed at client level, with the
  app's own `reconnectDelayMs` and `HEARTBEAT_TIMEOUT_MS` imported; the React state around
  them is not run. The lab and Playwright still own that.
- **A browser's WebSocket.** The client uses Node's. Its behaviour when the keep-alive closes
  a black-holed socket differs from a browser's (see below), so the black hole is measured, not
  proved, for browsers.
- **A real network, a load balancer, or TLS.** The proxy is on the loopback interface.
- `index.ts`'s server assembly is mirrored in `startRealServer`, not imported. Keep them in
  step.

```bash
# Needs Postgres with the Supabase stubs and every migration, as CI sets it up
# (psql -f packages/server/scripts/ci-supabase-stubs.sql; node packages/server/dist/migrate-cli.js).
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/deck_monsters_test
pnpm --filter @deck-monsters/server exec mocha --grep "real tRPC WebSocket client"
```

Without `TEST_DATABASE_URL` the suite is skipped, like the other `*.pg.test.ts` files; CI's
`Tests` job sets it. The suite takes about 80 seconds: 40 s of that is the idle soak (five
heartbeats) and 20 s the black hole. Each run prints `[timing]` and `[observed]` lines.

### What it measured (Node 22, loopback, 2026-11)

| Fault | Result |
|---|---|
| Idle, healthy, 40 s | One TCP connection, no state change; heartbeats 8 s apart; every `PING` the client sent got a `PONG` |
| Socket reset, one refused retry | New handshake after about 2.06 s (the first retry is immediate and refused; the next waits wsClient's 2 s). The re-sent subscription carried the last frame's id; the replay was exactly the outage's events, once each, in order |
| Black hole after a frame | The keep-alive calls `close()` 18.0 s after the last frame (PING at 8 s, pong timeout 10 s) |
| ... what happens next | With Node's WebSocket the socket then sits in `CLOSING` with no `close` event while the peer says nothing, so wsClient does not reconnect until the network answers. After it did, the second handshake and the full replay took about 55 ms |
| Chat as the last frame | The tracked heartbeat that follows it is the resume cursor; replay started after it |
| Cursor older than the buffer | Replayed from Postgres, in order, no gap; `dm_ring_feed_replay_from_db_total` rose by one |
| 2100 events after the cursor | 2000 replayed, then one `system.gap` with reason `replay_limit` |
| App resubscribe racing the transport | No event lost, none duplicated, no extra copies even before the dedupe; one live server subscription afterwards (`dm_ws_connections_active` is 1) |
| ... when the resubscribe lands inside wsClient's 2 s backoff | The new subscription opens the socket; when the backoff ends wsClient closes it and reopens, and each close triggers another reconnect: about 16 connections in 110 ms, then it settles. Nothing lost. Harmless for one client; a herd of clients after a deploy would each do it |

Two things the suite showed that are worth knowing:

- **The keep-alive detects a black hole but does not finish the job on its own in Node.** What
  a browser does after `close()` on a socket whose peer is silent is its own timeout
  (not measured here). The app's 20 s feed watchdog is therefore the safety net, which is why
  both exist.
- **tRPC sends the cursor in two places.** A new subscription carries it in the input
  (`lastEventId`). After the first data frame the client keeps `params.lastEventId` up to date
  and puts it on every re-send, and the server lets that override the input's. On the
  transport's own reconnect the cursor is therefore the last frame's id (a heartbeat is fine),
  not the hook's last real event.

The heartbeat-cursor tests include the case that used to draw a false "Some events were
missed" line (10b #270): only events the player may not see follow the heartbeat.

## Client timings

`apps/web/src/lib/feed-timings.ts` counts and times what a reader feels, always on and nearly
free: re-pins, unfollows, list mounts and remounts, duplicate drops, time to first rows, time
to first handshake, each reconnect, and the gap since the last frame when a connection is
declared lost. Read it at `window.__feedTimings.snapshot()`, or add `?feedTimings=1` to any
room URL for an overlay (`?feedTimings=0` turns it off). The numbers stay in the browser.

## The browser suite

```bash
pnpm --filter @deck-monsters/web run test:e2e            # everything, about 10 minutes
pnpm --filter @deck-monsters/web exec playwright test scroll
pnpm --filter @deck-monsters/web exec playwright test connection
E2E_SOAK=1 pnpm --filter @deck-monsters/web exec playwright test scroll-soak
node apps/web/e2e/summarize.mjs --failing                # the last run, as a table
```

`apps/web/playwright.config.ts` builds the app, serves it with `vite preview`, and runs
Chromium at 390 × 844 (touch) and 1440 × 900. `E2E_WEBKIT=1` adds WebKit at both sizes; CI
sets it. Agent containers ship Chromium only, so a WebKit result comes from CI. Mobile WebKit refuses Playwright's mouse
wheel and has no touch-drag API, so on `webkit-phone` a scroll gesture is set in script after
dispatched touch events (`wheelBy` in `e2e/lab.ts`). That proves layout and follow rules
there, not momentum scrolling.

- `e2e/scroll.spec.ts`: following, reading back, walking up through history, returning,
  theme switches, rotation, and opening, for the Ring and the Console.
- `e2e/connection.spec.ts`: drops, outages, silent stalls, hidden and frozen pages,
  offline and online, slow links, first-load timings, and replay bursts, on Playwright's fake
  clock.
- Every test records what it measured with `measure()` (`e2e/lab.ts`), so the report carries
  pixels and milliseconds, not only pass and fail.

Rules for the suite:

- **A failing test is a finding.** Do not loosen a tolerance, add a retry, or skip a test to
  get a green run. Fix the app, or record the failure in
  [the open bug list](../roadmap/10-bug-fixes.md).
- **A UI bug gets a failing scenario first,** then the fix, the way an engine bug gets a
  failing test.
- **Quote the numbers.** A change to a feed or the connection gives the measured values
  before and after in its PR.
- Chromium and WebKit under Playwright are not an iPhone. The device check in
  [small leftovers](../roadmap/22-small-leftovers.md) stays manual; run it against the lab.

The state of the app when the suite was first run is the
[feed stability baseline](feed-stability-baseline.md).
