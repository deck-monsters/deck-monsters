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

- [ ] **Plain list, flaky:** "console › history walk › 120 px steps through 2000 px
  [phosphor]" on `chromium-phone` with `E2E_FEED=plain` fails about once in ten to fifteen
  runs: one touch drag moves the tracked row 8 px more or less than the finger. Seen on main
  (1 of 14) and after the `↓ Latest` hold (1 of 6), so the hold did not cause it. Not yet
  known whether it is the test's touch drag flinging or the list's row anchoring.

### N. Connection: what the real-transport suite found and left

**Owner:** Web feeds and transport. The suite (`ring-feed-transport.pg.test.ts`,
[feed lab](../reference/feed-lab.md)) runs the real server and tRPC's real WebSocket client
through a fault proxy. Keep-alive, the transport's own reconnect, chat and the cursor, the
durable replay and its cap all hold. Left:

- [ ] **A burst of connections when both reconnect paths fire.** When the hook resubscribes
  inside the client's 2 s backoff, the client opened about 16 sockets in about 110 ms before
  settling. Nothing was lost. After a deploy every connected client would do it at once.
  Root cause not yet traced: each close appears to start another reconnect.
- [ ] **A silent network in a browser.** In Node, after the keep-alive calls `close()` on a
  silent peer the socket stays closing and the client does not reconnect until the network
  answers. Not measured in a browser; the hook's 20 s watchdog is the safety net there.
- [ ] **The React hook itself is not in the suite**, only what it does at the client level.
- [ ] `startRealServer` in the test harness mirrors the server assembly in `index.ts`; share
  it so the two cannot drift.
- [ ] Some feed frames are 12 to 75 KB (roadmap 52, D5).

### O. A deploy while someone is playing loses the ring

**Owner:** Server lifecycle. Seen in production on 2026-11-11, when #436 was merged during a
session (Railway logs, room `d6d69a2e`).

What happened, by the server log (UTC):

- 14:55:28 the old process puts Queen Elizabeth in the ring. 14:55:39 it summons a boss.
- 14:55:38 the new process is already listening. 14:55:42 a request reaches it and it loads
  the room from the database.
- 14:55:44 the old process gets `SIGTERM` and flushes the room, two seconds after the new one
  read it.

The player saw their monster and a boss enter, then no countdown, no roster and no fight.
Later bosses came and left with nobody to fight, so the new process did not have the
player's monster in its ring.

Root causes, two of them:

1. **The two processes overlap and nothing hands the room over.** The new one reads the
   room while the old one still owns newer state; the old one's shutdown flush then lands in
   a row nobody reads again, and the new one's next save overwrites it. Anything done in the
   overlap is lost: here a ring entry and a summon. The unload and reset guards
   (`pendingFlush`, the tombstone) hold within one process only
   ([rooms and identity](../architecture/rooms-and-identity.md)).
2. **A boss never survives a restart, and nothing says so.** `Game` saves only non-boss
   contestants ([boss encounters](../architecture/boss-encounters.md)). A player who summoned
   one is left waiting with no line in the feed, and may have spent a summon.

- [ ] Decide the handover. Options: (a) remove the overlap in Railway so the old process
  stops before the new one takes traffic, a few seconds of downtime per deploy; (b) save at
  once, not on the debounce, when a monster enters or leaves the ring, which narrows the
  window but does not close it; (c) a per-room owner lease in the database so a new process
  waits for the old one's flush. (a) is the cheapest and closes it; check what the web
  client shows for those seconds first.
- [ ] After a restart with monsters still in the ring, say what happened in the Ring feed
  ("The ring was rebuilt. Bosses left; your monster is still waiting."), and give back a
  summon whose boss was lost that way.
- [ ] Check whether the lost summon was charged in this case.

## Historical detail

The removed September incident diary was resolved work and duplicated
[`10b-bugs-fixed.md`](10b-bugs-fixed.md). Keep new investigations here only while they are
actionable; move a fixed item to the ledger with its root cause and test evidence.
