# Documentation Lifecycle Reset

**Status:** Active — design approved; implementation planned

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

## Tasks

| # | Task | Owner tier | Status | Commit |
|---|---|---|---|---|
| 1 | Mechanical documentation checker | Tier 2 | Complete | Pending checkpoint |
| 2 | Current taxonomy and live-contract extraction | Tier 3 | Planned | — |
| 3 | Roadmap and archive lifecycle reset | Tier 2 | Planned | — |
| 4 | Temporary-stat semantics and generated player strategy | Tier 2 | Planned | — |
| 5 | TDD-tested documentation-maintenance skill | Tier 3 | Planned | — |
| 6 | Compact routers and generated ownership | Tier 2 | Planned | — |
| 7 | Full verification, broad review, and lifecycle closeout | Tier 3 | Planned | — |

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
