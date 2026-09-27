---
type: Roadmap
title: Bug Fixes and Code Quality
description: Open bug investigations that still need a fix or a confirmed root cause.
status: draft
audience: internal
tags: [bugs, roadmap, open]
---
# Bug Fixes and Code Quality

**Status:** Active — five open items. Fixed work and its root causes live only in
[`10b-bugs-fixed.md`](10b-bugs-fixed.md).

## Open items

### J. Fight rewards may never be credited

**Owner:** Engine event ownership and rewards. A player reported 2 wins and 9 losses with
zero coins, although the ring records outcomes separately from reward listeners. Coin and XP
awards share room-scoped `creature.*` listeners, so a rejected ownership check could lose both
without changing the win/loss record.

- [x] Reproduce a complete real fight, including after room restore, and assert coin and XP
  balances. Done in pass 25: `packages/engine/src/reward-crediting.test.ts` drives a real
  `ring.fight()` through `Game.getCharacter` and `sendMonsterToTheRing`, fresh, after
  `restoreGame`, and against a boss. Every case credits coins and XP. The same check against
  the compiled `dist/` engine under plain Node, the production runtime, also credits coins
  after a restore. The in-process reward path is sound.
- [ ] Find the production-only cause. The remaining hypotheses: a save lost to the ~30 s
  persistence debounce around a restart; connector identity drift (a Discord relink or a stale
  active-room mapping, so `contestant.character` is not the reporter's character); or an
  ownership-guard gap for a character or monster shape the tests do not build. Each needs
  production data: the reporter's room state blob and `room_events` for their fights.
- [ ] Fix the demonstrated failure and record its root cause in the fixed-bug ledger.

Test-runner note: under mocha + tsx, a module reached by static import and by dynamic
`import()` can load as two instances, each with its own `globalSemaphore`. A test that
restores a game must import consistently (see the comment in `reward-crediting.test.ts` and
`game.test.ts`). Plain Node on `dist/` does not split modules, so this is not the production bug.

Read [rooms and identity](../architecture/rooms-and-identity.md) and
[analytics and history](../architecture/analytics-and-history.md) before changing the
listeners or reward projections.

### A. Intermittent missing `↓ Latest` jump button

**Owner:** Web feeds. `isAtBottom` is edge-driven, so a path that moves the reader away from
the bottom without a callback can hide the recovery control. The trigger is not reproduced:
capture whether roster collapse, replay, reconnect, or animation causes it before selecting
a fix.

Read [events, prompts, and replay](../architecture/events-prompts-and-replay.md).

### F. Odd spacing in some feed messages

**Owner:** Web feeds. Players reported extra blank lines and misaligned indentation in some
feed messages. The one confirmed instance, Delayed Hit narration that opened with a literal
`\n`, is fixed (#130), and a sweep of `cards/` found no other. No further example has been
captured. Get a screenshot of a specific message before changing the card-display block or
the turn banner, the likeliest suspects given #97 and #101.

Read [events, prompts, and replay](../architecture/events-prompts-and-replay.md).

### K. Card-box right border drifts on rows with an emoji

**Owner:** Web feeds. Found by a browser check on PR #394 (September 2026). Card boxes are
counted as a 34-column frame in the engine and wrap correctly as stored text. In the web
feed, the right border steps in and out on rows whose title carries an emoji (`🦄`, and the
Gladiator's `💪` and `🗡`). The feed renders them with `white-space: pre-wrap` in a monospace
font where an emoji is wider than one column, so the frame's column count no longer matches.
Not specific to any card. Likely fixes: measure emoji as two columns when the engine pads
the frame, or render the frame's border in CSS rather than as characters. Capture a
screenshot in both themes and at phone width before choosing.

Read [pixel art](../reference/pixel-art.md) and [web workspace](../architecture/web-workspace.md).

### L. The ring feed jumps while scrolling up into earlier fights

**Owner:** Web feeds. Seen 2026-09-27 on Test Room A's Ring tab, with history already
loaded. The scroller is the ring `Virtuoso` (`.event-feed`), the list that holds earlier
fights. A script drove it upward in eight bursts — each burst six `scrollTop -= 400` steps
plus a wheel `deltaY` of -400 — and paused 1.8s after each burst.

| Sample | scrollTop | scrollHeight | Mounted rows |
|---|---:|---:|---:|
| Start | 15386 | 16145 | 7 |
| After burst 2 | 12950 | 21475 | 2 |
| After burst 3 | 13391 | 24317 | 7 |
| End | 10096 | 30625 | 8 |

`clientHeight` stayed 758. Between burst 2 and burst 3 the only input was upward, and
`scrollTop` still moved 441px back toward newer events while `scrollHeight` grew by 2842px.
Mounted rows had just collapsed to 2 and then returned. Every pause left `scrollTop` where
the burst ended. #159's re-pin scrolls the element to `scrollHeight` when Virtuoso reports
"not at bottom" without a recent upward gesture; that path did not run during the pauses.

**Cause:** `RingPane` gives Virtuoso no default item height. Narration rows are one or two
lines and card boxes are tall `<pre>` frames, so unmeasured rows are estimated short. As
the reader scrolls into history those rows mount, the estimate is replaced, and
`scrollHeight` nearly doubled across the probe (16145 → 30625). Virtuoso then corrects
`scrollTop` from its size tree. That correction can move the viewport against the gesture.
The same size-tree estimate is why #159 re-pins from the DOM `scrollHeight` instead of
`scrollToIndex('LAST')`; this bug is that correction firing while the reader is scrolling
up, away from the bottom.

The 15rem fight-log box (`.fight-log-events`) is a different scroller. It truncates lines
and does not load ring history.

- [ ] Reproduce with a human wheel and a touch drag, and confirm the correction is
  Virtuoso's size-tree anchor.
- [ ] Keep the viewport on the row the reader is looking at once a card box is measured.
  Leave the #159 follow rule as it is: a gesture inside
  `USER_SCROLL_INTENT_WINDOW_MS` must still suppress the re-pin.

Read [events, prompts, and replay](../architecture/events-prompts-and-replay.md) and
[web workspace](../architecture/web-workspace.md).

## Historical detail

The removed September incident diary was resolved work and duplicated
[`10b-bugs-fixed.md`](10b-bugs-fixed.md). Keep new investigations here only while they are
actionable; move a fixed item to the ledger with its root cause and test evidence.
