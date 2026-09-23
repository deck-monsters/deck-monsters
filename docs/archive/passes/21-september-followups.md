---
type: Archive
title: September 2026 Follow-ups — pass record
description: Historical record of the September 2026 follow-up pass and where its decisions live.
status: deprecated
audience: internal
tags: [archive, passes, followups]
---
# September 2026 Follow-ups — pass record

> Historical record. Current code and documents linked from `docs/README.md` are
> authoritative. Any remaining work has been copied to the active roadmap.


> **Archived** — shipped in [PR #385](https://github.com/deck-monsters/deck-monsters/pull/385)
> (branch `cursor/workshop-wording-agents-md-d3ec`, 2026-09-20). The decisions this pass made
> now live in their area docs; this file keeps the task table so the commit history is
> navigable. Bugs #160–#163 are in [`10b-bugs-fixed.md`](../../roadmap/10b-bugs-fixed.md).

**Requested after PR #384 merged**: one vocabulary for the world, workshop metrics that show
HP, training a first monster from the workshop, `AGENTS.md` as the single agent doc, an
editable global display name, +3 monster slots, the pixel-art fight animations, a roadmap
reorganisation, and encoding what worked in the process into the agent docs.

## Tasks

| # | Task | Owner tier | Outcome | Where it lives now |
|---|------|------------|---------|--------------------|
| D | `AGENTS.md` single source of truth; `CLAUDE.md` symlink; `docs/agents/*` | Tier 3 implement, Tier 2 review | ✅ `2ab6fc1`, `7749309` + review fixes | `AGENTS.md`, `docs/agents/` |
| C | Train a first monster from the workshop with no character; no one-option class prompt | Tier 3 implement, Tier 2 review | ✅ `67d7ad5`…`675a230`; #160 | `docs/agents/game-primer.md` §core loop |
| B | Workshop header: HP first, `Deck n/m` text, `Lvl n`, fallen/revives-in via `respawnAt` | Tier 2 | ✅ `854f53e`…`bc85843`; review found 4 Important (restore-drift `revivesAt`, doubled "in", no countdown tick, `maxHp` floor), fixed; #161 | primer §healing and revival |
| A | One vocabulary (`train`, `call out`, `dismiss`, `fallen`, `fight`, `Lvl n`, pronouns) + `docs/reference/voice-and-wording.md` | Tier 3 doc, Tier 2 apply | ✅ `3864145`, `8896b6d`, `1372f8f`, `f244a3b`, `ae39f1a`; review found 4 Important (leaked `battle`/`encounter`/`arena`, `Owner`/`L3`, `in`-operator key check, never-working Discord `/spawn [type] [name]`), fixed in `e472c19`, `712b317`; #163 | `docs/reference/voice-and-wording.md` |
| E | Editable **global** display name with propagation to seeded room characters | explore → Tier 2 | ✅ `4659880`…`32a13c8`; review found the propagation dead against real characters (masked + start-cased names), fixed with real-object tests | archived `03-auth-and-identity.md` §display name vs character name; primer §identity |
| F | Monster slots 7 → 10 as a derived value (`DEFAULT_MONSTER_SLOTS + monsterSlotModifier`, floored at roster size); legacy field retired on load | orchestrator | ✅ `9d4d269`; whole-branch review restored the admin grant path (`6499bb9`) | primer §core loop; `12-new-content-backlog.md` (earning slots) |
| G | Pixel-art fight animations: engine `CombatPayload` DTO + theme-gated canvas layer | Tier 3 design, Tier 2 implement | ✅ G1 `a2d8e7a`, `8235137`; G2 `64c3e5a`…`5368228`, fix round `2368f79`…`8eed8c3`, follow-ups `3a29ae0`, `7688719`, `6912e7d`; live-verified twice; #162 | archived `17-pixel-art-fight-animations.md` §gotchas; primer §combat payloads |
| H | Roadmap reorganisation | Tier 1 survey → Tier 2 apply | ✅ `16395c3`, `0630a8d`, `b05dfed`; 13 shipped plans → `docs/archive/roadmap/`, leftovers → `22-small-leftovers.md` | `docs/roadmap/README.md`, `docs/archive/README.md` |
| I | Encode what worked into the agent docs | orchestrator | ✅ `17b429e` | `AGENTS.md` Standing Instruction 6 + "Working with subagents"; `docs/agents/subagents.md` §procedure |
| — | Whole-branch Tier 3 review | Tier 3 | APPROVE_WITH_MINORS (0 Critical, 8 Important, 15 Minor); all addressed in `6499bb9`, `bc0bf69`, `a603481`, `cc949ab`, `a777abd` (pronoun single source, pixel layer keyed by room, `existingCharacter` re-read inside the lane, plural in code, grantable slot modifier, `respawnAt` cleared on dispose, shared `hpBand`, avatar dedupe, doc corrections). Important 8 (propagation loads every member room) kept deliberately: `Game.getCharacter` cannot heal an arbitrary old seeded name without also overwriting aliases — see the comment in `packages/server/src/trpc/profile.ts` | — |

## What this pass taught (kept where it is used)

- Bug-number collisions between concurrent PRs, and the "check `10b`'s last heading first" rule → `docs/agents/working-in-this-repo.md`.
- Shared-worktree rules for implementers, review shape, fix-round resume, provider-quota fallback, real-object tests, recording verification → `docs/agents/subagents.md`.
- Planning docs live in the roadmap and are updated in the checkpoint commits → `AGENTS.md` Standing Instruction 6.
- Time-driven UI effects must re-arm until the deadline has truly passed (#162) → archived `17-pixel-art-fight-animations.md`.
