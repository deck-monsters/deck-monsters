---
type: Roadmap
title: Bug Fixes and Code Quality
description: Open bug investigations that still need a fix or a confirmed root cause.
status: draft
audience: internal
tags: [bugs, roadmap, open]
---
# Bug Fixes and Code Quality

**Status:** Active — three open items (F, J, K). Fixed work and its root causes live only in
[`10b-bugs-fixed.md`](10b-bugs-fixed.md).

## Open items

### F. Indentation and spacing in feed messages

**Owner:** Web feeds. The owner's report is about layout, not pixels: where text sits on the
left (indentation) and the white space between events. The one confirmed instance, Delayed
Hit narration that opened with a literal `\n`, is fixed (#130). A scan of Test Room A's ring
history on 2026-09-28 found only the blank line `formatCard` puts before a frame and the
turn banner, authored as `\n🎲  round N, turn N\n\n…` in `announcements/nextTurn.ts`
(#97, #101).

First example (owner's phone screenshots, 2026-09-28): the Fights tab's "Events during this
fight" list for fight #42. The card box opens with two blank lines inside its panel before
the `=` border (the leading newline of `formatCard` plus the fence), and the list's numbers
(`2.`, `3.`) are clipped at the left edge while the card panel is indented past them.

- [ ] Reproduce in the fight log (`FightLogPanel.tsx`, `.fight-log-events`) at phone width.
- [ ] Decide one rule for a card box's leading blank lines and for the space between events,
  and apply it to the Ring feed and the fight log alike.
- [ ] Keep the list markers inside the box, or drop them if the log does not need numbers.

Read [events, prompts, and replay](../architecture/events-prompts-and-replay.md) and
[web workspace](../architecture/web-workspace.md).

### J. A reset leaves a running fight, open prompts and connector subscriptions behind

**Owner:** Server and connector. Found by the review of item G's fix (roadmap 40, 2026-09-30).
It was already true of every reset; item G's cross-process drop inherits it because it tears
a room down the same way.

A reset (and now a cross-process drop) detaches the room's subscribers and calls
`game.dispose()`. That leaves three things behind:
- A fight in progress keeps its timer chain; `unloadRoom` refuses to unload mid-fight for this
  reason, but a reset does not wait.
- A command waiting on an interactive prompt waits until the prompt times out.
- The Discord connector caches one `GuildRoomSubscription` per guild and room, bound to the
  old game's bus, so announcements stay silent until the connector restarts. (No connector is
  deployed today.)

- [ ] Stop a running fight's timers and cancel open prompts with `PromptCancelledError` when a
  room is torn down by a reset or a drop.
- [ ] Give the connector a way to hear that a room was replaced (a `RoomManager` listener) and
  re-subscribe.

### K. Some simulation runs take far longer than expected

**Owner:** Harness. Seen while fixing item I (2026-09-30): a 60-batch run of three bosses
printed nothing for 10 minutes, and a 4-batch run took over 120 s. Not investigated; it may be
a slow seed or a fight that never ends.

- [ ] Time each fight in a long run and look at the slowest seeds' logs.

## Historical detail

The removed September incident diary was resolved work and duplicated
[`10b-bugs-fixed.md`](10b-bugs-fixed.md). Keep new investigations here only while they are
actionable; move a fixed item to the ledger with its root cause and test evidence.
