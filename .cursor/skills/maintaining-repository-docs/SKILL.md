---
name: maintaining-repository-docs
description: Use when a change adds, edits, moves, invalidates, or should update repository documentation, roadmap status, generated references, operational procedures, behavior contracts, or durable findings
---

# Maintaining repository docs

Current truth, active work, and history are different lifecycles. One fact has one home. Link to it. `docs/README.md` is the map.

## When to use

Any change that adds, edits, moves, or invalidates documentation. That includes a code change that should update a contract, generated reference, runbook, roadmap status, or durable finding. Read this before editing those files.

## When not to use

A wording fix that leaves every current contract and every router row true. Do not hand-edit generated `PLAYER_HANDBOOK.md`, `MONSTERS.md`, `CARDS.md`, or `DMG.md`.

## Placement

| Fact | Home |
|---|---|
| Current behavior | `docs/architecture/`, `docs/operations/`, or `docs/reference/` |
| Open work | `docs/roadmap/` |
| Fixed bug, with root cause | `docs/roadmap/10b-bugs-fixed.md` |
| Shipped plan | `docs/archive/` only after each leftover has an active home or an explicit non-goal |
| Player rules | generator source, then `pnpm run build:docs`; authored rules stay in `ITEMS.md` |

`AGENTS.md` routes. It does not collect feature rules, leftovers, or copies of contracts.

## Closeout

1. Inventory what the change makes true, still open, or historical.
2. Put each fact in the home above.
3. If two current documents disagree, keep the statement that matches the code and delete the other.
4. If a required-reading row points at `docs/roadmap/`, `docs/archive/`, or `docs/superpowers/`, retarget it at the current document. Do not paste that document into `AGENTS.md`.
5. A permanent product refusal is prose, not an open checkbox.
6. On `docs/**/*.md`, keep OKF frontmatter: `type`, `title`, `description`, `status` (`stable`, `draft`, or `deprecated`), `audience: internal`, and 2–6 tags. Do not add that block to `AGENTS.md` (it loads into every agent session and stays a plain router), `README.md`, `ITEMS.md`, or generated player docs.
7. Run `pnpm docs:check`.

## Example

A one-word docs PR also finds that the events doc allows 1-based prompt answers while `docs/reference/prompt-answer-contract.md` and the code require a 0-based index or the exact label, and `AGENTS.md` points at a plan. Fix the typo, delete the 1-based sentence, retarget the row at the reference, and run the checker in this change.

## Rationalizations

| Excuse | Do instead |
|---|---|
| "This PR is only the typo; the captain will reject more." | A false current contract is part of this change. |
| "The contradiction is pre-existing." | You found it on the contract you are already editing. Fix it here. |
| "AGENTS.md needs an RFC, and there is no time." | Retarget the one row. Do not copy the contract into the router. |

## Red flags

- Two current documents disagree about the same rule.
- `AGENTS.md` sends a current rule to a plan, the archive, or the roadmap.
- A shipped plan is the only copy of a live rule or an open leftover.
- A generated player file was edited by hand.
