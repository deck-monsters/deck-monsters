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

### M. Feed scrolling: what is left

**Owner:** Web feeds. The seven scroll failures the browser suite first measured (S1 to S7)
are fixed: the plain list is the default
([10b #271](10b-bugs-fixed.md#271-the-feed-scroll-failures-s1-to-s7--fixed)).

- [ ] **New text arrives as one block after another, not smoothly** (owner, 2026-11-12,
  after the iPhone check: "a bit on the choppy side", not a regression, track for later).
  A row appears whole and the list jumps to the end in the same frame. Ideas to try in the
  lab, each measured before it ships: ease the scroll to the end over about 150 ms when
  pinned (it must not bring back `↓ Latest` stopping short, 10b #269, so a new row
  mid-ease retargets); fade or slide a new row in; reveal a long card frame line by line.
  The baseline's "following lags" numbers are the measure to keep honest.
- [ ] **Plain list, flaky:** "console › history walk › 120 px steps through 2000 px
  [phosphor]" on `chromium-phone` fails about once in ten to fifteen
  runs: one touch drag moves the tracked row 8 px more or less than the finger. Seen on main
  (1 of 14) and after the `↓ Latest` hold (1 of 6), so the hold did not cause it. Not yet
  known whether it is the test's touch drag flinging or the list's row anchoring.
- [ ] **Plain list, flaky on WebKit:** "ring › history walk › 120 px steps through 4000 px
  while playing at 4x [phosphor]" on `webkit-phone` moved the tracked row 120 px, exactly one
  gesture (CI on #439 and again on #441, 2026-11-13; it passed on #438 and #440, so about one
  run in two on WebKit phone, which makes it the next thing to look at in M). A guess to check first, not a finding: a reader's
  scroll that lands in the same frame as a new row reads as a reflow, so
  `PlainFeedList.onScroll` puts the row back and the gesture is undone. If so it would show on
  a real phone as an occasional jump back while a fight is running.

- [ ] **Sending a command while reading back does not bring the Console to the end.**
  Found in review of D3 (2026-11-13); it was already so before, since the old list's
  `enable()` had no caller. A player who scrolled up, types a command and sends it does not
  see the answer arrive. Probably: on submit, jump to the end (`scrollToBottom`).
- [ ] **The prompt banner can miss a question hidden under an overlay.** The "a question is
  waiting" banner uses an `IntersectionObserver`, which counts the prompt row as visible
  when something drawn over it (the command dock on a phone) hides it. Pre-existing; found
  in the same review. Check on a phone before fixing.

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
- [ ] **A first subscribe with no cursor replays only the last 100 events** (Codex review of
  #436). If over 100 events this player can see arrive between the history fetch and the
  first handshake, the ones in between are lost with no gap line. Bounded today: the 20 s
  watchdog resubscribes with the history tail as its cursor, and fight pacing is about one
  event a second. If pacing ever allows that, the fix belongs on the server: the handshake
  carries the oldest replayed id so the pane can see a hole against its history tail.

### O. A deploy while someone is playing loses the ring

**Owner:** Server lifecycle. Seen in production on 2026-11-11, when #436 was merged during a
session (Railway logs, room `d6d69a2e`).

**Deferred by the owner (2026-11-12):** "confusing but rare", and with few players it does
not matter yet. Take it up when the player count grows, or before anything makes deploys
more frequent. Until then, avoid merging while someone has monsters in the ring.

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

### P. Repository and CI upkeep

**Owner:** Repository. Noticed while pushing and reading CI logs (2026-11-11 to 13).

- [ ] **Dependabot reports 98 vulnerabilities on `main`** (3 critical, 48 high, 38 moderate,
  9 low), printed by GitHub on every push. Not looked at. Triage which are in shipped code
  rather than dev tooling, and update or pin.
- [ ] **GitHub Actions warns that Node 20 actions are deprecated**: `actions/checkout@v4`,
  `actions/setup-node@v4`, `actions/upload-artifact@v4` and `pnpm/action-setup@v4` are being
  forced onto Node 24. Move to versions built for Node 24 before the forcing becomes failure.
- [ ] **The browser job is reporting only** (`continue-on-error`). Make it a required check
  once the flaky tests in M are fixed (roadmap 52, decision 6).
- [ ] **CI runner network flakes**: one run lost its apt mirror and another the artifact
  service. The browser job now has a 60 minute limit and a 15 minute install limit and
  skips its tests if the browsers did not install; nothing more to do unless it recurs.

### Q. Hold cards spend a rattle without rolling at disadvantage

**Owner:** Cards. Found by the Codex review of #441 (2026-11-13). Dissonant Voice's rattle
waits for the rattled monster's next card that has an attack roll (`getAttackRoll`) and
spends itself there, adding disadvantage through the roll-mode helper. But a hold's contest
(`ImmobilizeCard.immobilizeCheck`, Forked Stick, Coil, Horn Gore, Sticketh and the rest)
rolls through `getImmobilizeRoll`, which the helper does not wrap. So a rattled monster that
plays a hold loses the rattle and rolls one die; a hold aimed at a pinned monster also gets
no advantage. Lullaby was fixed in #441 by routing its contest through `rollWithModes`.

- [ ] Decide whether every hold's contest should honour roll modes (rattle and pin), then
  either wrap `getImmobilizeRoll` in `roll-mode.ts` `install()` as `getAttackRoll` is, or
  stop a hold from spending the rattle. Either changes balance a little for every hold: check
  with `sim:monster` before shipping.

## Historical detail

The removed September incident diary was resolved work and duplicated
[`10b-bugs-fixed.md`](10b-bugs-fixed.md). Keep new investigations here only while they are
actionable; move a fixed item to the ledger with its root cause and test evidence.
