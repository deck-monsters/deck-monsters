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
5. **Keep a progress ledger file** so a compacted or interrupted session can resume without
   re-deriving what is done.
6. **GUI-testing subagents need a one-shot command path.** Interactive prompt flows stall
   them — they sit waiting for choices they cannot see. Give them commands that complete in
   one step (see the equip one-shot form in
   [`working-in-this-repo.md`](working-in-this-repo.md)).
7. **Verify the artifact exists before trusting the report.** A subagent can return
   "success" having written no file at all; it happened here with a Tier 1 model. Check the
   file, then re-dispatch on a *different* model — retrying the same one unchanged tends to
   fail the same way.

## Anti-patterns

- Pasting session history into a dispatch. Write the brief as if for someone who has never
  seen this session, because that is exactly what the subagent is.
- Pre-judging a reviewer's findings ("you'll probably find X"). It biases the review toward
  confirming you.
- Letting a subagent's self-review stand in for review. It reviews the code it just
  rationalised writing.
- Batching a whole roadmap into one commit at the end. Checkpoint per task instead.
