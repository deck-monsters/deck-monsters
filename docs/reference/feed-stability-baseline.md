---
type: Reference
title: Feed stability baseline (November 2026)
description: What the browser suite measured on the web app before any fix — where scrolling, opening and reconnecting fail, by how much, and what the code polls for.
status: stable
audience: internal
tags: [web, feeds, reconnect, testing, baseline]
---
# Feed stability baseline (November 2026)

Measured on 2026-11-11 at commit `3f78232`, with the [feed lab and browser suite](feed-lab.md):
Chromium at 390 × 844 (touch) and 1440 × 900, the production build, recorded engine fights.
This is the "before" for [roadmap 52](../roadmap/52-stability-and-next-work.md). No fix had
been made.

**Result: 125 passed, 15 failed, 12 skipped** (skips are tests for the other screen size).
The scroll tests ran four times in all; one more test failed once in three earlier runs.

## Limits of this baseline

- **Chromium only.** WebKit runs in CI, not in the container this was measured in. iOS Safari
  is where the two "unconfirmed on device" fixes live, and it is not covered here.
- **The connection tests use the lab's transport,** not tRPC's WebSocket client or the server.
  They measure the app's own watchdog, resume and markers.
- Cause notes below are hypotheses from reading the code. Only the measurements are facts.

## Scrolling: what fails

| # | What a player sees | Where | Measured |
|---|---|---|---|
| S1 | **Opening a room shows the oldest rows first, then jumps.** | Ring, both sizes | Desktop: the list is drawn at the top of 300 rows in 2 to 4 DOM states and is off the bottom for 1 to 3 frames (17 to 33 ms). Phone, first visit to the Ring tab: 2 painted frames at row 0 with 25,000 to 30,000 px below, 83 ms off the bottom |
| S2 | **`↓ Latest` stops short and stays on screen.** | Ring, both sizes, both themes | Ends 8 to 10 px above the bottom and the button is still showing 8 seconds later. The Console lands in about 0.4 s |
| S3 | **Changing theme while reading back throws you to the first event.** | Ring, phosphor to Millefleur | The list remounts twice and ends at row 0, 20,000 to 25,000 px from where the reader was |
| S4 | **Rotating a phone while reading back loses the row.** | Ring, Millefleur | Failed in 3 of 3 early runs, passed in the baseline run: flaky |
| S5 | **Scrolling up two lines gets pulled back down.** | Console, desktop, phosphor | A 41 px scroll-up returns to 0 when events arrive; the row the reader was on moves 61 px |
| S6 | **Touch-scrolling up through a fight jumps.** | Ring, phone | 1 to 7 of 34 drags land about 20 px off (6 px on Millefleur). The mouse wheel is clean (1 px) |
| S7 | **After a resize the feed can sit short of the bottom.** | Ring | 19 px short on desktop in 1 of 3 early runs: flaky |

**Following lags, then catches up.** Every "following" test ends pinned, but while events
arrive the Ring is often behind:

| Case | Furthest behind | Share of samples more than 8 px behind | Longest stretch behind |
|---|---|---|---|
| 20 events, 150 ms apart | 544 px | 47% | 0.3 s |
| Play at 8× for 10 s | 1,081 to 1,171 px | 12 to 18% | 0.1 s |
| The roster grows and the item panel appears | 1,747 to 1,760 px | 41 to 48% | 0.3 to 0.45 s |

**What holds.** Reading back from far up: the row does not move (0 px) and following stays
off, on both panes. Waiting 3 seconds and then receiving events: the same. Scrolling back down
by hand resumes following. A theme switch or a rotation while following ends at the bottom. A
936-event session at 20× on desktop kept 6 to 12 rows in the DOM, a flat heap, and no frame
over 17 ms.

**Time to first rows:** desktop 55 to 136 ms. On a phone the Ring's first rows come 0.9 s
(phosphor) to 1.4 s (Millefleur) after the pane mounts; the tap on the Ring tab itself takes
about 90 ms.

## Connection: what fails or is slow

| # | What happens | Measured |
|---|---|---|
| C1 | **A silently dead connection shows nothing.** No banner, marker or row until the watchdog fires | 31 to 49 s, by where in the 20 s heartbeat the stall began |
| C2 | **Unlocking a phone with a dead connection waits again.** Becoming visible restarts the watchdog instead of testing the connection | Exactly 50.0 s after the page is visible |
| C3 | **The browser's `offline` and `online` events are ignored** | No reaction within 5 s of either; the watchdog still takes 49.5 s |
| C4 | **Every page load draws a "reconnected" line** with no loss before it. Seeding the cursor from history changes the subscription's input, so it subscribes twice, and the second handshake reads as a reconnect | One false divider about 2.5 s after load. At 800 ms latency the first handshake takes 1.6 s on desktop, twice the link's delay |
| C5 | **A quiet room shows "reconnected" with no "connection lost".** The loss divider is skipped when the feed already ends in a divider | The one connection test that fails |
| C6 | **A failed resubscribe is retried at once, with no backoff** | 101 attempts in a 5 s outage on the lab's link. The real WebSocket client's own pacing is not measured here |
| C7 | **On a slow link the Console says "Type a command below to start"** while its history is still loading | 2.9 s at 3,000 ms latency |

**What holds.** In every scenario that could check it, nothing was lost, doubled or reordered:
a clean drop, a 5 s outage with 20 events, a stall with 150 events, two drops 30 ms apart. A
healthy connection hidden for 5 minutes never reports a false reconnect (bug 127's fix
holds). A drop the browser reports is recovered in milliseconds.

## Read from the code, not measured

**Frames are large.** A recorded `ring.fight` "fight concludes" event is about 75 KB, and
`ring.xp`, `ring.loss` and `ring.cardDrop` are 12 to 24 KB each, because the payload carries
whole engine objects (a monster's full options, its hit log). A 465-event fight is 1.4 MB of
feed.

**History is fetched again on every focus and thrown away.** `game.ringHistory` and
`game.consoleHistory` use react-query's defaults, so they refetch when the window regains
focus and when the browser comes online. Both panes apply history once and ignore every later
result. With frames that size, a phone returning to the tab downloads the room's history for
nothing.

**What the web polls for,** beside the pushed feed:

| Value on screen | Procedure | Interval | Worst delay | A feed event already says it? |
|---|---|---|---|---|
| The Console's open question | `game.pendingPrompt` | 3 s | 3 to 6 s if the push is missed | Yes: `prompt.request`, `prompt.timeout`, `prompt.cancel`. The poll is a backstop |
| The Workshop's "a Console action is waiting" | `game.flowStatus` | 3 s | 3 s | None found |
| Boss-summon charges in the Ring footer | `game.ringState` | 60 s | 60 s | No: charges are per player and not in the public `ring.state` |
| "A fight is on" for the Fights and Leaders pages | `game.ringState` | 15 s, 5 s during a fight | 15 s | `ring.state` says it, but those pages have no feed connection |
| The Ring footer's last fight | `game.recentFights` | 2 s for up to 60 s after a fight | About 2 s | None for "the summary was written" |
| The Fights list | `game.recentFights` | 5 s during a fight | One refetch at the end; a late summary waits for the next focus | None |
| The Workshop's monsters, wallet and items | `game.myInventory` | 30 s | 30 s; coins come at once from `ring.xp` | Coins only |
| The shop | `game.shop` | 30 s | 30 s | None found |
| "Use an item" during a fight | `game.myInventory` | 15 s | 15 s | None found |

## What this says about the design

- The scroll failures (S1, S2, S3, S4, S6, S7) all come from one fact: a virtual list does not
  know a row's height until it has drawn it, and the Ring's rows vary from one line to a
  card frame. The list opens at row 0 and corrects, guesses heights and corrects, and
  remounts when a theme changes the guess. S5 is the follow heuristic reading a small
  scroll-up as the bottom moving away.
- The lag while following is the same list scrolling smoothly toward a target that moves as
  rows are measured.
- The connection is slow to notice trouble because one 50 s timer is the only detector, and
  the one moment when a test would be cheap (the page becoming visible) resets it.
- The events themselves arrive intact. The transport's replay and the panes' deduplication do
  their job.

Roadmap 52's Pass C tests whether a plain capped list and a connection state machine remove
these, against the same suite.
