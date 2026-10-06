---
type: Roadmap
title: Millefleur live check
description: Cursor's live browser check of the Millefleur feed renderer and the screens in roadmap 46.
status: draft
audience: internal
tags: [roadmap, theme, millefleur, web]
---

# 46b — Millefleur live check (Cursor)

**Done.** Task 8's feed renderer was checked live, and the screens in
[roadmap 46 §7](46-unicorn-theme.md) were visited in all five themes at 390 and 1440.
Two feed bugs were fixed (235, 236). Task 9 (flavour) was left for later in this
check. Those lines, including the reviewed entrance drafts, are now in the Ring;
the shots below predate that copy. No pull request: the owner wants the whole theme
in one.

**Fixed.** A bloodied HP line painted "has -4HP., bloodied" (the clause sat after the
period). A threshold line painted "is now bloodied" and ", bloodied" on the same
sentence. Both are web-only; the engine's `text` is unchanged.

**Open for the owner.** Flavour lines are in the feed now, as an extra narration
sentence after the call or the house arrival. The boss card is still the engine's
card. The Millefleur roll is one dim sentence ("rolled 9 +1 = 10 vs 8 ·
hit"), not the mock's quieter second line under the play. Dark themes no longer draw
ASCII `=` rules inside a card; the frame is a title, a CSS rule and the body, and
lines are separated by the CSS gap. Colours and chrome otherwise match each dark
theme. This check did not boot `main` beside them. Task 3d's backports have since
been reviewed; the level badge stays withheld. The level-up sheet opened from the XP bar at 4/28; a real level-up was not
reached. Do not archive roadmap 46 until task 9 lands.

Shots below live in `docs/roadmap/46b-shots/`. Widths are CSS pixels. Phosphor is the
theme with no `data-theme` attribute.

## Task 8 — the feed

Fresh fights on the rebuilt engine. Older stored events were not the sample.

| Item | Result | Where | Shot |
|---|---|---|---|
| Scroll up in 300px steps, no jump toward newer events | pass | Millefleur, Ring, 390×844. 52 steps, ended at the top | [scroll-mf-390-top.png](46b-shots/scroll-mf-390-top.png) |
| Same | pass | phosphor, Ring, 390×844. 59 steps | [scroll-phosphor-390.png](46b-shots/scroll-phosphor-390.png) |
| Same | pass | phosphor, Ring, 1440×900. 48 steps | [scroll-phosphor-1440.png](46b-shots/scroll-phosphor-1440.png) |
| Follow the bottom during a live fight | pass | Millefleur, Ring pane (`#pane-ring`), 390×844. 130 samples while the list grew; 127 stayed within 1px. Three single samples reached as far as 512px and the pin came back. The end of the sample is the live turn | [pin-during.png](46b-shots/pin-during.png) |
| Theme switch while scrolled up keeps the passage | pass | Millefleur to phosphor, Ring, 390×844, mid-history. Same "Delayed Hit" passage; height changed because terminal lines are not composed | [mid-before.png](46b-shots/mid-before.png), [mid-after.png](46b-shots/mid-after.png) |
| Theme switch while following the bottom does not flash the start of history | pass | phosphor to amber, Ring, 390×844. The tail stayed the end of the fight | [scroll-switch-bottom.png](46b-shots/scroll-switch-bottom.png) |
| Bloodied clause inside the sentence | pass, after bug 235 | Millefleur, Ring, 390×940. "Quoloth has -4HP, bloodied." | [bloodied-fixed.png](46b-shots/bloodied-fixed.png) |
| Threshold line does not say bloodied twice | pass, after bug 236 | Millefleur, Ring, 390×844. "is now bloodied. Quoloth has only 17HP." A later line still reads "has only 16HP, bloodied." | [bloodied-once.png](46b-shots/bloodied-once.png) |
| Composed Ring beside the mock | pass on structure | Millefleur, Ring, 390×940, next to [samples/ring.jpg](../reference/millefleur/samples/ring.jpg). Divider, "plays", card frame, standing line with rose "bloodied" | [ring-940-composed.png](46b-shots/ring-940-composed.png) |
| Recorded dark-theme appearances | pass on appearance, with the feed-frame note above | phosphor, amber, ember, street-fighter, Ring, 390 and 1440. Green, amber, red, and yellow-on-navy. Engine sentences, not Millefleur's composed ones | [ring-phosphor-390.png](46b-shots/ring-phosphor-390.png), [ring-amber-390.png](46b-shots/ring-amber-390.png), [ring-ember-390.png](46b-shots/ring-ember-390.png), [ring-street-fighter-390.png](46b-shots/ring-street-fighter-390.png), [ring-phosphor-1440.png](46b-shots/ring-phosphor-1440.png) |

## Task 6 — screens

Each row was opened in phosphor, amber, ember, street-fighter and Millefleur, at 390×844
and 1440×900, unless the note says otherwise. Millefleur is the one compared with the
samples. Dark themes kept their own chrome.

| Screen | Result | Note | Shot |
|---|---|---|---|
| Ring, mid-fight, with a boss | pass | Mabo vs Quoloth. Millefleur composes; the dark themes do not. A reload plants `YOU JOINED HERE` in the history you are reading | [ring-millefleur-390.png](46b-shots/ring-millefleur-390.png) |
| Console, prompt open | pass | `edit character` asks which field. `edit Quoloth` is not a command | [prompt-millefleur-390.png](46b-shots/prompt-millefleur-390.png) |
| Workshop, three monsters | pass | Quoloth, lawe the Jinn, Twinkle the Unicorn. At 1440 the three cards sit in a row. At 390 the next card peeks in from the right | [workshop3-millefleur-1440.png](46b-shots/workshop3-millefleur-1440.png), [workshop3-phosphor-390.png](46b-shots/workshop3-phosphor-390.png) |
| Card detail sheet | pass | Hit, from the slot's ⓘ. Phone sheet, desktop dialog | [card-millefleur-390.png](46b-shots/card-millefleur-390.png) |
| Level-up sheet | pass | Opened from the XP bar at 4 of 28, so it is the preview of level 1, not a level just gained | [levelup-millefleur-390.png](46b-shots/levelup-millefleur-390.png) |
| Train wizard | pass | Step 1 of 5, Pick a type, and the Ready step. Cancel sits above the steps, not in the action row | [train-type-millefleur-390.png](46b-shots/train-type-millefleur-390.png) |
| Chat | pass | Empty state, ruled paper on Millefleur, plain dark log on phosphor. Composer anchored at the bottom | [chat-millefleur-390.png](46b-shots/chat-millefleur-390.png) |
| Help | pass | Help and guides, handbook, on the paper | [help-millefleur-390.png](46b-shots/help-millefleur-390.png) |
| Leaderboard | pass | This room, Ada, XP 1. Phone table scrolls sideways; desktop shows the win column | — |
| Account | pass | The account form took each theme. Shots are not in the repo (the page shows the sign-in address) | — |
| Fights | pass | Fight 1 listed on paper at both widths. The second fight was still in the ring during the first pass | — |
| High contrast | pass | `prefers-contrast: more`, Millefleur, 390. White page, black 2px edges, textures gone, radii kept | [contrast-ring-millefleur-390.png](46b-shots/contrast-ring-millefleur-390.png) |
| Reload, no dark first paint | pass | Millefleur, 390. At DOMContentLoaded the page background was `rgb(251, 248, 245)` and `color-scheme` was `light` | [reload-millefleur-390.png](46b-shots/reload-millefleur-390.png) |

Reading the mocks: the Ring matches the mock's structure (folder tabs, roster, composed
plays, rose boss card, round divider, bloodied in the standing line). It does not match
the mock's flavour or the two-line roll, on purpose until task 9. The phone ⓘ stays a
strip. The roster stays two lines.
