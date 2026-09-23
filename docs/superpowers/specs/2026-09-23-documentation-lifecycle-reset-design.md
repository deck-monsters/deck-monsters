---
type: Design
title: Documentation lifecycle reset
description: Approved design for separating current docs, active work, and history.
status: draft
audience: internal
tags: [documentation, design, lifecycle]
---
# Documentation lifecycle reset

**Status:** Approved design; implementation not started
**Scope:** Repository documentation, documentation governance, generated player guidance,
and the temporary-stat combat semantics uncovered while validating that guidance

## Goal

Make the active documentation small, current, and easy to route into: current behavior has
one canonical home, the roadmap contains only actionable work, completed artifacts survive
only when their reasoning remains useful, and player guidance is generated from verified
engine behavior rather than accumulated folklore.

The repository's existing paths and numbering are not constraints. Links and code comments
may be updated when a better information architecture warrants moving a document. Git is
the history for redundant implementation plans and reports.

## Principles

1. **Lifecycle is visible from the path.** Current contracts, active work, and historical
   records do not share a directory.
2. **One fact has one canonical home.** Other documents link to it instead of paraphrasing
   volatile details.
3. **Transform before deleting.** A completed artifact is mined for current contracts,
   reusable procedures, player rules, and unique rationale. Redundant chronology is then
   deleted.
4. **Routes stay short.** `AGENTS.md` tells agents what to read and when; it does not repeat
   the referenced material.
5. **Player advice is evidence-backed.** Strategy guidance states its assumptions and is
   derived from engine behavior, generated odds, and tested rules.
6. **Archives are non-authoritative.** They explain how a decision was reached. Current
   code and current architecture documents win when history disagrees.

## Target information architecture

```text
AGENTS.md                         standing rules and trigger-based routing
README.md                         human-facing project entry point

docs/
  README.md                       documentation map and placement rules
  architecture/                   current subsystem contracts and invariants
  operations/                     setup, testing, deployment, and runbooks
  reference/                      authoring and protocol references
  agents/                         game primer and repository-working procedures
  roadmap/                        actionable work and a compact status index
  archive/
    README.md                     historical-document index and authority warning
    roadmap/                      shipped product plans worth retaining
    passes/                       retained multi-task pass records
    retired/                      retired subsystems
  superpowers/
    specs/                        active design specs only
    plans/                        active implementation plans only

.cursor/skills/
  maintaining-repository-docs/
    SKILL.md                      documentation lifecycle workflow
```

Generated and authored player references remain at the repository root where players
already find them. Their headers must identify their ownership and source:

- `PLAYER_HANDBOOK.md`, `MONSTERS.md`, `CARDS.md`, and `DMG.md` are generated.
- `ITEMS.md` is the authored player guide for item behavior and use.
- Generated catalogues describe facts; player strategy and rules live in the generated
  handbook or in a deliberately authored guide, not in roadmap history.

The exact architecture filenames will follow subsystem boundaries discovered during
extraction. At minimum, current contracts need homes for rooms/identity, events/replay,
the web workspace, workshop/items, analytics/history, and roster/pixel monsters.

## Roadmap reset

`docs/roadmap/README.md` remains the compact status entry point. The active roadmap may
contain only open work, decisions awaiting implementation, and a short fixed-bug ledger
pointer.

The migration will:

- archive shipped plans 20, 23, and 24 after extracting current contracts;
- carry their remaining real-device and preference-scope checks into one small leftovers
  list;
- transform plan 19 into a durable agency/game-design reference plus a short active item
  follow-up;
- reduce `10-bug-fixes.md` to open defects only and keep resolved root causes in the fixed
  ledger;
- keep 11 and 12 as active future work while separating shipped analysis from actionable
  proposals;
- move indefinitely deferred 07 and 08 out of the active roadmap;
- retire contradictory plan 09 after extracting any still-valid principles; and
- remove completed one-off `docs/superpowers` plans and reports after confirming their
  conclusions have a current home.

The fixed-bug ledger may move if the resulting taxonomy is clearer. Any code, tests, and
documents that cite its old path must move with it. Stability is achieved through updated
references and routing, not by preserving an accidental path forever.

## Current-contract extraction

Agents should not need an archived implementation plan to understand a live subsystem.
The pass will extract the current facts that are now buried in completed plans:

- room lifecycle, membership, identity, display names, and connector mappings;
- event delivery, prompt lifecycle, persistence, replay, visibility, and cursors;
- terminal surfaces, pane slots, routes, breakpoints, mounting, and divider contracts;
- workshop inventory, items, card management, prompt-free mutations, and shop behavior;
- leaderboard, fight-summary, catch-up, and analytics projections; and
- roster ordering, payload ownership, pixel-monster rendering, appearance colors, and feed
  portraits.

Each new current document answers three questions: what the subsystem does, what depends on
it, and which constraints must survive changes. Historical alternatives and task-by-task
chronology remain in the archive only when they explain a decision that would otherwise be
re-litigated.

## `AGENTS.md` as router

`AGENTS.md` will retain:

- standing repository rules;
- non-negotiable shared-worktree and review constraints;
- a minimal bootstrap command pointer; and
- trigger-based “read before touching” entries for current documents and the documentation
  maintenance skill.

It will shed:

- duplicated project and engine tutorials;
- detailed Cloud/local setup walkthroughs;
- volatile test counts and open-bug summaries;
- connector implementation examples already owned by current architecture docs; and
- direct required-reading links to active or archived implementation plans.

The documentation rule will require the repository-local skill whenever a PR adds, changes,
moves, invalidates, or should update documentation. This includes code changes that alter
behavior contracts, generated references, operational procedures, roadmap status, or
durable findings even when no Markdown file was initially touched.

## Repository-local documentation skill

Create `.cursor/skills/maintaining-repository-docs/SKILL.md`.

Its frontmatter description names triggering conditions only. The body provides:

- a placement decision table;
- canonical-home and cross-link rules;
- active/completed/deferred/retired lifecycle transitions;
- transformation, archive, and deletion criteria;
- generated-document ownership and regeneration rules;
- a PR closeout checklist;
- common failure modes and red flags; and
- one concrete example that follows a feature from active plan through current contract,
  player documentation, fixed-bug record, and archive/delete decision.

The skill is developed with the `writing-skills` RED/GREEN/REFACTOR workflow:

1. Run pressure scenarios without the skill and record actual failures and
   rationalizations.
2. Write the smallest guidance that addresses those observed failures.
3. Micro-test behavior-shaping wording against a no-guidance control with at least five
   fresh samples per variant.
4. Rerun pressure scenarios with the skill, close new loopholes, and retain the resulting
   rationalization table and red flags.

## Player guidance

The existing player handbook already has example decks, but it does not teach enough of the
model needed to adapt them. Expand the generator source with a concise strategy section:

- the effects of DEX, STR, INT, AC, HP, and level;
- ordered deck rotation and why card position matters;
- damage, healing, control, reactive, targeting, and matchup card roles;
- stacking behavior such as multiple armed Delayed Hits;
- example upgrade paths by monster type and level; and
- matchup swaps such as Molasses before Forked Stick.

Examples state assumptions and alternatives rather than claiming a universal best deck.
Generated card odds may support comparisons, but the guide must distinguish average output
from control, targeting, survivability, and opponent-dependent value.

`CARDS.md` remains the generated catalogue. `PLAYER_HANDBOOK.md` owns learnable rules and
strategy. `DMG.md` owns detailed generated mechanics and formulas after operator/runbook
material is moved to current repository docs.

## Temporary-stat semantics defect

Validation of the proposed player guidance found a real engine inconsistency.

At level 3, a Minotaur has `dexModifier = +4` and `strModifier = +5`. In the live source
probe, Adrenaline Rush changed raw DEX from 9 to 10 and raw STR from 10 to 11, while Hit's
attack modifier remained +4 and damage modifier remained +5. Molasses lowered a target's
raw DEX and therefore Forked Stick's pin threshold, but did not lower that target's ordinary
melee accuracy.

The root cause is that temporary `setModifier('dex' | 'str' | 'int', amount)` writes
encounter stat deltas used by `getProp()`, while `getModifier()` reads base options, level,
and permanent modifiers only. Existing Ecdysis tests assert raw stats and therefore do not
cover the derived rolls players expect those stats to influence.

The chosen semantic contract is:

- temporary DEX, STR, and INT changes affect both the effective raw stat and rolls derived
  from that stat, exactly once;
- DEX influences DEX-targeting defenses, melee accuracy, and DEX saves;
- STR influences STR checks, melee damage, and STR-based pin/escape rolls;
- INT influences INT-targeting defenses, curse/psychic accuracy, healing, and INT damage;
- AC remains defense and melee-damage absorption without an offensive modifier; and
- Molasses still improves Forked Stick by reducing its DEX threshold, while also reducing
  DEX-derived outgoing accuracy as a player would expect.

Implementation will centralize effective-stat semantics rather than patch each card
consumer. Horn Gore's stale `encounterModifiers.dexModifier` write must be removed rather
than activated: its advertised horn bonus already comes from its dedicated threshold
modifier, and honoring both would double-count it.

The change is a gameplay rebalance. It requires failing tests for effective raw and derived
stats, Ecdysis/Adrenaline offense, Molasses/Forked Stick interaction, immobilization rolls,
and Horn Gore's observable bonus. Card odds, generated player documents, and the fixed-bug
record must be regenerated or updated in the same task.

## Automated documentation checks

Add a lightweight repository check that can run locally and in CI without external
services. It should validate:

- relative Markdown links and moved paths;
- generated root-document freshness;
- no completed plan remains under active `docs/superpowers`;
- no `AGENTS.md` required-reading route points to a temporary implementation plan; and
- active roadmap entries do not declare themselves shipped while remaining active without
  an explicit actionable remainder.

The check should enforce mechanical invariants only. Placement and transformation quality
remain judgment calls owned by the skill and review.

## Verification and review

Work is split into independently reviewable tasks with checkpoint commits and pushes:

1. documentation taxonomy and indices;
2. current-contract extraction and history pruning;
3. roadmap reset;
4. player-guide generation and temporary-stat semantics fix;
5. repository-local skill and documentation checks;
6. final link, generated-output, and repository verification.

Every code task receives failing tests before implementation, a task-scoped independent
review for specification and quality, and a fix/re-review round when needed. Mechanical
documentation moves may use cheaper agents, but extraction and final review require
architecture-level judgment.

The final gate is:

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm run build:docs
```

The generated-doc command must leave the working tree clean. The documentation checker,
focused combat-stat probes, and internal-link sweep run in addition to the repository gate.

## Success criteria

- An unfamiliar agent finds the current contract for every live subsystem without opening
  roadmap or archive history.
- `AGENTS.md` is a compact router whose triggers point to current canonical documents and
  the repository-local documentation skill.
- The active roadmap contains only actionable work.
- Completed temporary plans and reports no longer appear active.
- Every retained historical file is clearly non-authoritative and earns its place through
  useful rationale.
- Generated player documentation teaches the combat/deck model without overstating a
  universal best build.
- Temporary stat boosts and curses behave consistently across raw checks and derived rolls,
  with regenerated odds and regression tests.
- Automated checks catch broken links, stale generated output, and basic lifecycle drift.
