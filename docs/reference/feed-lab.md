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
Postgres. Roadmap 52 task D4 is the suite that will.

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
sets it. Agent containers ship Chromium only, so a WebKit result comes from CI.

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
