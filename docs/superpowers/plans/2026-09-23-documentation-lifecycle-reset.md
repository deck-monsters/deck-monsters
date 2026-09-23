# Documentation Lifecycle Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace lifecycle-mixed documentation with a compact current-doc system, improve
generated player strategy guidance, correct temporary combat-stat semantics, and install a
tested repository-local documentation-maintenance skill.

**Architecture:** Current contracts live under audience-specific `docs/` directories,
active work alone lives in `docs/roadmap`, and retained history is explicitly
non-authoritative. A repository checker enforces mechanical lifecycle/link invariants while
the skill guides judgment. Combat-stat changes are centralized in the creature stat model so
every card consumes one effective-stat contract.

**Tech Stack:** Markdown, Node.js ESM + `node:test`, TypeScript, Mocha/Chai, pnpm/Turborepo,
Cursor repository skills.

## Global Constraints

- Preserve each useful fact once; transform useful completed-plan material before deleting
  redundant chronology.
- `AGENTS.md` remains a compact trigger-based router and retains all non-negotiable
  repository, subagent, room-scoping, review, commit, and push rules.
- Current architecture documents may not require readers to consult active or archived
  implementation plans.
- Active roadmap files contain only actionable work or an explicitly stable ledger.
- Generated player documents are changed through generator source and rebuilt, never
  hand-edited.
- Temporary DEX/STR/INT deltas affect both raw checks and derived rolls exactly once.
- All game state, APIs, events, and examples remain room-scoped.
- Player-facing wording follows `docs/voice-and-wording.md` until that file moves; all links
  are updated in the same task that moves a file.
- Each task receives an independent read-only specification/quality review before the next
  task begins.
- Shared-worktree implementers never create or switch branches, stage only files they
  changed, and never push.

---

### Task 1: Add the mechanical documentation checker

**Files:**
- Create: `scripts/check-docs.mjs`
- Create: `scripts/check-docs.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/roadmap/25-documentation-lifecycle-reset.md`

**Interfaces:**
- Produces: `pnpm docs:check`, a zero-dependency Node command that exits nonzero with
  path-specific diagnostics.
- Produces: exported pure functions `findMarkdownLinks`, `checkMarkdownLinks`,
  `checkAgentsRoutes`, `checkSuperpowersLifecycle`, and `checkRoadmapLifecycle`.
- Consumes: repository-relative paths and Markdown text; no network or GitHub API.

- [ ] **Step 1: Write failing checker tests**

Use `node:test` temporary directories. Cover these exact cases:

```js
test('reports a broken relative markdown link with source and target', async () => {
  const root = await fixture({
    'docs/a.md': '[missing](./missing.md)',
  })
  assert.deepEqual(await checkMarkdownLinks(root), [
    'docs/a.md: broken relative link ./missing.md',
  ])
})

test('accepts repository files, directories, headings, and external links', async () => {
  const root = await fixture({
    'AGENTS.md': [
      '[doc](docs/current.md#current-contract)',
      '[directory](docs/current/)',
      '[web](https://example.com)',
    ].join('\\n'),
    'docs/current.md': '# Current Contract',
    'docs/current/.keep': '',
  })
  assert.deepEqual(await checkMarkdownLinks(root), [])
})

test('rejects AGENTS routes to implementation-history plans', () => {
  assert.deepEqual(
    checkAgentsRoutes('[plan](docs/roadmap/20-workspace-layout.md)'),
    ['AGENTS.md: required-reading routes may not target roadmap/archive/superpowers plans'],
  )
})

test('rejects completed artifacts in active superpowers directories', () => {
  assert.deepEqual(
    checkSuperpowersLifecycle('docs/superpowers/plans/done.md', '**Status:** Done'),
    ['docs/superpowers/plans/done.md: completed artifact must be deleted or archived'],
  )
})

test('rejects shipped active roadmaps without an actionable remainder', () => {
  assert.deepEqual(
    checkRoadmapLifecycle('docs/roadmap/24-example.md', '**Status:** Shipped'),
    ['docs/roadmap/24-example.md: shipped plan has no actionable remainder'],
  )
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test scripts/check-docs.test.mjs`

Expected: FAIL because `scripts/check-docs.mjs` does not exist.

- [ ] **Step 3: Implement the checker**

Implement an ESM module that:

```js
export function findMarkdownLinks(markdown) {
  return [...markdown.matchAll(/!?(?:\\[[^\\]]*\\])\\(([^)\\s]+)(?:\\s+"[^"]*")?\\)/g)]
    .map(([, target]) => target)
}
```

Then:

- recursively inspect authored `*.md` files while skipping `.git`, `node_modules`, `dist`,
  and generated root outputs;
- ignore `http:`, `https:`, `mailto:`, and same-file `#anchor` links;
- resolve relative files/directories and validate heading fragments using GitHub-style
  lowercase hyphenated slugs;
- reject required-reading links in `AGENTS.md` whose targets contain `/roadmap/`,
  `/archive/roadmap/`, or `/superpowers/`;
- reject `Status: Done|Complete|Completed|Shipped` under active `docs/superpowers`;
- reject active roadmap files with a shipped/done status unless they contain an
  `## Actionable remainder` section with an unchecked task; and
- print one diagnostic per line and set `process.exitCode = 1` on findings.

Add scripts:

```json
"docs:check": "node scripts/check-docs.mjs",
"test:docs": "node --test scripts/check-docs.test.mjs"
```

Add `pnpm docs:check` to the CI test job after the engine build and before `pnpm run test`.

- [ ] **Step 4: Verify GREEN without imposing the future taxonomy prematurely**

Run: `node --test scripts/check-docs.test.mjs`

Expected: all checker unit tests pass.

Run: `pnpm docs:check`

Expected: current-repository lifecycle findings are printed. Record them in the task report;
temporarily allow only the exact known migration set through an exported
`MIGRATION_ALLOWLIST`, with a comment that Task 3 deletes the allowlist.

- [ ] **Step 5: Update the pass ledger**

Update `docs/roadmap/25-documentation-lifecycle-reset.md`: mark Task 1 complete, record this
commit SHA, and preserve its links to the active design and implementation plan.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-docs.mjs scripts/check-docs.test.mjs package.json \
  .github/workflows/ci.yml docs/roadmap/25-documentation-lifecycle-reset.md
git commit -m "test(docs): enforce documentation lifecycle invariants"
```

---

### Task 2: Establish current documentation and extract live contracts

**Files:**
- Create: `docs/README.md`
- Create: `docs/architecture/rooms-and-identity.md`
- Create: `docs/architecture/events-prompts-and-replay.md`
- Create: `docs/architecture/web-workspace.md`
- Create: `docs/architecture/workshop-and-items.md`
- Create: `docs/architecture/analytics-and-history.md`
- Create: `docs/architecture/ring-roster-and-pixel-monsters.md`
- Move: `docs/engine-concurrency-and-timing.md` → `docs/architecture/engine-concurrency-and-timing.md`
- Move: `docs/boss-encounters.md` → `docs/architecture/boss-encounters.md`
- Move: `docs/room-scoping.md` content into `docs/architecture/rooms-and-identity.md`
- Move: `docs/deployment.md` → `docs/operations/deployment.md`
- Move: `docs/observability.md` → `docs/operations/observability.md`
- Move: `docs/devcontainer-auth.md` → `docs/operations/devcontainer-auth.md`
- Move: `docs/local-testing-guidelines.md` → `docs/operations/local-testing.md`
- Create: `docs/operations/cloud-development.md`
- Move: `docs/voice-and-wording.md` → `docs/reference/voice-and-wording.md`
- Move: `docs/prompt-answer-contract.md` → `docs/reference/prompt-answer-contract.md`
- Move: `docs/pixel-art-animations-in-js.md` → `docs/reference/pixel-art.md`
- Fold and move: `docs/ring-roster-design.md` into
  `docs/architecture/ring-roster-and-pixel-monsters.md`
- Modify: all links to moved files
- Modify: `docs/roadmap/25-documentation-lifecycle-reset.md`

**Interfaces:**
- Produces: one complete current-doc index at `docs/README.md`.
- Produces: current contracts that are sufficient without roadmap/archive history.
- Consumes: current code plus useful facts from archived plans 02–06a, 13–18 and active
  plans 19, 20, 23, 24.

- [ ] **Step 1: Write the documentation map**

`docs/README.md` must define:

| Location | Content | Authority |
|---|---|---|
| `architecture/` | Current subsystem behavior, boundaries, invariants, and rationale | Current |
| `operations/` | Executable setup, deployment, testing, and incident procedures | Current, with verification date |
| `reference/` | Authoring/protocol conventions consulted at a boundary | Current |
| `agents/` | How agents work in this repository and the gameplay primer | Current |
| `roadmap/` | Open work and status only | Current planning |
| `archive/` | Historical reasoning; current docs/code win | Historical |
| `superpowers/` | Active specs/plans only | Temporary |

Add a trigger-oriented index for every current document and the rule “one fact, one
canonical home; link rather than restate.”

- [ ] **Step 2: Extract the six missing live contracts**

Each architecture document starts with `Status: Current` and `Read before:` metadata, then
contains only verified current behavior:

- `rooms-and-identity.md`: room scoping checklist plus RoomManager lifecycle, membership,
  invites/default mappings, room-local characters, profile/display-name boundaries, and
  private-event viewer scope.
- `events-prompts-and-replay.md`: GameEvent flow, persistence, visibility, prompt lifecycle,
  reconnect handshake/cursors, catch-up, and connector delivery; link to the narrower prompt
  answer and concurrency contracts.
- `web-workspace.md`: surface registry, two slots, routes, 1024px breakpoint, mounted/lazy
  behavior, room remounts, divider/DOM order, container-query requirement, and navigation
  reveal-vs-full-page boundary.
- `workshop-and-items.md`: inventory read model, item source/target semantics, prompt-free
  mutation rule, shop stock token, room-scoped invalidation, first-run character creation,
  and player-rule link to `ITEMS.md`.
- `analytics-and-history.md`: summary writer/subscribers, tables, room/global query scope,
  private reward projection, catch-up/history read paths, and known retention decisions.
- `ring-roster-and-pixel-monsters.md`: authoritative row order, payload/client trust,
  field priority, responsive tiers, acting/faint state, opt-out storage, appearance palette,
  known-monster room store, feed replacement boundaries, and visual verification rubric.

Do not copy task tables, commit diaries, old alternatives without lasting rationale, or
open work into these files.

- [ ] **Step 3: Move focused current references and operations**

Use `git mv` for focused current documents, update their metadata, and extract Cloud Agent
setup from `AGENTS.md` into `docs/operations/cloud-development.md`. Make deployment the
canonical production environment-variable table, observability own metrics variables, and
local testing the sole source for reusable-room state.

- [ ] **Step 4: Update every repository reference**

Run targeted searches for every old path and update Markdown, TypeScript comments/tests,
and generated-source strings. Do not hand-edit generated root outputs in this task.

- [ ] **Step 5: Verify**

Run:

```bash
node --test scripts/check-docs.test.mjs
pnpm docs:check
rg -n 'docs/(room-scoping|engine-concurrency-and-timing|boss-encounters|deployment|observability|devcontainer-auth|local-testing-guidelines|voice-and-wording|prompt-answer-contract|pixel-art-animations-in-js|ring-roster-design)\\.md' .
```

Expected: tests/check pass; the old-path search returns no authored references.

- [ ] **Step 6: Update the pass ledger and commit**

Mark Task 2 complete with its SHA and extracted-document decisions, then:

```bash
git add AGENTS.md README.md docs packages apps
git commit -m "docs: establish current documentation architecture"
```

---

### Task 3: Reset the roadmap and historical lifecycle

**Files:**
- Rewrite: `docs/roadmap/README.md`
- Rewrite: `docs/roadmap/10-bug-fixes.md`
- Rewrite: `docs/roadmap/11-balance-and-mechanics.md`
- Rewrite: `docs/roadmap/12-new-content-backlog.md`
- Rewrite: `docs/roadmap/22-small-leftovers.md`
- Move: `docs/roadmap/07-mobile-app.md` → `docs/archive/roadmap/07-mobile-app.md`
- Move: `docs/roadmap/08-modernize-slack-connector.md` →
  `docs/archive/roadmap/08-modernize-slack-connector.md`
- Move: `docs/roadmap/09-graphics.md` → `docs/archive/roadmap/09-graphics.md`
- Move: `docs/roadmap/19-player-agency-and-items.md` →
  `docs/archive/roadmap/19-player-agency-and-items.md`
- Move: `docs/roadmap/20-workspace-layout.md` →
  `docs/archive/roadmap/20-workspace-layout.md`
- Move: `docs/roadmap/23-pixel-fight-stage.md` →
  `docs/archive/roadmap/23-pixel-fight-stage.md`
- Move: `docs/roadmap/24-pixel-monsters-everywhere.md` →
  `docs/archive/roadmap/24-pixel-monsters-everywhere.md`
- Move: `docs/archive/roadmap/21-september-followups.md` →
  `docs/archive/passes/21-september-followups.md`
- Move: `docs/archive/exploration-system.md` →
  `docs/archive/retired/exploration-system.md`
- Create: `docs/reference/player-agency.md`
- Create: `docs/roadmap/item-followups.md`
- Rewrite: `docs/archive/README.md`
- Delete: obsolete completed files under `docs/superpowers/plans/` and the completed
  2026-09-19 spec; retain only this pass's active spec and plan
- Delete: `docs/roadmap/assets/pixel-monsters-2026-09/contact-sheet.entry.ts.txt`
- Modify: all affected links
- Modify: `scripts/check-docs.mjs`
- Modify: `docs/roadmap/25-documentation-lifecycle-reset.md`

**Interfaces:**
- Produces: an active roadmap with open bugs, balance work, content work, item follow-ups,
  leftovers, and this in-progress pass only.
- Produces: archives with local authority warnings and no uniquely open tasks.

- [ ] **Step 1: Preserve actionable leftovers**

Populate concise checkbox entries for:

- real iPhone/WebKit workspace and inline-sprite checks;
- account/device scope for display preferences;
- item-driven prompt transport, web selling, and item/targeting feedback;
- per-monster records, memorials, and earned titles;
- fight-summary retention and interrupted-fight signaling; and
- any still-open deferred decisions extracted from archived plans.

Every item names its owner area and links to a current contract, not to historical task
sections.

- [ ] **Step 2: Transform plan 19**

Create `docs/reference/player-agency.md` containing “commitment, then surrender,” the
bounded-item exception, autonomy/competence/relatedness framing, evidence caveats, and the
explicit prohibition on unbounded live combat control. Put only actionable item work in
`docs/roadmap/item-followups.md`. Archive the original plan as historical context.

- [ ] **Step 3: Prune active roadmap files**

- `10-bug-fixes.md`: retain only Bug J, pacing items 2/3, dead CSS item 6, and intermittent
  jump-button item A; resolved entries remain only in the fixed ledger.
- `11-balance-and-mechanics.md`: retain the simulation harness, telemetry, stat reform,
  initiative, crit-fail, card balance, progression, and team-XP work; summarize shipped
  September analysis with links to current docs/ledger.
- `12-new-content-backlog.md`: retain concrete content proposals; remove meta-proposals for
  skills already covered by this pass and compress repeated rationale.
- `README.md`: list only genuinely active/backlog work and a compact archive link.

- [ ] **Step 4: Archive/delete**

Add this banner to retained historical files:

```md
> Historical record. Current code and documents linked from `docs/README.md` are
> authoritative. Any remaining work has been copied to the active roadmap.
```

Delete one-off completed superpowers artifacts after checking their root causes exist in the
fixed-bug ledger/current docs. Remove broken local artifact links or replace them with prose
describing what the unavailable capture demonstrated.

- [ ] **Step 5: Remove the migration allowlist and verify**

Delete `MIGRATION_ALLOWLIST` from `scripts/check-docs.mjs`.

Run:

```bash
node --test scripts/check-docs.test.mjs
pnpm docs:check
rg -n '^\\*\\*Status\\*\\*:.*(Done|Complete|Shipped)' docs/roadmap
rg -n '\\[[ x]\\]' docs/archive
```

Expected: checker passes; only the in-progress pass/ledger has lifecycle metadata in the
active roadmap; archive checkboxes are clearly historical or absent, never the sole home of
open work.

- [ ] **Step 6: Update the pass ledger and commit**

```bash
git add docs scripts/check-docs.mjs
git commit -m "docs: reset roadmap and archive completed work"
```

---

### Task 4: Fix temporary stat semantics and improve generated player strategy

**Files:**
- Test: `packages/engine/src/creatures/stats.test.ts`
- Test: `packages/engine/src/cards/ecdysis.test.ts`
- Create test: `packages/engine/src/cards/molasses.test.ts`
- Test: `packages/engine/src/cards/forked-stick.test.ts`
- Test: `packages/engine/src/cards/horn-gore.test.ts`
- Modify: `packages/engine/src/creatures/stats.ts`
- Modify: `packages/engine/src/cards/horn-gore.ts`
- Modify: `packages/engine/src/build/player-handbook-content.ts`
- Modify: `packages/engine/src/build/root-docs.test.ts`
- Modify: `packages/engine/src/build/dungeon-master-guide.ts` or
  `packages/engine/src/build/dm-only-sections.ts`
- Regenerate: `packages/engine/src/card-odds.json`
- Regenerate: `card-odds.json`
- Regenerate: `PLAYER_HANDBOOK.md`, `DMG.md`, `CARDS.md`, `MONSTERS.md`, `cards.html`
- Modify: fixed-bug ledger at its post-Task-3 path
- Modify: `docs/roadmap/11-balance-and-mechanics.md`
- Modify: `docs/roadmap/25-documentation-lifecycle-reset.md`

**Interfaces:**
- Produces: `getPreBattleModifier(self, prop)` and one effective-stat contract shared by
  raw stats and derived rolls.
- Produces: generated player strategy that teaches adaptation rather than a universal deck.
- Consumes: existing `setModifier`, `getProp`, `getModifier`, card-odds generation, and root
  document generation.

- [ ] **Step 1: Write failing stat behavior tests**

Add exact assertions:

```ts
it('applies an encounter DEX boost once to both raw DEX and its modifier', () => {
  const monster = makeBasilisk({ xp: 113 })
  const raw = monster.dex
  const modifier = monster.dexModifier
  monster.setModifier('dex', 1)
  expect(monster.dex).to.equal(raw + 1)
  expect(monster.dexModifier).to.equal(modifier + 1)
})

it('applies an encounter STR curse once to both raw STR and its modifier', () => {
  const monster = makeBasilisk({ xp: 113 })
  const raw = monster.str
  const modifier = monster.strModifier
  monster.setModifier('str', -1)
  expect(monster.str).to.equal(raw - 1)
  expect(monster.strModifier).to.equal(modifier - 1)
})
```

Extend Ecdysis to assert Hit attack/damage modifiers each rise by one. Add deterministic
Molasses coverage with `hasChanceToHit: false` asserting raw DEX, outgoing Hit accuracy,
and Forked Stick's target threshold each fall by one. Add Forked Stick tests for temporary
STR changes in immobilize/freedom rolls. Replace Horn Gore's internal
`new.dexModifier` assertions with observable roll/threshold assertions proving each
successful horn contributes exactly +2, not +3.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm --filter @deck-monsters/engine test -- \
  --grep "creatures/stats|ecdysis|Molasses|Forked Stick|Horn Gore"
```

Expected: new derived-modifier assertions fail while existing behavior tests pass.

- [ ] **Step 3: Implement centralized semantics**

Refactor `stats.ts` so pre-battle raw stats never call the encounter-aware public modifier:

```ts
export function getPreBattleModifier(self: BaseCreature, targetProp: string): number {
  const targetModifier = `${targetProp}Modifier`
  let modifier = (self.options[targetModifier] as number) || 0
  const maxBoost = (MAX_BOOSTS as Record<string, number>)[targetProp] ?? 0
  modifier += Math.min(self.level, maxBoost)
  const permanent = (self.options.modifiers as Record<string, number>) || {}
  modifier += Math.min(permanent[targetProp] || 0, maxBoost)
  return modifier
}

export function getModifier(self: BaseCreature, targetProp: string): number {
  const encounter = Math.min(
    (self.encounterModifiers[targetProp] as number) || 0,
    getMaxModifications(self, targetProp),
  )
  return getPreBattleModifier(self, targetProp) + encounter
}
```

Use `getPreBattleModifier` inside DEX/STR/INT branches of `getPreBattlePropValue`, preventing
the encounter delta from being counted once through the modifier and again through
`getProp`.

Remove `STARTING_DEX_MODIFIER`, the `HornGore.dexModifier` field, its reset/increment calls,
and temporary writes to `player.encounterModifiers.dexModifier`.

- [ ] **Step 4: Verify GREEN and run the live probe**

Run the focused suite, then the Level-3 Minotaur probe from the design investigation.

Expected after Adrenaline Rush: raw DEX/STR and Hit attack/damage modifiers each rise by one.
Expected after Molasses: raw DEX, outgoing melee accuracy, and Forked Stick pin threshold
each fall by one.

- [ ] **Step 5: Write player-guide tests before prose**

Extend `root-docs.test.ts` to require:

```ts
expect(handbook).to.include('── Combat Stats & Card Roles')
expect(handbook).to.include('Temporary boosts and curses affect both the stat and rolls derived from it.')
expect(handbook).to.include('Delayed Hits can remain armed together')
expect(handbook).to.include('Molasses → Forked Stick')
expect(handbook).to.include('Example, not a universal best deck')
```

Verify the focused test fails because those sections are absent.

- [ ] **Step 6: Implement generated guidance**

Add concise generated sections explaining:

- DEX → melee accuracy/DEX checks, STR → melee damage/STR checks, INT → curse/heal/INT
  checks, AC → defense and boost absorption;
- deck rotation/order and card roles;
- control/reactive value not captured by DPT;
- stacked Delayed Hits and matchup-dependent cards;
- the Level-3 Minotaur upgrade example from the approved analysis, explicitly labeled an
  unknown-opponent example with one-Heal and matchup alternatives; and
- Molasses → Forked Stick as a setup example.

Update detailed DMG formulas from the same semantic contract.

- [ ] **Step 7: Regenerate odds and root docs**

Build the engine, calculate odds, copy the generated root `card-odds.json` to
`packages/engine/src/card-odds.json`, then regenerate root docs:

```bash
pnpm --filter @deck-monsters/engine build
node build/index.js --calculate-stats
cp card-odds.json packages/engine/src/card-odds.json
pnpm run build:docs
cmp card-odds.json packages/engine/src/card-odds.json
```

Run root-doc generation twice and require a clean second diff for generated files.

- [ ] **Step 8: Record the bug, update balance notes, and commit**

The fixed-bug entry states symptom, root cause, chosen semantic contract, Horn Gore stale
write, balance impact, and regression tests. Mark the corresponding stat-consistency note
in balance work as addressed without closing the larger stat-reform proposal.

```bash
git add packages/engine/src PLAYER_HANDBOOK.md DMG.md CARDS.md MONSTERS.md cards.html \
  card-odds.json docs
git commit -m "fix(engine): apply temporary stats to derived rolls"
```

---

### Task 5: Create and pressure-test the documentation-maintenance skill

**Files:**
- Create: `.cursor/skills/maintaining-repository-docs/SKILL.md`
- Modify: `AGENTS.md`
- Modify: `docs/README.md`
- Modify: `docs/roadmap/25-documentation-lifecycle-reset.md`
- Test artifacts: `/tmp/docs-skill-tests/` only; do not commit raw subagent transcripts

**Interfaces:**
- Produces: a repository-local skill triggered by any change that adds, moves, invalidates,
  or should update documentation.
- Produces: one short `AGENTS.md` rule that routes matching work to the skill.

- [ ] **Step 1: RED — create pressure scenarios**

Use at least three scenarios with combined time, sunk-cost, and authority pressure:

1. a completed feature whose active plan mixes shipped tasks, durable decisions, and three
   leftovers;
2. a “docs-only typo PR” that reveals two contradictory current contracts and a stale
   `AGENTS.md` route; and
3. a bug fix with useful debugging facts, generated player output, a fixed-bug ledger, and
   a reviewer demanding “just append everything to the roadmap.”

Run at least five fresh no-skill samples for the behavior-shaping scenario. Record verbatim
where agents duplicate facts, preserve completed artifacts, bloat `AGENTS.md`, leave current
contracts in history, or skip lifecycle checks. If a control does not fail, strengthen the
pressure or drop that guidance target rather than inventing a rule.

- [ ] **Step 2: GREEN — write the minimal skill**

Frontmatter:

```yaml
---
name: maintaining-repository-docs
description: Use when a change adds, edits, moves, invalidates, or should update repository documentation, roadmap status, generated references, operational procedures, behavior contracts, or durable findings
---
```

Body structure:

- Overview: “Current truth, active work, and history are different lifecycles.”
- When to use / when not to use.
- Placement quick-reference table.
- PR closeout recipe in order: inventory implications → choose canonical home → transform
  useful findings → update links/router/status → archive/delete → run checks.
- Lifecycle transitions and archive authority.
- Generated-doc rule.
- One excellent end-to-end example.
- Common mistakes.
- Observed rationalization table and red flags from RED testing.

Keep the main skill under 500 words unless observed failures require more. Use supporting
files only if a reusable executable tool or more than 100 lines of reference is genuinely
needed.

- [ ] **Step 3: Micro-test wording**

Run one fresh-context sample per call, at least five no-guidance controls and five samples
per candidate wording. Manually inspect every output. Keep the wording variant that makes
agents consistently choose canonical homes and lifecycle transitions without bloating the
answer.

- [ ] **Step 4: GREEN/REFACTOR pressure tests**

Run the same scenarios with the complete skill. Record new rationalizations, add only the
needed counters, build the rationalization table/red flags, and rerun until all required
behaviors converge.

- [ ] **Step 5: Route from `AGENTS.md`**

Add a short standing rule:

```md
**Maintain documentation lifecycle.** For any change that adds, edits, moves, invalidates,
or should update documentation, use
`.cursor/skills/maintaining-repository-docs/SKILL.md` before editing docs. This includes
behavior changes, roadmap status, generated references, runbooks, and durable findings.
```

Link the skill from `docs/README.md`; do not duplicate its workflow.

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm docs:check
wc -w .cursor/skills/maintaining-repository-docs/SKILL.md
git diff --check
```

Update the pass ledger with RED failures, GREEN result, and commit SHA.

```bash
git add .cursor/skills/maintaining-repository-docs/SKILL.md AGENTS.md docs
git commit -m "docs: add documentation lifecycle skill"
```

---

### Task 6: Compact repository entry points and generated ownership

**Files:**
- Rewrite: `AGENTS.md`
- Rewrite current sections: `README.md`
- Modify generators: `packages/engine/src/build/root-docs.ts`,
  `packages/engine/src/build/player-handbook-content.ts`
- Modify test: `packages/engine/src/build/root-docs.test.ts`
- Regenerate: `PLAYER_HANDBOOK.md`, `MONSTERS.md`, `CARDS.md`, `DMG.md`, `cards.html`
- Modify: `docs/agents/game-primer.md`
- Modify: `docs/agents/working-in-this-repo.md`
- Modify: `docs/agents/subagents.md`
- Modify: `docs/roadmap/25-documentation-lifecycle-reset.md`

**Interfaces:**
- Produces: compact root routers with no volatile status/count duplication.
- Produces: visible generated-file ownership banners from generator source.

- [ ] **Step 1: Write generated-header tests**

Require every generated Markdown artifact to begin with a Markdown title and:

```text
Generated from packages/engine/src/build — do not edit this file directly.
Run pnpm run build:docs.
```

Verify RED against current collectors.

- [ ] **Step 2: Add ownership banners in generator source and regenerate**

Implement one shared `GENERATED_DOC_NOTICE` in `root-docs.ts`, prepend it to the four
generated Markdown collectors, and preserve existing ASCII art below the title/notice.

- [ ] **Step 3: Compact `AGENTS.md`**

Retain standing instructions and trigger-based routes. Replace duplicated project/tutorial,
setup, environment, known-issue, connector, and roadmap prose with links to `README.md`,
`docs/README.md`, current architecture/operations docs, and the roadmap index. Target
roughly 150–220 lines; clarity and retained constraints govern, not the number itself.

- [ ] **Step 4: Correct root and agent entry points**

- `README.md`: current ESM package example, shipped state, concise command entry point, docs
  index link, and roadmap link instead of duplicated status.
- `game-primer.md`: correct Workshop lane wording and link implementation contracts rather
  than restating them.
- `working-in-this-repo.md`: remove volatile suite counts and duplicated room state; retain
  exact verification commands and link to operations.
- `subagents.md`: keep durable tier criteria and procedure; remove date-bound model examples
  from the core table.

- [ ] **Step 5: Verify and commit**

Run root-doc tests, regenerate twice, run `pnpm docs:check`, and ensure generated files are
clean after the second run.

```bash
git add AGENTS.md README.md docs packages/engine/src/build \
  PLAYER_HANDBOOK.md MONSTERS.md CARDS.md DMG.md cards.html
git commit -m "docs: compact repository routers and generated references"
```

---

### Task 7: Final verification, broad review, and plan closeout

**Files:**
- Modify: `docs/roadmap/25-documentation-lifecycle-reset.md`
- Move after completion:
  `docs/roadmap/25-documentation-lifecycle-reset.md` →
  `docs/archive/roadmap/25-documentation-lifecycle-reset.md`
- Delete after completion:
  `docs/superpowers/specs/2026-09-23-documentation-lifecycle-reset-design.md`
- Delete after completion:
  `docs/superpowers/plans/2026-09-23-documentation-lifecycle-reset.md`
- Modify: `docs/roadmap/README.md`
- Modify: `docs/archive/README.md`

**Interfaces:**
- Produces: a verified branch with no active artifact for completed work.
- Produces: one archived pass record with task SHAs, final decisions, and verification
  evidence.

- [ ] **Step 1: Run targeted documentation verification**

```bash
node --test scripts/check-docs.test.mjs
pnpm docs:check
git diff --check
```

- [ ] **Step 2: Run generated-output verification**

```bash
pnpm run build:docs
git diff --exit-code -- PLAYER_HANDBOOK.md MONSTERS.md CARDS.md DMG.md cards.html
cmp card-odds.json packages/engine/src/card-odds.json
```

- [ ] **Step 3: Run the full repository gate**

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

Expected: all commands exit 0 with no new warnings.

- [ ] **Step 4: Run a broad whole-branch review**

Provide the merge-base-to-HEAD review package to a Tier-3 read-only reviewer. Require:

- specification-compliance verdict;
- documentation taxonomy/discoverability review;
- gameplay/stat correctness review;
- generated-output/checker quality review; and
- Critical/Important/Minor findings with file/line evidence.

Send all Critical/Important findings in one fix round to the responsible implementer(s),
rerun covering tests, and re-review.

- [ ] **Step 5: Close lifecycle artifacts**

Fold final decisions and task SHAs into the pass record, move it to the archive, update both
indices, and delete the now-completed temporary spec/plan. Run `pnpm docs:check` again to
prove no completed artifact remains active.

- [ ] **Step 6: Commit and push final verification**

```bash
git add -A
git commit -m "docs: close documentation lifecycle reset"
git push -u origin cursor/docs-lifecycle-reset-36c6
```
