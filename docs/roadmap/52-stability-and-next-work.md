---
type: Roadmap
title: Feed stability, proof systems, and the next passes
description: Plan from the November 2026 roadmap review — clean up roadmap drift, build a real-browser proof harness for the feeds and the connection, decide the feed and reconnect architecture on measured evidence, then take the next feature work.
status: draft
audience: internal
tags: [roadmap, planning, web, testing, feeds, reconnect]
---
# 52 — Feed stability, proof systems, and the next passes

**Status:** Accepted by the owner (2026-11-10). Pass A is done. Passes B and C are done (B3b moved to D4). Pass D is under way: the connection is rebuilt, and
the plain feed list is green on WebKit and waits behind `?feed=plain` for the owner's phone check. Pass E has started: E1 (preset loading) is done. The decisions below are settled.

## Why

The owner (2026-11-10), after a review of the roadmap and backlog: the UI "is often a little
bit buggy. Either manual scrolling works poorly or autoscroll works poorly or both depending on
the tweaks we've made, things seem to take longer to reconnect or display than we'd expect."
The ask is to evaluate the choices made in the frontend, decide whether it is the right
architecture, and decide whether better systems are needed "for testing and proving things as
we go."

The same review found roadmap files that disagree with the code and with each other, and
picked candidates for the next feature work. This plan covers all three.

## What the review found

Read from the code and the fixed-bug ledger on 2026-11-10, before anything was measured.
Pass B then measured it: the [baseline](../reference/feed-stability-baseline.md) confirms the
scroll and connection points below and adds several this review missed.

### The feeds follow the bottom by guessing

- Both feeds are `react-virtuoso` lists. Feed rows have very different heights (a narration
  line, a multi-line event, a card frame), and a virtual list does not know a row's height
  until it has drawn it.
- Three layers of guesses sit on top of that:
  - `utils/feed-row-height.ts` predicts each row's height from the live CSS, a hidden probe
    row, and the pane's measured width. Virtuoso reads the guesses only once, so the list
    waits for history and a real width before mounting, and is unmounted and remounted when a
    theme changes the feed's type.
  - `hooks/useFeedAutoScroll.ts` decides whether the reader left the bottom from a 1.5 second
    window after a scroll gesture, an 8 px threshold, and a second re-pin 250 ms later.
  - `followOutput` scrolls smoothly, and a smooth scroll that ends short is one of the cases
    the re-pin exists to repair.
- The ledger shows the trade the owner describes. #129 and #132: the Console fought the
  reader's scroll. #148 widened the threshold so the Ring would not un-pin, and #159 found that
  made following worse. #196: scrolling up jumped, fixed by the height guesses. #234: one theme
  was 2 px off. Each fix moved a threshold or added a timer, and the next bug came from the
  other direction.
- The Ring's history is capped at 500 events and the Console's at 200 (`room-manager.ts`).
  Events added during a session are never trimmed. So the list is virtual to handle a size
  that the server mostly prevents, plus growth that a cap would also prevent.
- `RingPane.tsx` (842 lines) and `ConsolePane.tsx` (1,287 lines) each keep their own event
  array, fetch their own history, and merge and deduplicate it against live events
  separately.

### A dead connection can go unnoticed for most of a minute

- The live feed is one tRPC WebSocket subscription (`lib/trpc.ts`), with no `keepAlive` and no
  retry settings of its own.
- The server sends a heartbeat every 20 seconds. The client declares the connection dead after
  50 seconds without a frame (`useRingFeed.tsx`), unless the browser reports the socket closed
  first.
- When a hidden tab becomes visible, the watchdog is reset to a fresh 50 seconds (#127, so a
  frozen timer is not mistaken for a dead socket). Nothing probes the connection at that
  moment. A phone that comes back with a silently dead socket can therefore wait up to 50
  seconds before a reconnect even starts.
- Nothing listens for the browser's `online`, `offline` or `pageshow` events.
- The cursor and replay are hand-built on top of tRPC. Whether tRPC 11's own resume for
  tracked events could replace part of that has not been checked.

### State arrives by push and by polling

Beside the pushed feed, the web polls: the pending prompt and the flow status every 3 seconds,
ring state every 2 seconds while a fight number is stale (60 otherwise), the fight list every 5
seconds during a fight, the ring inventory every 15, and the Workshop every 30. A value that
"takes longer to display than expected" may be waiting on one of these. Several earlier bugs
were this (#145, #152).

### Nothing automated runs in a browser

- The web has about 100 test files. All run under jsdom, which has no layout: every element is
  0 px high and nothing scrolls.
- Ten of them replace `react-virtuoso` with a stub, so the scroll tests check that the app
  calls the library the way its author intended, not that the feed ends up in the right place.
- CI runs typecheck, lint and those tests. No job opens a browser.
- Live checks are agents driving a browser by hand from a checklist. They find real bugs, and
  they are not repeatable: a fix that passed one check is not rechecked when the next change
  lands.
- Two fixes are still marked "unconfirmed on device" (#125, #129), and
  [22](22-small-leftovers.md) still carries the iPhone check.
- The client records no timings. There is no number for how long a reconnect takes or how
  often the feed re-pins.

[Working in this repo](../agents/working-in-this-repo.md) said it at the time: "Automated tests
do not catch pacing, scroll, or narration problems; most of the bugs in the archive were found
by playing." This plan's main bet is that this can be changed. Pass B did: see the
[baseline](../reference/feed-stability-baseline.md).

## Decisions

The owner (2026-11-10) took the recommendation on each, and answered the fifth:

1. **Order.** A, then B and C, then D, then the features (E). E1 touches only the Workshop and
   may run beside B if the usage budget allows.
2. **A cap on the live feed is acceptable** if it makes scrolling reliable: the newest rows on
   screen (a figure Pass C measures, around 800 to 1,000), older fights in the Fights tab.
3. **A lab page may be reachable in production** by a hidden route, so a real-iPhone check is
   a five-minute job.
4. **Client timings stay in the browser** (a debug overlay) for now. Reporting them to the
   server is a later choice, once the numbers show which are worth keeping.
5. **Millefleur is shipped,** "and more or less complete". [46](../archive/roadmap/46-unicorn-theme.md)
   is archived. The owner does not recall what the painted Workshop portraits were to be, so
   that is a question in [22](22-small-leftovers.md), not a task.
6. **The browser suite blocks a merge** once it is green.
7. **Subagents** (owner): use them where they save the orchestrator's context: the cheapest
   tier for gathering facts, the middle tier for checks and bounded writing, a larger model
   only sparingly, because handing a plan to a new agent has a cost of its own.

## Pass A — roadmap cleanup

**Done (2026-11-10).** Docs only. Every item was checked against the code on 2026-11-10. Follow the
[docs skill](../../.cursor/skills/maintaining-repository-docs/SKILL.md) and run
`pnpm docs:check`.

| # | File | Change | Status |
|---|---|---|---|
| A1 | [10](10-bug-fixes.md) | The header says four open items (F, J, K, L). K was fixed as 10b #197; say three. Item L's size is stale (80,553 bytes written, 82,243 today): drop the figure or date it | Done |
| A2 | [42](42-next-proposals.md) | E6 names "open bug items J and K": K is fixed, and its "slow simulation runs" is 10b #255 | Done |
| A3 | [27](../archive/roadmap/27-next-passes.md) | "Later" lists room state as `jsonb` as ready to pick up; it shipped (#417, #418) and 37 is archived. Pass B's note says tasks 1 and 4 are open in 11; both shipped in Pass C. Then archive 27: every pass in it is done, and this plan and [22](22-small-leftovers.md) hold what is left | Done; 27 archived |
| A4 | [12](12-new-content-backlog.md) | The Dragon item is unchecked and links to `#dragon-research-brief`, which is not in the file; the Dragon shipped in #402. Check it and point at archived 29 | Done |
| A5 | [41](41-room-chat.md) | The table says M3 is "Planned, after M1"; it shipped (`aa7e9f5`, `0d2e90e`). M4's commit reads "(this commit)" | Done |
| A6 | [34](34-balance-methodology.md) | Eight task rows give "this commit" for a SHA; fill them from `git log` | Done |
| A7 | [11](11-balance-and-mechanics.md) | Horn Gore is checked and done (10b #253) but still carries the old question and "needs a decision"; trim it to the outcome | Done |
| A8 | [46](../archive/roadmap/46-unicorn-theme.md), [roadmap index](README.md) | Reword per decision 5 | Done: shipped per the owner; 46 and 46b archived, the portraits question moved to 22 |
| A9 | [39](39-in-game-help.md), [42](42-next-proposals.md), [22](22-small-leftovers.md) | One home each for items listed twice: the long room name (39 and 42 E5), preset loading and prompt transport (22 and 27), the owner-decision list (22 and 27) | Done: archiving 27 removed the second copies; 42 E5 already points at 39 |
| A10 | `scripts/check-docs.mjs` | The checker passed with A4's broken anchor in place. Teach it to check in-page `#anchor` links, with a test | Done: the checker skipped every link starting with `#`; it now checks them, and accepts `<a id>` anchors |

## Pass B — proof first

Build the means to see the bugs before changing how the feed works. No behaviour change ships
in this pass. Where B5 finds a bug, it is recorded, not fixed here.

| # | Task | Area | Acceptance | Can run beside | Status | Commit |
|---|---|---|---|---|---|---|
| B1 | **The feed lab.** A dev route that mounts the real Ring and Console panes on a scripted transport: recorded `room_events` fixtures (a quiet room, a long two-monster fight, an eight-monster brawl with card frames, a boss arrival), played at real or fast pace, with a `window` hook to push a burst, pause, drop the connection, and switch theme | `apps/web` (a lab route, a fake tRPC link, fixtures) | The lab plays each fixture in all five themes with no server running; no lab code is in the production bundle unless decision 3 allows it | B3 | Done: `/lab` (a lazy chunk, no server, no sign-in) runs the real `Terminal` on a fake tRPC link; `window.__feedLab` plays, bursts, drops, stalls and delays; five fixtures recorded from real engine fights by `sim:record-feed` | 0090d05, and this commit\'s lab |
| B2 | **Scroll invariants in a real browser.** A Playwright suite over the lab: Chromium and WebKit, 390 × 844 and 1440 × 900, phosphor and Millefleur. The invariants are listed below | `apps/web/e2e`, root scripts | Every invariant is a named test that reports the measured pixels; the suite runs with one command | — (after B1) | Done: 106 scroll tests over both panes, both sizes, phosphor and Millefleur, plus a soak behind `E2E_SOAK=1`. WebKit runs only in CI | a22255d, 4d2ee56 |
| B3 | **Connection scenarios.** The real server and Postgres behind a proxy the test controls: a clean drop, a silent stall (no close), a slow link, a server restart, a page frozen and resumed, and offline then online. For each, record the time to notice, the time to the first frame after resume, and whether any event was lost or doubled | `apps/web/e2e`, a small proxy script | A table of timings per scenario; lost and doubled events are counted by id against `room_events` | B1 | Part done: 20 scenarios per project over the lab\'s transport on a fake clock. **Still open (B3b):** the same faults against the real server and tRPC\'s WebSocket client through a proxy, which the lab cannot show | 2d9615a |
| B4 | **Client timings.** One small module that counts and times what the reader feels: time to the first feed row, each reconnect phase, re-pins, corrections to `scrollTop`, list remounts. The lab reads them; a debug overlay shows them; decision 4 says whether they leave the browser | `apps/web/src/lib`, [observability](../operations/observability.md) | B2 and B3 assert on these counters rather than on screenshots | B1 | Done: `lib/feed-timings.ts`, `window.__feedTimings`, and an overlay behind `?feedTimings=1` | 1663438 |
| B5 | **Baseline and CI.** Run B2 and B3 against `main`. Write the results up, file each failing invariant in [10](10-bug-fixes.md), and add the suite to CI: reporting only at first, blocking per decision 6 | docs, `.github/workflows/ci.yml` | A baseline report under `docs/reference/`; CI shows the suite's result on every PR | — (after B2, B3) | Done: [baseline](../reference/feed-stability-baseline.md) (125 passed, 15 failed), failures filed as [10 M and N](10-bug-fixes.md), the lab documented in [feed lab](../reference/feed-lab.md), and a reporting-only CI job | this commit |

**Scroll invariants (B2).** Each has a pixel tolerance, set when the baseline is taken:

1. Following: after a burst settles, the last row's bottom is at the viewport's bottom. Checked
   after a plain burst, a burst of card frames, the roster gaining a row, the items panel
   appearing, a pane resize, and a tab switch away and back.
2. Reading back: after the reader scrolls up, the row at the top of the viewport does not move
   while events keep arriving, and `↓ Latest` shows.
3. Scrolling up through earlier fights never moves against the gesture. Wheel, touch and a
   scrollbar drag are each tested.
4. `↓ Latest` returns to the true bottom and following resumes. A slow drag back down to the
   bottom does the same.
5. A theme switch, a font load and a rotation keep the reader's place, or the bottom if they
   were following.
6. Opening a room shows the newest rows first, with no frame drawn at the oldest row.
7. A 30-minute scripted stream: the DOM node count and memory stay under a set bound, and no
   frame takes longer than a set bound while a fight scrolls.

Chromium and WebKit under Playwright are not an iPhone. One device check stays manual: the
list in [22](22-small-leftovers.md), run against the lab so it is the same script each time.

## Pass C — decide the architecture on evidence

Three spikes, each a prototype behind a switch in the lab, each judged by Pass B's suite and
timings against the baseline. The pass ends with a short decision record for the owner. The
question for each spike is the same: does it remove a class of bug, or only move it?

| # | Spike | The question | Status |
|---|---|---|---|
| C1 | **A plain list with a cap.** No virtual list: the newest N rows in the DOM, native scrolling, following done by one rule (if pinned, scroll to the end after the list changes size). No height guesses, no probe row, no remount on a theme change, no wait for a width | Does it pass every invariant in both engines? How large can N be on a mid-range phone before invariant 7 fails? This also answers 22's "profile long-running rooms" item | Done: see the result below |
| C2 | **One feed store for the room.** History, live events, deduplication, markers and the cursor in one store outside React; the Ring and the Console read from it | Does it remove the duplicated merge code, and can the merge be tested as plain functions over the recorded fixtures? | Decided: deferred |
| C3 | **The connection as a state machine.** Named states (connecting, live, suspect, reconnecting, offline) fed by socket events, frames, the watchdog, `online`, `offline`, `visibilitychange` and `pageshow`. On becoming visible it probes with a short timeout, not a fresh 50 seconds. Check what tRPC's own `keepAlive` and tracked-event resume can replace | How much do B3's times to notice and to resume drop, with no event lost or doubled? | Decided: fix in place, in Pass D |
| C4 | **Push or poll, per value.** For each polling query, decide whether a feed event should drive it | A table: each value, how it arrives today, its worst delay, and the proposed source | Done: the table is in the baseline |

### C1 result: the plain list (2026-11-11)

Built as `components/PlainFeedList.tsx`, behind a per-browser switch: add `?feed=plain` to any
room or lab URL (`?feed=virtuoso` goes back). The browser suite runs against it with
`E2E_FEED=plain`. Chromium, both sizes, phosphor and Millefleur:

| | Virtual list (today) | Plain list |
|---|---|---|
| Scroll tests failing, of 98 that run | 13 or 14 | 0 |
| Opening: frames drawn away from the bottom | 1 to 4, with the oldest rows on screen | 0 |
| `↓ Latest` | 8 to 10 px short, button still showing after 8 s | At the bottom in about 60 ms |
| Behind while following (20 events, 8× play, roster growing) | Up to 544, 1,171 and 1,760 px, for up to 0.45 s | 0 px in every sample |
| Theme switch while reading back | Lands on the first event | The row stays on screen |
| Touch walk up through a fight | Up to 7 of 34 drags jump about 20 px | No jump |
| Console, scroll up two lines | Pulled back down (desktop) | Stays |
| 936-event session at 20× | 6 to 12 rows in the DOM, longest frame 17 ms | 681 rows, longest frame 50 ms, none over 100 ms |
| Connection suite | 1 test fails (C5) | The same 1 |

How it follows, in full: while pinned, scroll to the end whenever the content or the viewport
changes size; the reader unpins only by moving up while no size has changed; reaching the end
pins again. One thing the first cut got wrong and the suite caught: a theme switch shrinks the
content, the browser lowers `scrollTop`, and that scroll event arrives a frame later looking
like the reader moving up. A reflow changes a size and a reader does not, and that is now the
test.

What it removes once it is the only list: `utils/feed-row-height.ts` and its probe row, the
remount on a theme change, the wait for a measured width, `useFeedAutoScroll`'s intent window
and settle timer, and ten test files that stub the virtual list.

**The cost, measured.** Chromium at 390 × 844 with the CPU throttled, a 500-row Ring:

| | Virtual list | Plain list |
|---|---|---|
| Tap on the Ring tab to rows at the bottom, 4× slower CPU | 0.29 to 0.34 s | 0.43 to 0.58 s |
| The same, 6× slower | 0.35 to 0.48 s | 0.64 to 0.75 s |
| Longest frame while playing at 8×, 4× slower | 83 ms | 50 to 100 ms |
| The same, 6× slower | 83 ms, 9 frames over 50 ms | 67 to 150 ms, 11 to 43 over 50 ms |

The plain list is slower to open, by 0.15 to 0.3 s on a slow phone, and about level while a
fight plays. Drawing all 500 rows at once was about twice as slow to open, so the first paint
is the newest 24 rows and older rows are added above in idle slices; the frames over 50 ms at
6× are those slices, in the first second after opening. That is the trade: a slightly slower
open for a feed that is always where it should be.

**Not yet known.** WebKit and a real iPhone (CI runs WebKit once there is a PR; the device
check is the owner's, with `?feed=plain` on a real room). The Console re-renders every row
when the pane renders, which is fine at a few hundred rows and should be narrowed before it is
the default.

### Decision (orchestrator, 2026-11-11; the owner delegated these)

- **Feed list: the plain list.** It removes the class of bug, not one instance. It stays behind
  the switch until WebKit passes in CI and the owner has tried it on a phone; then it becomes
  the default and the virtual list and its guesses are deleted (Pass D).
- **The other virtual list (TanStack Virtual): not pursued.** It has the same unknown-height
  problem, and C1 did not fail on performance.
- **C2, one feed store: deferred, not needed for stability.** The baseline found nothing lost,
  doubled or reordered in any scenario, so the duplicated merge code is a tidiness cost, not a
  bug source. Revisit after the virtual list is gone, when the panes are smaller.
- **C3, the connection: fix in place, not a rewrite.** The failures are a slow detector and a
  double subscribe, both inside `useRingFeed`. Built as Pass D's first task with the
  connection suite as its test.
- **C4, push or poll:** the table is in the
  [baseline](../reference/feed-stability-baseline.md#read-from-the-code-not-measured). Stop the
  history refetch now (Pass D). Give the Fights and Leaders pages the feed, and replace the
  shop, item and charge polls, as one later task.

## Pass D — build what C decides

| # | Task | Status | Commit |
|---|---|---|---|
| D1 | **The connection.** One subscription per page load; an 8 s heartbeat and a 20 s watchdog; a test of the connection when the page becomes visible or comes online; the banner when offline; backoff on failed resubscribes; dividers only for outages a reader lived through; no history refetch on focus; a loading line in the Console; tRPC's socket keep-alive | Done. Reviewed; fix round in (stale cached history, chat and the cursor, transport reconnects, pong wait). Connection suite 44 of 44 on both lists | 6fd862d, 68b8c0b |
| D2 | **The plain list as the default.** Needs WebKit green in CI and the owner's phone check with `?feed=plain`. Narrow the Console's row re-render first | WebKit is green: CI run on d9e31ab, plain list on WebKit phone and desktop, 142 passed, 0 failed (the virtual list failed 23 across the four projects, all scroll). The owner's phone check (2026-11-11) found `↓ Latest` stopping short; fixed as 10b #269, to be checked on the phone again | |
| D3 | **Delete the virtual list:** `react-virtuoso`, `utils/feed-row-height.ts` and its probe, `useFeedAutoScroll`, the metrics remount, and the ten tests that stub the list. Rewrite the feed sections of [web workspace](../architecture/web-workspace.md) | After D2 | |
| D4 | **B3b:** the connection faults against the real server and tRPC's WebSocket client through a proxy (CI has Postgres). The review of D1 named what only this can test: the socket keep-alive after a freeze, and both reconnect paths firing at once | Planned | |
| D5 | **Push, not poll:** the feed on the Fights and Leaders pages; events for the shop, the in-fight item list and summon charges; slimmer feed frames (some are 12 to 75 KB) | Planned | |

## Pass E — the next features

Each is its own PR and its own plan when it starts. The source file keeps the design.

| # | Work | Source | Size | Notes |
|---|---|---|---|---|
| E1 | Loading a preset can take cards from your other monsters | [22, Workshop](22-small-leftovers.md#workshop) | **Done** (f42edd4 and its fix round) | Built, independently reviewed (no blockers), fix round in. Leftovers are in 22 |
| E2 | Counter cards: Lullaby and Mirror Shield | [12, Dragon follow-ups](12-new-content-backlog.md#dragon-follow-ups) | One content PR | The owner's pick for the next content PR. Neither exists in the code. Needs `sim:monster` evidence |
| E3 | Small fixes: `help <word>` matching inside other words, chat metrics, the long room name on a phone | [42 E](42-next-proposals.md#e-seen-in-recent-sessions) | A line or two each | E3's first item was not re-checked against the code; check before briefing |
| E4 | Balance Layer 1 (task 5), with 8a beside it | [34](34-balance-methodology.md) | Its own PR B and C | Measurement only. Runs under 34's plan, not this one |
| E5 | The Discord connector re-subscribing to a replaced room | [10 J](10-bug-fixes.md) | One task | A real gap (`bot.ts` caches subscriptions and nothing tells it a room was replaced), but no connector is deployed. Take it before a deploy |

## Process rules being tried

- **A failing lab scenario before a UI fix.** A feed, scroll or connection bug gets a scenario
  that fails first, the way an engine bug gets a failing test. "Fixed in code; unconfirmed"
  stops being a status.
- **Numbers, not impressions.** A change to the feed or the transport quotes the invariant
  results and timings before and after in its PR.
- **The suite is part of the gate** for anything under `apps/web` that touches a feed, the
  transport, or a theme's feed type, once B5 lands. Add it to
  [working in this repo](../agents/working-in-this-repo.md) then.
- **No behaviour change in a proof pass.** Pass B changes nothing a player can see. That keeps
  the baseline honest.
- The usual rules hold: four or five tasks to a PR, a checkpoint commit per task with this
  file updated in it, an independent read-only review of every code diff, and a live re-check
  after any change to timing or UI ([subagents](../agents/subagents.md)).

## Done when

- The roadmap files agree with the code (Pass A).
- A feed or connection regression fails a named test in CI before a player sees it (Pass B).
- The feed and reconnect design is a recorded decision with measurements behind it (Pass C),
  and is built (Pass D).
- This plan's decisions are folded into the architecture docs and the plan is archived.
