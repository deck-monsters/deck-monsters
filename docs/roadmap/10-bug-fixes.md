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

- [ ] Reproduce a complete real fight, including after room restore, and assert coin and XP
  balances. Test the room-scoped reward listener rather than invoking a handler directly.
- [ ] Fix the demonstrated failure and record its root cause in the fixed-bug ledger.

Read [rooms and identity](../architecture/rooms-and-identity.md) and
[analytics and history](../architecture/analytics-and-history.md) before changing the
listeners or reward projections.

### 2. Some cards emit two roll blocks in the same tick

**Owner:** Engine pacing. A card-level sequence can publish related roll blocks with no
sub-event gap. Capture representative cards, then decide whether a central minimum gap is
needed without making event publication unsafe or reordering narration.

Read [engine concurrency and timing](../architecture/engine-concurrency-and-timing.md).

### 3. The fight feed opens with a burst

**Owner:** Engine pacing. The fight banner, separator, and first-turn banner can publish in
one tick before normal pacing starts. Measure a real public event sequence before changing
the shared delay policy.

Read [engine concurrency and timing](../architecture/engine-concurrency-and-timing.md).

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

## Historical detail

The removed September incident diary was resolved work and duplicated
[`10b-bugs-fixed.md`](10b-bugs-fixed.md). Keep new investigations here only while they are
actionable; move a fixed item to the ledger with its root cause and test evidence.
