---
type: Roadmap
title: Fixes from the guides and wizard check
description: A short pass for the four small findings of Cursor's live check of roadmap 44, folded into the PR that archives roadmaps 43 and 44.
status: draft
audience: internal
tags: [roadmap, shop, console, workshop, bosses]
---
# 45 — Fixes from the guides and wizard check

**Status:** In progress (2026-10-05). Source: [42 J](42-next-proposals.md#j-left-from-43-and-44-and-what-the-guides-check-found),
from the [guides and wizard check](../reference/guides-wizard-check.md). The owner asked for
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
| L1 | **The Console's questions.** (1) The shop's card pick and Back Room pick print their `Choose one or more…` question twice, as a line and again above the buttons: show it once. (2) A yes/no question (the shop's confirm, the Sorting Hat) offers only `Cancel`: show `Yes` and `No` buttons. (3) The wizard shows a taken monster name's message twice, in the Workshop banner and under the suggestions: show it once, in the wizard | Web | L2 | Planned | |
| L2 | **The summon refusal.** With one monster in the ring, `summon a boss` answered `Every challenger in the ring already has a boss to face…`, and then a boss fight started. Find why (a timer boss arriving at the same moment, or a quota counting the wrong side) and make the refusal match the ring | Engine | L1 | Planned | |

## The text (orchestrator)

- Yes/no buttons: `Yes`, title `Answer yes`; `No`, title `Answer no`.
- L2: if a timer boss is already in the ring, keep the refusal but name it:
  `{boss} is already here for {monster}. Bring a friend into the ring, then summon another.`
  Anything else is a `DRAFT(45)` placeholder.

## Actionable remainder

- [ ] L1 The Console's questions.
- [ ] L2 The summon refusal.
