---
type: Roadmap
title: Bug Fixes and Code Quality
description: Open bug investigations that still need a fix or a confirmed root cause.
status: draft
audience: internal
tags: [bugs, roadmap, open]
---
# Bug Fixes and Code Quality

**Status:** Active — five open items (F, J, L, M, N). M and N are the failures the browser
suite measured, each with a failing test. K (emoji card-box borders) is 10b #197. Fixed work and its root causes live only in
[`10b-bugs-fixed.md`](10b-bugs-fixed.md).
The Millefleur spacing cleanup (Chat grid, shop wallet, selected name and turn markers) is
fixed as #241; it leaves the open investigations below unchanged.

## Open items

### F. Indentation and spacing in feed messages

**Owner:** Web feeds. The fight log's part is fixed: it drew `<type> — <text>` with the text cut
at 200 characters, so a card box arrived as blank lines and half a frame (10b #252); it now
uses the Ring feed's renderer. Earlier instances were #97, #101 and #130.

- [ ] Look at the Fights tab's play-by-play on a phone (390 × 844) in both themes, and at the
  Ring feed's spacing between events, and record anything still off.

### J. A replaced room leaves a connector subscription behind

**Owner:** Connector. Found by the review of item G's fix (roadmap 40, 2026-09-30). A reset or
a cross-process drop now stops the old game's fight, cancels its prompts and refuses its saves
(10b #251). What is left: the Discord connector caches one `GuildRoomSubscription` per guild
and room, bound to the old game's bus, so announcements stay silent until the connector
restarts. No connector is deployed today.

- [ ] Give the connector a way to hear that a room was replaced (a `RoomManager` listener) and
  re-subscribe.

### L. Millefleur stylesheet condensation

**Owner:** Web themes. Found in roadmap 46's branch review (2026-10-06). The size
decision below is from the owner the same day.

**Root cause:** successive surface/mock-fidelity passes appended overrides to the lazy
stylesheet without rechecking the original source-size budget. The source was
80,553 bytes on 2026-10-06 (82,243 on 2026-11-10), against roadmap 46 §8's 12 KB unminified limit; the roadmap's 10.6 KB claim
was from task 2. Duplicate-looking rules are often load-bearing, so a sweep that deletes
them can change a screen without a test noticing.

**Decided (2026-10-06):** that size is not a ship gate. Millefleur's stylesheet, Nunito,
and the watercolour assets are already a lazy chunk, so a player who stays on phosphor
never downloads them. Production now caches hashed `assets/` for a year and revalidates
`index.html` ([deployment](../operations/deployment.md#2b-service-web-static-spa)). The
Fast-3G run and fight-scroll frame timings from §7 were never recorded; they are not
required to ship this theme.

- [ ] Condense duplicate rules in `theme-millefleur.css` in a careful pass, checked
  screen by screen at 390 and 1440 on Millefleur and on phosphor. Do not treat the old
  12 KB figure as the target, and do not restyle the dark themes.

### M. Scrolling failures the browser suite measures

**Owner:** Web feeds. Found by the first run of the browser suite (2026-11-11). Numbers and
the tests are in the [feed stability baseline](../reference/feed-stability-baseline.md); each
item is a failing test in `apps/web/e2e/scroll.spec.ts`. Roadmap 52's Pass C decides whether
these are fixed one by one or by replacing the virtual list, so do not patch one alone before
that decision.

- [ ] S1. Opening a room draws the oldest rows first, then jumps to the bottom.
- [ ] S2. `↓ Latest` on the Ring stops 8 to 10 px short and stays on screen.
- [ ] S3. Switching from phosphor to Millefleur while reading back lands on the first event.
- [ ] S4. Rotating a phone on Millefleur while reading back loses the row (flaky).
- [ ] S5. On the desktop Console, scrolling up two lines is pulled back down by the next event.
- [ ] S6. Touch-scrolling up through a fight jumps about 20 px on some drags.
- [ ] S7. After a resize the Ring can sit 19 px short of the bottom (flaky).
- [ ] Following lags by hundreds of pixels for up to 0.45 s while events arrive, worst when
  the roster grows. It ends pinned, so no test fails; the numbers are in the baseline.

### N. Connection failures the browser suite measures

**Owner:** Web feeds and transport. Same source; tests in `apps/web/e2e/connection.spec.ts`.
Only C5 fails a test today. The others are measured and slow, and get an expectation when the
connection work in roadmap 52 sets the target.

- [ ] C1. A silently dead connection shows nothing for 31 to 49 seconds.
- [ ] C2. Becoming visible with a dead connection waits a further 50 seconds.
- [ ] C3. The browser's `offline` and `online` events are ignored.
- [ ] C4. Every page load subscribes twice and draws a "reconnected" line with no loss.
- [ ] C5. A quiet room shows "reconnected" with no "connection lost" before it.
- [ ] C6. A failed resubscribe retries at once with no backoff.
- [ ] C7. On a slow link the Console shows its empty hint while history is loading.
- [ ] History is refetched on every window focus and discarded; some feed frames are 12 to
  75 KB. Both read from the code (baseline, "Read from the code").

## Historical detail

The removed September incident diary was resolved work and duplicated
[`10b-bugs-fixed.md`](10b-bugs-fixed.md). Keep new investigations here only while they are
actionable; move a fixed item to the ledger with its root cause and test evidence.
