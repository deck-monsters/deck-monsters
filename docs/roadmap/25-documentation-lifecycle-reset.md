---
type: Roadmap
title: Documentation Lifecycle Reset
description: Active pass record for separating current docs, roadmap work, and history.
status: draft
audience: internal
tags: [documentation, roadmap, lifecycle]
---
# Documentation Lifecycle Reset

**Status:** Active — in progress

This pass separates current contracts, active work, and useful history; compacts the
repository's documentation routers; improves generated player strategy guidance; fixes the
temporary-stat semantics defect found while validating that guidance; and adds a tested
repository-local documentation-maintenance skill.

## Binding decisions

- Existing folders, filenames, numbering, and code citations may change.
- Transform useful completed material into current architecture, operations, reference, or
  player documentation before deleting redundant artifacts.
- Git preserves implementation chronology; completed one-off plans and reports do not need
  a permanent documentation copy.
- `AGENTS.md` remains a compact trigger-based router.
- The active roadmap contains actionable work only.
- Temporary DEX/STR/INT changes affect both raw checks and derived rolls exactly once.
- Player strategy advice states assumptions and alternatives rather than declaring one
  universal best deck.
- Internal and agent Markdown (`AGENTS.md` and `docs/**`) carries Open Knowledge Format v0.2
  frontmatter. Public and generated player documents do not.

## Tasks

| # | Task | Owner tier | Status | Commit |
|---|---|---|---|---|
| 1 | Mechanical documentation checker | Tier 2 | Complete | `d9857313`–`e9dfec1e` |
| 2 | Current taxonomy and live-contract extraction | Tier 3 | Complete | `26c8750c`–`f9535761` |
| 3 | Roadmap and archive lifecycle reset | Tier 2 | Complete | `0b59ed90`–`3e1af399` |
| 3b | OKF frontmatter for internal and agent docs | Tier 2 | Complete | `3f41d866` |
| 4 | Temporary-stat semantics and generated player strategy | Tier 2 | Planned | — |
| 5 | TDD-tested documentation-maintenance skill | Tier 3 | Planned | — |
| 6 | Compact routers and generated ownership | Tier 2 | Planned | — |
| 7 | Full verification, broad review, and lifecycle closeout | Tier 3 | Planned | — |

## Task 2 decisions

- `docs/README.md` is the complete current-document router. Current contracts live in
  `architecture/`, verified procedures in `operations/`, and boundary conventions in
  `reference/`; active plans and archived history are not contract dependencies.
- Current room/identity, event/replay, web-workspace, Workshop/item, analytics/history, and
  Ring/pixel-monster behavior is extracted from code and the source plans. The room-scoping
  and concurrency contracts remain explicit hard constraints in `docs/architecture/`.
- Deployment owns the production environment-variable table, observability owns metrics
  variables, local testing alone owns reusable-room state, and Cloud setup no longer lives
  inline in `AGENTS.md`.
- Source and generated comments now route to current contracts. Generated root documents
  are rebuilt from generator source rather than hand-edited.

## Task 3 decisions

- Active roadmap files now contain only actionable bugs, balance, content, item, and
  bounded-leftover work. Player-agency rationale is current reference material; completed
  plan history is archived with an explicit authority warning.
- Every previously archived open checkbox has a current owner and roadmap home. Deferred
  mobile, Slack, and exploration work is a product decision, not an archive task queue.
- The fixed-bug ledger remains at its stable active-roadmap path, while the documentation
  checker no longer masks lifecycle findings with a migration allowlist.
- Review fixes: Discord display-name seeding, multi-instance display-name updates,
  unpopulated `notableCards`, flow-step indicators, prompt-context labels, and the tier-2
  reason-string review each have an owned checkbox in `22-small-leftovers.md`. Shipped
  prompt timeout, cancel, and first-run behavior in plan 06 is history. Crit ticks, fight
  threads, and the 60–90 coin healing-price constraint are owned checkboxes in
  `11-balance-and-mechanics.md`. The data-driven card spec and card-authoring skill are
  owned by Cards in `12-new-content-backlog.md`. Prompt transport, web selling, and outcome
  feedback stay only in `item-followups.md`. `look at the ring` private-announce delivery is
  ledger entry #174. No reviewed item was rejected.

## Task 3b decisions

- Governed files are `AGENTS.md` and `docs/**/*.md` only. Each block is Open Knowledge
  Format v0.2 at byte 0, with keys `type`, `title`, `description`, `status`, `audience`,
  and `tags`. `audience` is `internal`. `description` is one sentence without Markdown.
  `tags` lists 2–6 lowercase tags.
- `status` is `stable` for current docs, the roadmap index, and the fixed-bug ledger;
  `draft` for other active roadmap files and this pass's spec and plan; `deprecated` for
  `docs/archive/**`. `checkOkfFrontmatter` enforces that mapping. Link and roadmap-status
  checks strip the block first, and `docs/roadmap/10b-bugs-fixed.md` keeps its ledger
  exception. Implementation commit: `3f41d866`.

## Working artifacts

- [Approved design](../superpowers/specs/2026-09-23-documentation-lifecycle-reset-design.md)
- [Implementation plan](../superpowers/plans/2026-09-23-documentation-lifecycle-reset.md)

The working artifacts are deleted after this pass closes. This record moves to
`docs/archive/roadmap/` with the task SHAs and verification result.

## Process rules being exercised

- Checkpoint, push, and update this table after each reviewed task.
- Use lower-cost agents for mechanical moves and Tier 3 judgment for extraction and final
  review.
- Every code task starts with a failing test.
- Every task gets independent specification and quality review.
- Do not preserve prose merely because it already exists; preserve facts that future readers
  need in the place they will look for them.
