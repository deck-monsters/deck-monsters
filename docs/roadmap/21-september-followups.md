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
| B | Workshop header metrics: current HP first, slots bar → `Deck 9/9` text, `Lvl n` badge, fallen/revives-in state | Tier 2 implement | ✅ done (review found 4 Important: restore-drift `revivesAt`, doubled `in`, no countdown tick, `maxHp` floor — fixed) | 854f53e, d36bbe3, f8d2e4e, 2a71c9a, 29a3bbb, 7c07e45, bc85843 |
| A | One vocabulary for the world (`train`, `call out`, `dismiss`, pronouns…) + `docs/voice-and-wording.md` | Tier 3 doc, Tier 2 apply | 🔧 landed (`3864145` voice doc; `8896b6d`, `1372f8f`, `f244a3b`, `ae39f1a` apply, #163) — also found Discord `/spawn [type] [name]` never matched the engine regex, so `/train` (+ `/spawn` alias) now opens the interactive flow; review running | — |
| E | Edit your **global** display name, not just the room-scoped character name | explore → Tier 2 | ✅ done (review: Critical masked-vs-raw name mismatch; orchestrator then found `givenName` is also start-cased — fixed with real-character tests) | `4659880`, `cdb7af2`, `bc879bd`, `e64027a`, `7763188`, `d5cc0bc`, `32a13c8` |
| F | +3 monster slots per beastmaster (existing characters included) | orchestrator (small) | ✅ done | see git log (`feat(engine): beastmasters keep up to 10 monsters`) |
| G | Implement [17 — Pixel Art Fight Animations](17-pixel-art-fight-animations.md) | Tier 3 design, Tier 2 implement | 🔧 G1 ✅ (`a2d8e7a`, review fix `8235137`); G2 landed (`64c3e5a`…`5368228`), live-verified in Test Room A, review-fix round landed (`2368f79`…`8eed8c3`: time-driven settle, single theme store, roster churn, payload validation, canvas sizing, sprite legibility); orchestrator follow-ups `3a29ae0` (poses derived from each literal map — the redraw had shipped six identical frames), `7688719` (settle timer re-arms on an early wake; bug #162), `6912e7d` (hold fighters through the fade). Live re-verified: band fades ~2 s after `Fight concluded`, fallen pose visible | `a2d8e7a`, `b18fc31`, `8235137`, `64c3e5a`, `265807b`, `4e40ef7` |
| H | Reorganise the roadmap: archive what shipped, make remaining work obvious | Tier 1 survey → Tier 2 apply | 📋 survey done (`/tmp/dm-followups/roadmap-status-map.md`: 13 docs shipped, README calls 17 "post-launch" though it shipped, 10b's last section heading still says #98–#108 while holding through #162); brief ready (`task-H-brief.md`), dispatch after A lands — both edit `README.md`/`10b`/`AGENTS.md` | — |
| I | Encode what worked in this process into `AGENTS.md` / `docs/agents/subagents.md` | orchestrator | 📋 last | — |

## Decisions so far

- **Bug numbering**: PR #383 took #154/#155 while #384 was open; #384 renumbered to #156–#159 on merge. New 10b entries in this pass are numbered from #160 by whoever lands first on this branch; check `rg -n '^### ' docs/roadmap/10b-bugs-fixed.md | tail -1` before adding.
- **Vocabulary** (Task A, binding): *train* a monster (parser keeps `spawn` as an alias), *call [monster] out of the ring* (never "summon from"), *dismiss* (not release/drop), *revive* (not respawn/resurrect), *fallen* (not KO), *fight* (not encounter), *the ring* (not arena), *Lvl n* in compact badges, pronoun questions instead of gender questions (engine keys unchanged). Admin/debug commands and code identifiers are out-of-world and keep their names.
- **Workshop first run** (Task C): the workshop cannot prompt, so the Train form collects name / pronouns / avatar when `myInventory.hasCharacter` is false and `game.spawnMonster` creates the character and the monster in one serialized mutation. The name is pre-checked against `game.findCharacterByName` because the engine re-prompts on a clash and the silent channel would throw.
- **Workshop metrics** (Task B): HP is the number that drives revive / send / item decisions and was shown nowhere in the workshop; a nearly-always-full deck bar carried no information.
- **Monster slots** (Task F): `DEFAULT_MONSTER_SLOTS` 7 → 10, and capacity is now *derived*: `monsterSlots = max(DEFAULT_MONSTER_SLOTS + monsterSlotModifier, monsters.length)`. The old persisted `monsterSlots` field is retired on load (anything above today's default becomes a modifier grant; the field is dropped from saved state). The floor at the roster size means lowering the default never strands anyone. Earning the modifier (level reward, scroll) is a backlog item in `12-new-content-backlog.md`. The handbook prints the number from the constant.
- **Display name vs character name** (Task E): `profiles.display_name` is global (Supabase) and seeds a new room character's `givenName`; the character name is per-room engine state and stays editable via `edit my character`. Both must be editable; the account page is the home for the global one.

- **Roadmap layout** (Task H): shipped plans move to `docs/archive/roadmap/` with filenames kept; their leftovers are carried into a new `22-small-leftovers.md` so nothing vanishes; `10b-bugs-fixed.md` stays in `docs/roadmap/` because ~45 code comments cite that path as a stable anchor; `07`/`08` stay visible as deliberate deferrals; `README.md` becomes Now / Next / Deferred / Shipped.
- **Pixel-fight timers** (Task G): time-driven effects must re-arm until `performance.now() >= deadline` — `setTimeout` is ms-clamped and can wake early, and a settle that changes nothing never re-renders (#162).

## Process rules for this pass (candidates for `AGENTS.md`)

1. One implementer per set of files at a time; docs-only work may run alongside code work. Long independent features run in their own git worktree and are merged back.
2. Brief and report live as files under `/tmp/dm-followups/`; the orchestrator reads summaries, not transcripts.
3. Every task ends with: task review (spec + quality) → fix round if needed → **checkpoint commit that also updates this plan** → push.
4. A subagent that returns "success" with no artifact is re-dispatched on a different model, not retried.
5. The final whole-branch review runs on the most capable model after all tasks land.
6. Implementers never create or switch branches in the shared worktree (Task B's implementer did; its branch is fast-forwarded into the feature branch and deleted once the task lands).
7. Test the real object, not a stub of it, whenever the assertion is about that object's behaviour: Task E's propagation check passed two rounds against stubs with hand-written `givenName` values and was dead against a real `Beastmaster` (masking + `startCase`).
8. Live tests reuse `Test Room A` / `Test Room B` on the remote project and delete any throwaway room before reporting done (Task C's implementer left three `First Run …` rooms; the orchestrator deleted them via `room.delete` and wrote the rule into `docs/local-testing-guidelines.md`, `docs/agents/working-in-this-repo.md`, and `AGENTS.md`).
9. Look at the recording before trusting it: `x11grab` captures a screen region, and two Chrome windows exist in Cursor Cloud — raise the test window (`xdotool windowraise`) first, then sample frames with ffmpeg. A video-review model also reported 1–2 px sprite motion as "static"; frame strips at 200 ms steps settled it.
10. When a fix round reports `DONE_WITH_CONCERNS`, treat the concern as a finding: G2's "frames reuse the base map" meant nothing animated, and the live re-check that followed found the timer bug (#162) the unit tests had not.

## Clean-up (final step)

When every task is ✅: move the decisions into their area docs (voice doc, 16-card-management, 17, agents docs), fold the process rules into `AGENTS.md`, update the roadmap README status table, and reduce this file to the task table plus a pointer to the PR.
