---
type: Agent Guide
title: Subagents
description: Model tiers, dispatch rules, and the review procedure for delegated work.
status: stable
audience: internal
tags: [agents, subagents, review]
---
# Subagents

When and how to delegate work to another agent. Written harness-neutrally: the tier table is
the contract, the model names are examples and will go stale.

## Why delegate

- **Context isolation.** An exploration that reads thirty files costs the orchestrator
  nothing if the reading happens elsewhere and only a summary comes back. The orchestrator's
  context is the scarce resource — when it saturates, it forgets the plan it is holding.
- **Parallelism.** Independent tasks (docs while code, two unrelated subsystems) run at once.
- **Cost.** Mechanical work does not need an expensive model.

The orchestrator still owns the outcome. A subagent's report is evidence, not a result.

## Tiers

| Tier | Work it is for | Suggested models (September 2026) |
|---|---|---|
| 1 — lookup / mechanical | Codebase search, inventories, transcription from a complete spec, single-file mechanical fixes | Gemini 3.8 Flash, Grok 4.6 (fast variants), GPT-5.6 Terra (low/no reasoning), Composer 2.5 Fast, a Haiku-class model if the harness offers one |
| 2 — implement / review | Multi-file implementation from prose, writing tests, task-scoped review | Claude Sonnet 5, GPT-5.6 Terra or Sol (medium), Gemini 3.8 Flash (high reasoning), Composer 2.5 |
| 3 — reason / design / debug / final review | Root-cause debugging, architecture, wording and product judgment, whole-branch review | Claude Opus 5 (thinking high+), GPT-5.6 Sol (high/xhigh), Claude Fable 5.1 (thinking high+) |

Two rules that matter more than the table:

- **Turn count beats token price.** The cheapest tier routinely takes 2–3x the turns on
  multi-step work, and each turn re-reads context. Tier 2 is the floor for anything
  implemented from a prose spec; Tier 1 is for work where the answer is already written down
  and only needs finding, copying, or mechanically applying.
- **Always set the model explicitly.** An omitted model parameter inherits the
  orchestrator's, which is usually the most expensive one available — a "cheap" dispatch
  that silently ran on the top tier is the most common way this goes wrong.

## Harness notes

**Cursor.** Dispatch with the `Task` tool: a `subagent_type` (`explore`, `generalPurpose`,
`debug`, `computerUse`, `bugbot`, `security-review`) plus an explicit `model` slug. Pick the
type for the job shape and the slug for the tier.

**Claude Code.** Subagents run through the Task tool, with reusable definitions in
`.claude/agents/`. Models are chosen by alias — `haiku`, `sonnet`, `opus` — which map onto
tiers 1, 2, and 3 respectively.

**Codex and others.** Use whatever delegation mechanism the harness exposes. If it has no
model parameter at all, compensate by splitting the work: make the mechanical parts small
and completely specified, and keep the judgment in the orchestrator rather than hoping a
fixed model will supply it.

## Procedure

This is what has actually worked on this repo:

1. **Brief and report as files under `/tmp`**, not pasted prose. A brief file can be long,
   precise, and re-read by the subagent; a pasted one gets truncated and costs the
   orchestrator context twice.
2. **Explorers write findings to a file** and return a five-line summary. The orchestrator
   reads the summary and only opens the file if it needs the detail.
3. **One implementer per set of files at a time.** Never two implementers on overlapping
   files — their diffs will not merge and neither will know. Docs-only tasks can safely run
   beside code tasks.
4. **A reviewer after each task**, with the diff handed over as a file, scaled to the risk of
   that diff. Then a **whole-branch review on Tier 3** at the end; task-scoped reviewers
   cannot see cross-task drift.
5. **Keep the plan in the repo, not only in `/tmp`.** A multi-task pass gets a planning doc
   under `docs/roadmap/NN-<pass>.md` — task table (owner tier, status, commit SHAs), binding
   decisions, process rules being tried — updated in the same checkpoint commit as each task
   (AGENTS.md Standing Instruction 6). A compacted or interrupted session resumes from it;
   a `/tmp` ledger is fine as scratch but is gone with the VM.
6. **GUI-testing subagents need a one-shot command path.** Interactive prompt flows stall
   them — they sit waiting for choices they cannot see. Give them commands that complete in
   one step (see the equip one-shot form in
   [`working-in-this-repo.md`](working-in-this-repo.md)).
7. **Verify the artifact exists before trusting the report.** A subagent can return
   "success" having written no file at all; it happened here with a Tier 1 model. Check the
   file, then re-dispatch on a *different* model — retrying the same one unchanged tends to
   fail the same way.
8. **Shared-worktree rules go in every implementer brief.** Stay on the current branch (never
   create, switch or rebase); `git add` only the files you changed (never `-A` or `.`); do
   not push; do not touch the orchestrator's planning doc or other tasks' report files. One
   implementer here created its own branch in the shared checkout and the orchestrator's
   next commit landed on it; the recovery (cherry-pick, delete branch) cost more than the
   task. Reviewers get the stronger form: read-only, no state-changing git at all.
9. **Sequence tasks that share a file, even docs.** `docs/roadmap/README.md`,
   `10b-bugs-fixed.md` and `AGENTS.md` are edited by almost every task (bug entry, status
   line, doc link). Dispatch the next task that touches them only after the previous one's
   fix round has landed. Avoid concurrent `pnpm build` in one worktree — two implementers
   rewriting `dist/` at once produce transient `ERR_MODULE_NOT_FOUND` in each other's tests.
10. **Fix rounds resume the implementer.** Send the review file back to the *same* agent
    (`resume`) rather than briefing a new one: it already holds the codebase context, and
    the review reads as a checklist. Ask for a per-finding response in its report so nothing
    is silently skipped.
11. **Reviews have a fixed shape.** Pass 1 spec compliance against the brief, pass 2 code
    quality; findings as Critical / Important / Minor with `file:line` and the command that
    proves it; verdict `APPROVE` / `APPROVE_WITH_MINORS` / `NEEDS_FIX`; full text to a file,
    a five-line summary returned. Tell the reviewer to run its own sweep (a `rg` over the
    retired words, a probe script against the built engine) rather than reading the diff
    alone — every Important finding on the vocabulary pass came from a sweep, not the diff.
12. **`DONE_WITH_CONCERNS` is a finding.** Read the concern as if a reviewer wrote it. "Frames
    reuse the base map via `sixFrames`" meant the animation had shipped with six identical
    frames and nothing moved.
13. **Re-check live after a fix round that touches timing, rendering or prompts.** Fake-timer
    unit tests passed while the real browser still held the pixel-fight band on screen for
    90 s (#162) — `setTimeout` woke a fraction of a millisecond early, the settle changed
    nothing, and nothing re-armed. Only the live probe caught it.
14. **Provider quota is a failure mode.** Two Anthropic-hosted dispatches failed mid-task on
    usage limits within an hour. Keep a same-tier model from another provider ready (Sol or
    Terra for Sonnet/Opus; Gemini Flash for Haiku), and after any failed implementer check
    `git status` for partial edits before re-dispatching.
15. **Test the real object when the assertion is about that object.** A propagation check
    passed two review rounds against stubs and was dead in production because the real
    character name is masked *and* start-cased before it is stored. Build the real `Game` and
    `Beastmaster` in the test; stubs are for the dependencies around the subject, not the
    subject.
16. **Look at the recording before trusting it.** `x11grab` captures a screen region, and
    Cursor Cloud has two Chrome windows (the `computerUse` one and the CDP test window).
    Raise the test window (`xdotool windowraise <id>`) immediately before recording, then
    sample frames with `ffmpeg -ss` and view them. A video-review model reported 1–2 px
    sprite motion as "static"; a strip of frames 200 ms apart settled it. The reusable
    rooms and the CDP-attach recipe are in
    [`docs/operations/local-testing.md`](../operations/local-testing.md).

## Anti-patterns

- Pasting session history into a dispatch. Write the brief as if for someone who has never
  seen this session, because that is exactly what the subagent is.
- Pre-judging a reviewer's findings ("you'll probably find X"). It biases the review toward
  confirming you.
- Letting a subagent's self-review stand in for review. It reviews the code it just
  rationalised writing.
- Batching a whole roadmap into one commit at the end. Checkpoint per task instead.
