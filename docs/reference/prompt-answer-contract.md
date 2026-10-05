---
type: Reference
title: "The `{ question, choices }` Prompt/Answer Contract"
description: How a connector must encode the answer to an engine prompt.
status: stable
audience: internal
tags: [prompts, connectors, contract]
---
# The `{ question, choices }` Prompt/Answer Contract

Read before: adding or changing any `channel({ question, choices })` call site, or any
connector code that answers one.

This document exists because `items/store/buy.ts` and `items/store/sell.ts` disagreed with
it silently for a long time. See `docs/roadmap/10b-bugs-fixed.md` (#143) for the full
incident: clicking "Items" in the shop's buy menu landed the player in the Back Room, and
"sell items" always sold cards. Nothing errored — the menu just routed to a different,
valid-looking destination — because the two flows never wrote down (or followed) the rule
below.

## The rule

When engine code asks a connector a multiple-choice question:

```ts
channel({ question: '...', choices: ['Items', 'Cards', 'Back Room'] })
```

1. **`choices` is an array of option labels, in display order.** The question text is
   rendered with `getChoices` (`helpers/choices.ts`), which numbers them 0-based:
   `0) Items`, `1) Cards`, `2) Back Room`. Every list-style prompt in the engine uses this
   same helper (or a thin wrapper around it — see `getItemChoices`, `getMonsterChoices`,
   `getCreatureTypeChoices`, `getAttributeChoices`, `getFinalItemChoices`). **Never
   hand-write a numbered menu.** A hand-written `1) Foo\n2) Bar` that a different piece of
   code dispatches on is exactly how #143 happened — the label text and the dispatch logic
   had no shared source of truth and drifted.

2. **The engine must accept the answer in either of two forms**, because the two shipped
   connectors do not agree on what they send back:
   - **The 0-based index, as a string.** This is what the web client's `InlineChoices`
     component sends (`apps/web/src/components/InlineChoices.tsx`,
     `onAnswer(requestId, String(idx))`). It's also what `getChoices` prints, so it's the
     "canonical" form.
   - **The option's label text, case-insensitively.** This is what the Discord connector
     sends: its buttons are built with `customId` set to the full label
     (`packages/connector-discord/src/prompt-handler.ts#buildButtonRow`), and the button
     collector resolves with that `customId` verbatim — never an index.

   Resolve the answer with **`resolveChoiceIndex(answer, labels)`**
   (`packages/engine/src/helpers/choices.ts`), which handles both forms and returns `-1` for
   anything else, or use the equivalent label-or-index matching already in
   `items/helpers/choose.ts` for multi-select prompts. Do not write a new
   `Number(answer) === N` comparison — that only works for the web client and silently
   breaks (or worse, mis-routes) Discord.

3. **A menu with a small, fixed set of options must dispatch explicitly on every valid
   index and treat everything else as an explicit, user-visible error** (`announceAndThrow`,
   `helpers/announce-and-throw.ts`). Never let an unrecognised answer fall through to the
   last `if`/`else` branch as a default — that turns "the answer didn't parse" into "silently
   do something the user didn't ask for," which is precisely what made #143 hard to notice:
   the wrong branch still looked like a normal, working menu.

4. **An answer that names nothing is not an empty selection.** A console line is the open
   prompt's answer, so a player who types a command mid-flow ("send Brass to the ring")
   answers the prompt with it. A multi-select prompt that stays open across turns must
   refuse such an answer and ask again, with the flow kept open, rather than read it as
   "finish" or "no cards". Only an explicit finish (`done`, or an empty answer where the
   flow offers one) ends it. The equip flow (`monsters/helpers/equip.ts`) does this; it
   once finished a partial hand and announced "good to go" instead (10b #189). The re-ask
   has no attempt cap because it cannot strand a player: a cancel still aborts it
   (`PROMPT_CANCELLED` passes straight through), and every prompt times out on the bus.

**Descriptions ride in the question, not in `choices`.** The monster type prompt explains each
type with `Label: line` rows in the question text while `choices` stays the bare labels. A
label with a description glued on would stop the Discord button's label answer from resolving.
**A multi-select prompt says what its confirm button does through the question text.** The web
`InlineChoices` shows `Equip n cards` for every "one or more" prompt unless the question
contains `to buy:` (matched as `/\bto buy:/i`), in which case the button is a Buy button and
the word before `to buy:` is the noun: `cards` gives `Buy n cards` (nothing picked: `Buy cards`,
title `Buy the cards you picked.`), `items` gives `Buy n items`, and no noun gives `Buy n`
(`Buy`, title `Buy what you picked.`). The shop's three pick prompts are the constants in
`items/store/buy.ts`: `SHOP_CARD_PICK_QUESTION` (`...following cards to buy:`),
`SHOP_PICK_QUESTION` (`...following items to buy:`) and `SHOP_BACK_ROOM_PICK_QUESTION`
(`...following to buy:`, no noun because the Back Room stocks both). The sell prompts carry no
marker, so they keep the equip wording. No new field rides on the prompt, so Discord and older
clients simply see the sentence, and the answer encoding is unchanged. It used to say `Equip
cards` on a purchase (new-player walk 2), and until roadmap 44 the card pick had no marker and
the Back Room called its stock "items".
**A yes/no prompt has no `choices`; its question ends in `(yes/no)`.** The shop's buy and sell
confirms, the Sorting Hat, `Are you sure?` and the creature edit confirms all work this way,
and the engine accepts only the literal word `yes` (anything else is no). The web
`InlineChoices` detects it as `choices` empty and the question matching `/\(yes\/no\)\s*$/i`,
and shows `Yes` (title `Answer yes`) and `No` (title `Answer no`) buttons that send `yes` and
`no`; typing `yes` still works. A question with choices is never treated as yes/no. Discord and
older clients just see the text. A new yes/no prompt must keep `(yes/no)` at the end of the
question to get the buttons.
**Free-text prompts cannot take an empty answer** (the web Console and Discord will not send
one), so a "take the default" option needs a word to type: the character-name prompt accepts
`ok`, `okay`, `yes` or `y`.

## Where this is enforced today

- `packages/engine/src/helpers/choices.ts` — `getChoices` (and its `getItemChoices` /
  `getMonsterChoices` / etc. wrappers) render the labels; `resolveChoiceIndex` decodes the
  answer against the same labels array.
- `packages/engine/src/items/helpers/choose.ts` — the original precedent for accepting
  either the numeric index or the case-insensitive label, for multi-select item/card
  choosers.
- `packages/engine/src/items/store/buy.ts` / `sell.ts` — the shop menus, fixed to follow
  this contract (previously the counter-example).
- `packages/engine/src/channel/index.ts` — `ChannelCallback` type definition.
- `packages/server/src/events/room-event-bus.ts` — the `prompt.request` / `prompt.answer`
  event pair that carries `{ question, choices }` and the raw `answer` string between the
  engine and a connector over the room event bus.

## Compliant call sites

Every call site that resolves a `{ question, choices }` answer against a small, fixed menu
now goes through `resolveChoiceIndex` and an explicit `announceAndThrow` on `-1`, per rule 2
and rule 3 above:

- `items/store/buy.ts` / `sell.ts` — the shop menus (fixed as #143, the original
  counter-example).
- `monsters/helpers/spawn.ts#askForCreatureType`/`askForGender` — `askForGender`'s original
  ad hoc label-or-index handling (kept as the precedent that motivated generalizing this into
  `resolveChoiceIndex`) now delegates to the shared helper instead of duplicating its logic.
- `characters/helpers/create.ts#askForCreatureType`/`askForGender`/`askForAvatar`.
- `characters/beastmaster.ts#chooseMonster`.
- `creatures/edit.ts#edit`/`editSelf`.
- `items/scrolls/sorting-hat.ts`.

These six were audited as part of #143 and found to already be internally consistent with
the engine's 0-based `getChoices` convention — so they never reproduced #143's off-by-one —
but they resolved the answer as a *pure* index (`array[Number(answer)]`), which only works
for the web client. On Discord, `Number("Basilisk")` is `NaN`, so a button click resolved to
`undefined` (or, for `sorting-hat.ts`, threw a raw `TypeError` on the very next line). Fixed
as #146 — see `docs/roadmap/10b-bugs-fixed.md` for the full root-cause writeup and per-site
test coverage.

Also see `items/helpers/choose.ts`, the original precedent for accepting either the numeric
index or the case-insensitive label, for multi-select item/card choosers (not a
`resolveChoiceIndex` call site itself, since it predates the helper and covers a different
shape — multi-select rather than single-choice — but the same label-or-index principle).
