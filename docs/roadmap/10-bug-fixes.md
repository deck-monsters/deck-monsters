---
type: Roadmap
title: Bug Fixes and Code Quality
description: Open bug investigations that still need a fix or a confirmed root cause.
status: draft
audience: internal
tags: [bugs, roadmap, open]
---
# Bug Fixes and Code Quality

**Status:** Active — four open items (F, J, K, L). Fixed work and its root causes live only in
[`10b-bugs-fixed.md`](10b-bugs-fixed.md).
The Millefleur spacing cleanup (Chat grid, shop wallet, selected name and turn markers) is
fixed as #241; it leaves the four open investigations below unchanged.

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

### K. Some simulation runs take far longer than expected

**Owner:** Harness. Seen while fixing item I (2026-09-30): a 60-batch run of three bosses
printed nothing for 10 minutes, and a 4-batch run took over 120 s. Not investigated; it may be
a slow seed or a fight that never ends.

- [ ] Time each fight in a long run and look at the slowest seeds' logs.

### L. Millefleur stylesheet condensation

**Owner:** Web themes. Found in roadmap 46's branch review (2026-10-06). The size
decision below is from the owner the same day.

**Root cause:** successive surface/mock-fidelity passes appended overrides to the lazy
stylesheet without rechecking the original source-size budget. The final source is
80,553 bytes, against roadmap 46 §8's 12 KB unminified limit; the roadmap's 10.6 KB claim
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

## Historical detail

The removed September incident diary was resolved work and duplicated
[`10b-bugs-fixed.md`](10b-bugs-fixed.md). Keep new investigations here only while they are
actionable; move a fixed item to the ledger with its root cause and test evidence.
