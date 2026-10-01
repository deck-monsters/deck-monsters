---
name: player-help-and-ux
description: Use whenever a change touches anything a player can see or do — a web control, panel, tab or route, a Console command or prompt, an announcement or narration line, a new mechanic, item or card, a Discord slash command, or the handbook — even when the task never mentions help, onboarding or UX. It is the standing order to make the change understandable to someone playing for the first time, and to keep the in-game help complete.
---

# Player help and UX

Deck Monsters is played mostly on phones, by people who join a friend's room and are never
going to read a manual first. Every change a player can see should leave the game at least as
easy to understand as it found it. The owner made this a standing order (2026-10-01) after
roadmap 39 found new players misreading coins as a training price, unable to tell what Sync
did, and waiting forever in an empty ring because nothing said a boss could be summoned.

## When to use

Use it for any change to something a player sees or does. Skip it only for a change no player
can perceive, such as a refactor, a test, logging, or an operator-only script.

## The first-time player test

Before calling the change done, picture someone opening it for the first time, on a phone,
with no one to ask:

1. **Can they tell what it is and what it is for?** A label that reads as a price, a noun
   that reads as a verb, or an icon with no word will be misread. Assume it will.
2. **Do they know what happens if they press it**, including whether they can undo it?
3. **When it refuses, does it say why**, and what to do instead? A disabled control with no
   reason reads as a bug.
4. **When something takes time**, such as a revival, a countdown or a queued fight, does the
   screen say so, and say when?
5. **Is there a next step?** A screen that leaves a new player waiting with no way forward is
   the worst case.

If any answer is no, fix it in the same change. When that isn't possible, record it (see
"Gaps").

## Where help lives

Each kind of help has one home. Put new help there, not in a second place.

| What changed | Its help | Kept complete by |
|---|---|---|
| A web button | A `title` saying what it does (desktop hover and screen readers), plus a visible label that carries the meaning on a phone, where tooltips never show. An icon-only control is fine only when it is universal (☰, ✕, ↓) | `apps/web/src/__tests__/button-titles.test.ts` |
| A tab or surface | Its one line in `apps/web/src/components/surface-descriptions.ts`, used as the tab title and the panel's subtitle | — |
| A Console command | An entry in `packages/engine/src/commands/catalog.ts`. A command that takes a name needs an `example`, which `help <word>` shows | the catalogue tests in `packages/engine/src/commands/help.test.ts`: every entry reaches a real handler |
| A mechanic first met in a fight | Tag the announcing line with `payload.mechanic`, and add a one-line note to `apps/web/src/lib/mechanic-notes.ts` | a test that every ring event has a note |
| The path from joining to a first fight | The guided start: `apps/web/src/hooks/useGuidedStart.ts` and `GuidedStartBox.tsx` | its phase tests |
| Rules, monsters, cards | The generators under `packages/engine/src/build`. Run `pnpm run build:docs`, and never hand-edit `PLAYER_HANDBOOK.md`, `MONSTERS.md`, `CARDS.md` or `DMG.md`. They appear in-game under Help and guides | `root-docs.test.ts` |
| Items | `ITEMS.md` (authored) | — |
| A Discord slash command | Its `setDescription` in `packages/connector-discord/src/slash-commands/`. It must send a catalogue command (bug 212) | the connector tests |

A new kind of control that fits none of these rows is a design decision. Propose a home in
roadmap 39 instead of inventing a one-off.

## Writing the words

- Read [voice and wording](../../../docs/reference/voice-and-wording.md) first. Use its
  lexicon's word for each concept: **train**, not spawn; **fallen**, not dead or KO;
  **your cards** for unequipped cards. Let code handle plurals and pronouns.
- Keep it short. A title is one line. A note is one or two sentences. Lead with what the
  player can do, then why.
- Say what is happening now. Prefer "Reviving… back at 6:42" to a button that still says
  Revive.
- **The orchestrator writes all player-facing prose** (owner rule). A delegated
  implementer uses only the strings in its brief. For anything else it writes a placeholder
  marked `// DRAFT(39)` and lists it under "Strings for Claude" in its report.

## Checking it

- Run the completeness tests above along with the normal gate.
- For a change to layout or flow, check it in a real browser at 390 × 844 and 1440 × 900.
  The [local testing](../../../docs/operations/local-testing.md) guide covers the test rooms.
  Unit tests in jsdom don't lay anything out: bug 210's screen-high gap passed every test.
- When a batch of visible changes is ready, write a checklist with the exact strings for
  Cursor's live check, following
  [39c](../../../docs/roadmap/39c-cursor-batch3-check.md).

## Gaps

When something stays confusing that this change can't fix, add it to
[roadmap 39](../../../docs/roadmap/39-in-game-help.md) (task 5 holds the running list), with
what confuses a new player and where. Don't leave it only in a PR comment.
[Help inventory](../../../docs/reference/help-inventory.md) records what explains each
control today. Update it when you add or remove help for a control.
