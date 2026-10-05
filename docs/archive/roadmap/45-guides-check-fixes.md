---
type: Archive
title: Fixes from the guides and wizard check
description: A short pass for the four small findings of Cursor's live check of roadmap 44, folded into the PR that archives roadmaps 43 and 44.
status: deprecated
audience: internal
tags: [roadmap, shop, console, workshop, bosses]
---
# 45 — Fixes from the guides and wizard check

**Status:** Shipped and archived (2026-10-05), in the PR that also archived 43 and 44. Bugs 222 and 223 are in `10b-bugs-fixed.md`; the yes/no rule is in the [prompt-answer contract](../../reference/prompt-answer-contract.md). Nothing is left. Originally: Source: [42 J](../../roadmap/42-next-proposals.md#j-left-from-43-and-44-and-what-the-guides-check-found),
from the [guides and wizard check](../../reference/guides-wizard-check.md). The owner asked for
this as one PR with the archiving of 43 and 44, and then a pause.

## Decisions

- **Backlog triage (orchestrator, 2026-10-05):** nothing in `10-bug-fixes.md` is urgent. F is
  cosmetic, J (what a reset leaves behind) affects an owner-only, rare action, and K is the
  harness. They stay open.
- **Yes/no prompts get buttons.** A question whose choices are yes and no shows `Yes` and `No`
  buttons, like any other choice question.

## Tasks

| # | Task | Area | Can run beside | Status | Commit |
|---|---|---|---|---|---|
| L1 | **The Console's questions.** (1) The shop's card pick and Back Room pick print their `Choose one or more…` question twice, as a line and again above the buttons: show it once. (2) A yes/no question (the shop's confirm, the Sorting Hat) offers only `Cancel`: show `Yes` and `No` buttons. (3) The wizard shows a taken monster name's message twice, in the Workshop banner and under the suggestions: show it once, in the wizard | Web | L2 | Done. The doubled question came from a history line plus the open question after a remount; yes/no questions had no choices to draw. Review: equal Yes/No styling, yes/no never a multi-pick. Bug 223 | (this PR) |
| L2 | **The summon refusal.** With one monster in the ring, `summon a boss` answered `Every challenger in the ring already has a boss to face…`, and then a boss fight started. Find why (a timer boss arriving at the same moment, or a quota counting the wrong side) and make the refusal match the ring | Engine | L1 | Done. The refusal was right: a timer boss already filled the one-boss-per-challenger quota. It now names that boss when the player's monster is the only challenger; review narrowed it (two players, or the player's own summon, keep the general line). Bug 222 | 234b0b21, a1403853 |

## The text (orchestrator)

- Yes/no buttons: `Yes`, title `Answer yes`; `No`, title `Answer no`.
- L2: if a timer boss is already in the ring, keep the refusal but name it:
  `{boss} is already here for {monster}. Bring a friend into the ring, then summon another.`
  Anything else is a `DRAFT(45)` placeholder.

## Actionable remainder

- [x] L1 The Console's questions.
- [x] L2 The summon refusal.

Nothing is left here. The one live check still owed (press the shop's `Yes` button once) is tracked in [42 J](../../roadmap/42-next-proposals.md).
