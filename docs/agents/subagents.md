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
the contract. Name a model when you dispatch. The example models in the tier table are dated
guidance, not a whitelist.

## Why delegate

- **Context isolation.** An exploration that reads thirty files costs the orchestrator
  nothing if the reading happens elsewhere and only a summary comes back. The orchestrator's
  context is the scarce resource — when it saturates, it forgets the plan it is holding.
- **Parallelism.** Independent tasks (docs while code, two unrelated subsystems) run at once.
- **Cost.** Mechanical work does not need an expensive model.

The orchestrator still owns the outcome. A subagent's report is evidence, not a result.

## Tiers

| Tier | Work it is for | Example models and effort (September 2026) |
|---|---|---|
| Owner-initiated | The most complex or design-heavy problems, **started only by the owner** | Fable; Opus above medium effort; Sol above high effort; Astra |
| 3 — reason / design / debug / final review | Orchestration, root-cause debugging, architecture, wording and product judgment, whole-branch review | Opus medium, Sol high, or equivalent |
| 2 — implement / review | Multi-file implementation from prose, writing tests, task-scoped review | Sonnet medium, Sol medium, Terra high. Escalate to Sonnet high only when a task needs it |
| 1 — lookup / mechanical | Codebase search, inventories, transcription from a complete spec, single-file mechanical fixes | Luna, Haiku, Grok, and similar cheap models |

The example column goes stale as models change; the ranking rule is the contract. An agent
never escalates itself or a subagent into the owner-initiated tier. Tier 1 models do no
design, planning, or implementation from prose. They find, copy, and mechanically apply.

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

**Claude Code.** Dispatch with the `Agent` tool. Set `subagent_type` (`Explore` for
read-only sweeps, `general-purpose` for implementers and reviewers, `Plan` for design) and
always set `model` (`haiku`, `sonnet`, `opus`), which map onto tiers 1, 2, and 3 at the
effort levels in the tier table. Reusable
definitions live in `.claude/agents/`. Other parameters that matter here:

- `isolation: "worktree"` gives the agent its own git worktree on its own branch. Use it for
  code tasks that run in parallel (see [the orchestrated pass](#the-orchestrated-pass)). The
  agent then commits in its worktree, and the orchestrator cherry-picks the reviewed commit.
  A fresh worktree has no `node_modules` or `dist/`, so the brief must start with
  `pnpm install --frozen-lockfile && pnpm build`.
- `run_in_background: true` returns at once and notifies the orchestrator on completion.
  Do not poll the transcript file; it floods the orchestrator's context.
- `SendMessage` to the finished agent resumes it with its context intact. Use it for fix
  rounds (step 10).
- Claude Code subagents may be refused a write to a "report" or "findings" file. Ask for
  the report as the agent's **final message** instead. Explorers can still write data files
  when the brief asks for data rather than a report.
- In a cloud session, put briefs in the session scratchpad directory rather than `/tmp`.
- A worktree starts from the repository's default branch, not from the orchestrator's
  unpushed commits. A brief that depends on an earlier task's commit must say so. Land that
  commit first, or have the implementer cherry-pick it.
- Parallel agents share one usage quota. When it runs out, every running agent stops at the
  same moment. Their worktrees and uncommitted edits survive, so after the reset, check
  `git worktree list` and each worktree's `git status`. Then resume each agent with
  `SendMessage` and a note of where it stopped. Re-dispatch only the agents that left
  nothing on disk.

**Codex and others.** Use whatever delegation mechanism the harness exposes. If it has no
model parameter at all, compensate by splitting the work: make the mechanical parts small
and completely specified, and keep the judgment in the orchestrator rather than hoping a
fixed model will supply it.

## Procedure

This is what has actually worked on this repo:

1. **Briefs as files in scratch space** (`/tmp`, or the harness scratchpad), not pasted
   prose. A brief file can be long, precise, and re-read by the subagent; a pasted one gets
   truncated and costs the orchestrator context twice. Put the rules every implementer shares
   (worktree rules, verification gate, report format) in one common file that each brief
   references.
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
   [`local-testing.md`](../operations/local-testing.md#staging-a-fight-quickly)).
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
14. **Provider quota is a failure mode.** Two hosted dispatches failed mid-task on usage
    limits within an hour. Keep a same-tier model from another provider ready, and after any
    failed implementer check `git status` for partial edits before re-dispatching.
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

## The orchestrated pass

This is the default shape for a batch of roadmap work. Pass 25 (the roadmap sweep, planned
in [`25-roadmap-sweep.md`](../archive/roadmap/25-roadmap-sweep.md), now archived) worked this way.

1. **Triage before planning.** A read-only Tier 2 explorer checks each candidate item
   against the code. For each one it reports what is already done (with `file:line`), the
   files the item would touch, its size, and what blocks it: a live device, telemetry, or a
   product decision. Roadmap text goes stale. In pass 25 the "build a simulation harness"
   item already existed as `packages/harness/`, and only its coin/XP output was missing.
2. **Choose the tractable set.** Take items that need no device, no production data and no
   open product call, and that do not share files, or can be ordered one after another.
   Record deferred items and the reason for each in the plan's decisions, so the next pass
   does not repeat the triage.
3. **The orchestrator makes the judgment calls.** Wording, product trade-offs, and "is this
   a bug or a contract?" are Tier 3 work. Decide in the plan, then hand the implementer the
   exact decision, such as the replacement copy strings. Do not ask a Tier 2 implementer to
   choose.
4. **Parallel code tasks run in separate worktrees; shared docs stay with the orchestrator.**
   Implementers write draft `10b-bugs-fixed.md` entries in their reports, not in the ledger
   file. The orchestrator applies those entries and the roadmap status changes in each
   task's checkpoint commit. Two tasks that touch the same source file are ordered one after
   the other, never run in parallel.
5. **Review each diff, then land it.** A read-only Tier 2 reviewer gets the diff as a file
   (the procedure's step 11). The orchestrator reads the verdict and spot-checks the
   artifact (step 7). Then it cherry-picks, runs the fast gate on the pass branch, and
   commits the plan update.
6. **Close with a Tier 3 whole-branch review** before the PR. It catches drift across tasks
   that no task-scoped reviewer could see.

## Budget

Usage limits apply per time window, and every agent in a burst draws on the same limit.
Pass 25 ran eight tasks with up to five Tier 2 agents at a time. Each agent reported 200k to
400k tokens, and reviewers 120k to 150k. The pass hit the usage limit twice and had to be cut
short. Usage grew with these multipliers, so cut them first:

- **Keep a pass small.** Four or five tasks per PR, and at most **two or three agents
  running at once**. More parallel agents do not finish sooner once the limit stops all of
  them.
- **Use a fresh worktree only when builds must run concurrently.** Each new worktree pays for
  `pnpm install`, a full build, and often the full test gate. Run docs-only and web-only
  tasks in the shared checkout, one after another.
- **Implementers run only the tests of the package they changed.** The orchestrator runs the
  full gate once, on the pass branch, before the PR.
- **Scale review to risk.** Engine concurrency, room scoping, persistence, and anything that
  touches money deserve an independent reviewer. A copy change, a CSS rule, or a test-only
  change gets an orchestrator read instead. Ask reviewers for probes and mutation tests only
  when the claim they check is load-bearing. PR review (a human, or another harness such as
  Codex) is the backstop for the rest.
- **Bound triage.** Give the explorer a short candidate list and a tool-call budget. The
  pass 25 triage of twelve items took 139 tool calls.
- **Keep briefs lean.** Point the agent at the one or two docs its area needs, not the whole
  trigger table, and ask for a short report.

## Anti-patterns

- Pasting session history into a dispatch. Write the brief as if for someone who has never
  seen this session, because that is exactly what the subagent is.
- Pre-judging a reviewer's findings ("you'll probably find X"). It biases the review toward
  confirming you.
- Letting a subagent's self-review stand in for review. It reviews the code it just
  rationalised writing.
- Batching a whole roadmap into one commit at the end. Checkpoint per task instead.
