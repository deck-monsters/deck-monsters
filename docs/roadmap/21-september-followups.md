# September 2026 Follow-ups — working plan

**Status**: 🔧 Active — orchestrated pass, one checkpoint commit per task
**Branch**: `cursor/workshop-wording-agents-md-d3ec`
**Started**: 2026-09-20, after PR #384 merged

This is a *planning* doc for a batch of follow-ups requested after the post-battle regression pass. It is updated in the same commit as each task lands so the branch history shows what was planned, what was decided, and what was deferred. When the pass is complete the durable parts move into the area docs and this file is trimmed to a short record (see "Clean-up" at the end).

## Tasks

| # | Task | Owner model tier | Status | Checkpoint |
|---|------|------------------|--------|------------|
| D | `AGENTS.md` becomes the single source of truth; `CLAUDE.md` a symlink; `docs/agents/*` reference files (game primer, repo operations, subagents) | Tier 3 implement, Tier 2 review | ✅ done (review: spec pass; two stale claims fixed after review) | `2ab6fc1`, `7749309`, + review fix |
| C | Workshop: train your first monster with no character (prompt-free character creation inside `game.spawnMonster`); stop asking players to pick from one class | Tier 3 implement, Tier 2 review | ✅ done (review: spec pass, approved; 10b #160) | `67d7ad5`…`675a230` |
| B | Workshop header metrics: current HP first, slots bar → `Deck 9/9` text, `Lvl n` badge, fallen/revives-in state | Tier 2 implement | 🔍 in review | 854f53e, d36bbe3, f8d2e4e |
| A | One vocabulary for the world (`train`, `call out`, `dismiss`, pronouns…) + `docs/voice-and-wording.md` | Tier 3 doc, Tier 2 apply | 📋 brief ready, runs last of the wording/workshop set | — |
| E | Edit your **global** display name, not just the room-scoped character name | explore → Tier 2 | 🔧 implementing | — |
| F | +3 monster slots per beastmaster (existing characters included) | orchestrator (small) | ✅ done | see git log (`feat(engine): beastmasters keep up to 10 monsters`) |
| G | Implement [17 — Pixel Art Fight Animations](17-pixel-art-fight-animations.md) | Tier 3 design, Tier 2 implement, isolated worktree | 📋 exploring | — |
| H | Reorganise the roadmap: archive what shipped, make remaining work obvious | Tier 2 | 📋 after G | — |
| I | Encode what worked in this process into `AGENTS.md` / `docs/agents/subagents.md` | orchestrator | 📋 last | — |

## Decisions so far

- **Bug numbering**: PR #383 took #154/#155 while #384 was open; #384 renumbered to #156–#159 on merge. New 10b entries in this pass are numbered from #160 by whoever lands first on this branch; check `rg -n '^### ' docs/roadmap/10b-bugs-fixed.md | tail -1` before adding.
- **Vocabulary** (Task A, binding): *train* a monster (parser keeps `spawn` as an alias), *call [monster] out of the ring* (never "summon from"), *dismiss* (not release/drop), *revive* (not respawn/resurrect), *fallen* (not KO), *fight* (not encounter), *the ring* (not arena), *Lvl n* in compact badges, pronoun questions instead of gender questions (engine keys unchanged). Admin/debug commands and code identifiers are out-of-world and keep their names.
- **Workshop first run** (Task C): the workshop cannot prompt, so the Train form collects name / pronouns / avatar when `myInventory.hasCharacter` is false and `game.spawnMonster` creates the character and the monster in one serialized mutation. The name is pre-checked against `game.findCharacterByName` because the engine re-prompts on a clash and the silent channel would throw.
- **Workshop metrics** (Task B): HP is the number that drives revive / send / item decisions and was shown nowhere in the workshop; a nearly-always-full deck bar carried no information.
- **Monster slots** (Task F): `DEFAULT_MONSTER_SLOTS` 7 → 10, and capacity is now *derived*: `monsterSlots = max(DEFAULT_MONSTER_SLOTS + monsterSlotModifier, monsters.length)`. The old persisted `monsterSlots` field is retired on load (anything above today's default becomes a modifier grant; the field is dropped from saved state). The floor at the roster size means lowering the default never strands anyone. Earning the modifier (level reward, scroll) is a backlog item in `12-new-content-backlog.md`. The handbook prints the number from the constant.
- **Display name vs character name** (Task E): `profiles.display_name` is global (Supabase) and seeds a new room character's `givenName`; the character name is per-room engine state and stays editable via `edit my character`. Both must be editable; the account page is the home for the global one.

## Process rules for this pass (candidates for `AGENTS.md`)

1. One implementer per set of files at a time; docs-only work may run alongside code work. Long independent features run in their own git worktree and are merged back.
2. Brief and report live as files under `/tmp/dm-followups/`; the orchestrator reads summaries, not transcripts.
3. Every task ends with: task review (spec + quality) → fix round if needed → **checkpoint commit that also updates this plan** → push.
4. A subagent that returns "success" with no artifact is re-dispatched on a different model, not retried.
5. The final whole-branch review runs on the most capable model after all tasks land.
6. Implementers never create or switch branches in the shared worktree (Task B's implementer did; its branch is fast-forwarded into the feature branch and deleted once the task lands).
7. Live tests reuse `Test Room A` / `Test Room B` on the remote project and delete any throwaway room before reporting done (Task C's implementer left three `First Run …` rooms; the orchestrator deleted them via `room.delete` and wrote the rule into `docs/local-testing-guidelines.md`, `docs/agents/working-in-this-repo.md`, and `AGENTS.md`).

## Clean-up (final step)

When every task is ✅: move the decisions into their area docs (voice doc, 16-card-management, 17, agents docs), fold the process rules into `AGENTS.md`, update the roadmap README status table, and reduce this file to the task table plus a pointer to the PR.
