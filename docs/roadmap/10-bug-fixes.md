---
type: Roadmap
title: Bug Fixes and Code Quality
description: Open bug investigations that still need a fix or a confirmed root cause.
status: draft
audience: internal
tags: [bugs, roadmap, open]
---
# Bug Fixes and Code Quality

**Status:** Active — three open items. Fixed work and its root causes live only in
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

## Historical detail

The removed September incident diary was resolved work and duplicated
[`10b-bugs-fixed.md`](10b-bugs-fixed.md). Keep new investigations here only while they are
actionable; move a fixed item to the ledger with its root cause and test evidence.
