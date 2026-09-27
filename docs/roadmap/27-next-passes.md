---
type: Roadmap
title: Next Passes
description: Planned order of the next roadmap passes, with the first pass's task table ready to run.
status: draft
audience: internal
tags: [roadmap, planning, passes]
---
# 27 — Next Passes

**Status:** Pass A done on branch `claude/pass-a-command-workshop-bugs`, with its live
browser check still open; Pass B is next. Written on 2026-09-27 after the Unicorn pass
closed ([26](../archive/roadmap/26-unicorn-pack.md)) and a docs sweep. This file orders
the open roadmap into passes; later passes are sketched and get their own task tables when
they start. Update this file in each pass's checkpoint commits, filling in each task's
status and commit SHA, and archive it once its passes are done or re-planned.

## How each pass runs

Follow [the orchestrated pass](../agents/subagents.md#the-orchestrated-pass): a Tier 3
orchestrator triages each item against the current code, briefs Tier 2 implementers (one
worktree per parallel code task), reviews every diff with an independent read-only
reviewer, and owns the branch, this file, and `10b-bugs-fixed.md`. Keep a PR to four or
five tasks. Commit and push after each task; move a fixed bug from
[10 — Bug fixes](10-bug-fixes.md) to the ledger with its root cause and the failing test.
Re-check in a real browser after any task that touches the web workspace or timing.

## Pass A — command and workshop bugs

All five items come from the browser sweep on 2026-09-26 and were confirmed still present
on `main` on 2026-09-27. Each has a known root cause, so these are fixes, not
investigations.

| # | Task | Source | Area / files | Can run beside | Status | Commit |
|---|---|---|---|---|---|---|
| A1 | A short equip swallows the next command and calls a partial deck "good to go"; "equiped" typo | 10 §L | Engine: `monsters/helpers/equip.ts`, `cards/helpers/choose.ts`, `characters/beastmaster.ts` | A3, A4, A5 | Done (#189) | this commit |
| A2 | `unequip all from [monster]` matches the single-card pattern first | 10 §M | Engine: `commands/monster.ts` dispatch order, plus a dispatch test | A3, A4, A5 (not A1: both change command handling) | Done (#185) | 4a32c72 |
| A3 | First-run workshop shows "Applying changes…" and polls `game.shop`, which 404s without a character | 10 §N | Web: `hooks/useDeckWorkshop.ts`; server `game.shop` if returning an empty shop is chosen | A1, A4 | Done (#188) | e634b35 |
| A4 | A fast fight's log is empty because events are filtered by insert time, not engine time | 10 §O | Server: `analytics-queries.ts` (select by the `event_id` timestamp prefix, or store a fight id) | A1, A2, A3 | Done (#187) | 45837a6 |
| A5 | Three-word card names abbreviate unreadably ("Fig or Fli") | 10 §P | Web: `utils/cards.ts` `abbreviateCardName`, `cards-utils.test.ts` | A1, A2, A4 | Done (#186) | 5ccd8ff |

Notes for the briefs:

- **A1** must not change the prompt contract; read
  [events, prompts, and replay](../architecture/events-prompts-and-replay.md) and the
  [prompt/answer contract](../reference/prompt-answer-contract.md) first. The decision to
  make is whether an unrecognised line cancels the equip flow or is rejected with the hand
  kept open; either way, the next command must not be consumed silently.
- **A2** needs a test through `commands/index.ts` dispatch, because a test of the regex
  alone passed while the command was broken.
- **A3** has two fixes to choose between (disable the query until `hasCharacter`, or return
  an empty shop). Prefer the client change unless another caller needs the empty shop, and
  drive the banner from in-flight mutations only.
- **A4** must not pad the time window: `room_events` has no fight id, so a grace period
  attaches the next fight's rows. Cover a row inserted after the resolve timestamp.
- **A5** is a good place to also look at item K (emoji rows break the card-box border),
  but only as an investigation note unless the fix is small.

Definition of done: each item moved to the ledger with root cause and test; the full
verification gate in [working in this repo](../agents/working-in-this-repo.md) passes; A3
and A5 checked in a browser at desktop and phone widths.

**Pass A result (2026-09-27):** all five fixed (10b #185–#189) and the full gate passes.
A1 took the owner's choice: an answer that names no card re-asks with the hand kept open.
A5's label budget was measured in Chromium against the real label CSS at 70, 72, and 85px.
**Still open:** the live-app browser check of A3 and A5. The session that ran the pass had
no Supabase or test-account credentials, so it could not start the app; run it from
[local testing](../operations/local-testing.md) on Test Room B (A3) and Test Room A (A5)
before or after merge. Item K (emoji card-box border) stays open; it is in the feed, not
the Workshop label A5 touched.

## Pass B — realistic harness rings

Source: "Realistic harness rings" in [11 — Balance](11-balance-and-mechanics.md). The
harness now has shuffled draws, team fights, Unicorn-only card counters, and no Flee in
random decks. What it still lacks decides whether its numbers can guide balance at all.

Candidate tasks, in order of value:

0. One harness monster roster derived from `allMonsters`, a test that fails when a monster
   is missing from it, and `sim:unicorn` generalized into `sim:monster <type>` (owner
   request; see "One monster roster for the harness" in 11). Small, and it goes first
   because every later task and the Dragon pass run on it.
1. Weighted "likely" decks: a few hand-written archetypes per class, kept beside today's
   uniform draw as a control.
2. Mixed ring sizes (2–12 contestants, the ring's `MAX_MONSTERS`) with free-for-all, one
   team against solos, and uneven teams, all through `SimMonsterSpec.team`.
3. Mixed levels inside one ring.
4. Runs with ring events and bosses left on.
5. A report that prints each class's win-rate curve across levels 1–20.

Then revisit the open "Blast and Cleric power" notes in 11 with the new evidence. Owner
guidance: balance does not need to be 50/50; judge classes against the curve in
[cards and encounter effects](../architecture/cards-and-encounter-effects.md#content-and-balance-rules).

## Pass C — Dragon research

Source: the [Dragon research brief](12-new-content-backlog.md#dragon-research-brief). This
pass writes a design brief, not code: choose the tradition, gather public-domain sources
with exact citations, fit the Dragon against the roster (especially the Basilisk) and the
power curve, and propose three to five cards with their risks and counterplay. The owner
reviews the brief before a Dragon content pass is planned. Pass B should land first, so the
content pass can use the realistic harness and `sim:monster Dragon`.

The requester is the owner's eight-year-old son, whose dragons are the ones in Cressida
Cowell's *How to Train Your Dragon* books. The brief records what that means: borrow the
Viking-age setting and feel, and the Roman overlap with the Gladiator; borrow no names,
quotes, or designs; cite the Norse and Roman sources the books share. Research can start
beside Pass A or B, since it touches only docs; start with the brief's "Still to ask the
requester" questions.

## Later

- **Prompt transport for items that ask a question** ([item follow-ups](item-followups.md)),
  paired with the prompt step and flow labels in [22](22-small-leftovers.md): both need the
  same per-flow design across the prompt call sites.
- **Feed issues that need a reproduction first**: the missing `↓ Latest` button (10 §A),
  odd spacing (10 §F), and the emoji card-box border (10 §K, unless A5 absorbs it).
- **Fight rewards never credited** (10 §J) needs production evidence; the in-process path
  is already proven.
- **Content backlog** (12): Card Pops, Re-quip, the listed card ideas, the Time Lord and
  Bureaucrat monsters, and the optional data-driven card spec. Take them one per content
  pass, each with harness evidence.
- **Combat design** (11): stat reform, initiative, crit failures and crit ticks, card
  balance by tier, Team XP, and fight threads.

## Decisions waiting on the owner

These are listed in [22 — Small leftovers](22-small-leftovers.md) and block no code in
Pass A. One short decision session could clear several: device-local vs account-synced
display preferences; raw-event and fight-summary retention; whether a room reset clears
`room_events`; `notable_cards`; the Mocha-or-Vitest question; Apple OAuth; the Discord
display-name source; **Fights** vs **Battles**; and when `/spawn` retires.
