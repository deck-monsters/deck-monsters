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
the bottom without a callback can hide the recovery control. Not reproduced on 2026-09-28
against Test Room A, after the ring list started keeping its row heights (#196):

- Wheel up into history. The button stayed visible with the scroller about 2100px and
  3200px above the bottom.
- Collapse and expand the roster while parked there. The button stayed visible. The
  viewport height changed (686px to 732px and back) and `scrollTop` did not.
- Narrow the window under the 1024px breakpoint, which hides the ring pane, then select
  the Ring tab. The list came back pinned to the bottom (`gap` 0), so the button was
  correctly absent. Widening the window left it at the bottom.

No case showed the button hidden while the reader was actually away from the bottom.
The #159 re-pin still scrolls to the DOM `scrollHeight` when a resize shows the pane
without a fresh gesture.

Read [events, prompts, and replay](../architecture/events-prompts-and-replay.md).

### F. Odd spacing in some feed messages

**Owner:** Web feeds. Players reported extra blank lines and misaligned indentation in some
feed messages. The one confirmed instance, Delayed Hit narration that opened with a literal
`\n`, is fixed (#130), and a sweep of `cards/` found no other. Checked again on 2026-09-28
while scrolling Test Room A's ring history (239 events). A text scan flagged leading or
repeated newlines. The ones opened were the blank line `formatCard` puts before a frame,
and the turn banner, which is authored as `\n🎲  round N, turn N\n\n…` in
`announcements/nextTurn.ts` (#97, #101). No other mis-indented message turned up, so there
is still no new example to change the card block or the banner for.

Read [events, prompts, and replay](../architecture/events-prompts-and-replay.md).

## Historical detail

The removed September incident diary was resolved work and duplicated
[`10b-bugs-fixed.md`](10b-bugs-fixed.md). Keep new investigations here only while they are
actionable; move a fixed item to the ledger with its root cause and test evidence.
