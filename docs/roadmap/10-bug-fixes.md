---
type: Roadmap
title: Bug Fixes and Code Quality
description: Open bug investigations that still need a fix or a confirmed root cause.
status: draft
audience: internal
tags: [bugs, roadmap, open]
---
# Bug Fixes and Code Quality

**Status:** Active — one open item. Fixed work and its root causes live only in
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

## Historical detail

The removed September incident diary was resolved work and duplicated
[`10b-bugs-fixed.md`](10b-bugs-fixed.md). Keep new investigations here only while they are
actionable; move a fixed item to the ledger with its root cause and test evidence.
