---
type: Roadmap
title: Item Follow-ups
description: Open item usability work for prompts, selling, and targeting feedback.
status: draft
audience: internal
tags: [items, roadmap, usability]
---
# Item Follow-ups

**Status:** Active backlog — bounded usability work, not a mandate for more combat control.
Read [player agency](../reference/player-agency.md) and
[workshop and items](../architecture/workshop-and-items.md) before changing an item flow.

- [ ] **Prompt transport.** Let an item that needs a choice, currently the Sorting Hat,
  complete on the web through an explicit interactive flow. Preserve the rule that awaited
  Workshop mutations never issue a prompt.
- [ ] **Web selling.** Expose room-scoped selling with confirmation and inventory/shop
  refresh behavior equivalent in safety to the established console flow.

Outcome feedback shipped in pass 25. The web Workshop now shows the engine's own narration
for an item use, including a targeting scroll's new strategy. The contract is in
[workshop and items](../architecture/workshop-and-items.md#outcome-narration-announcements).

These improve access to the existing bounded-item exception. Per-fight budgets, item-power
changes, and other balance changes wait for the simulation harness in
[balance and mechanics](11-balance-and-mechanics.md).
