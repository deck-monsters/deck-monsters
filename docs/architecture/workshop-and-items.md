---
type: Architecture
title: Workshop and items
description: Inventory, item use, shop stock, and prompt-free workshop mutations.
status: stable
audience: internal
tags: [workshop, items, inventory]
---
# Workshop and items

Read before: changing Workshop inventory, cards, presets, monster lifecycle actions,
item use, shop reads/purchases, or any awaited graphical mutation.

## Boundary

The Workshop is a web input surface over the room's existing engine objects. Text commands,
Discord, and Workshop mutations converge on the same `Beastmaster`, item, card, ring, and
shop methods; React does not own a parallel rules engine.

Player-facing item rules live in [`ITEMS.md`](../../ITEMS.md). This document owns the API,
serialization, and read-model contracts behind those rules.

## Inventory read model

`game.myInventory({ roomId })` validates membership, loads the room's `Game`, resolves only
`game.characters[userId]`, and returns:

- `hasCharacter`;
- each owned monster, current health/XP/ring/revival state, card slots, equipped cards,
  presets, and item summaries;
- the character's unequipped card deck;
- card compatibility used by Workshop placement;
- per monster, its `monsterClass` and `nextCards` (the next level above its own that opens any
  card its type can hold, with the card names; from the engine's `holdableByLevel`), which the
  panel's `At level {n}: {cards}.` line reads;
- character-carried and monster-carried items as separate lists.

## Card details

`game.cardFacts({ roomId })` asserts membership and returns the engine's `allCardFacts()`: every
card's stable name, role, description, stats, level, who can use it and price. The facts are
static (they read the card classes, not the room), so the router builds them once per process
and the web fetches them once (`staleTime: Infinity`). Cards are matched by stable name: a
display name that carries dice (`The Kalevala (1d4)`) loses the suffix first
(`stableCardName` in `apps/web/src/utils/cards.ts`).

Each card in the Workshop has an info button (title `What this card does`) that opens
`CardDetailSheet`: a bottom sheet on a phone and a modest dialog on a wide screen, rendered in a
portal, with focus moved to Close and Escape closing it. The verdict line comes from running the
engine's browser-safe `cardHoldVerdict` against the facts and the monster's level, class and type
(`monsterClass` rides on `myInventory`), so the rule is the engine's and the server does not send
a verdict for every card and monster pair. It is shown for the monster whose panel holds the card;
for a card in Your cards, for the highlighted monster, or for every monster when none is.

Slot labels (`ATTACK`, `AREA`, `HEAL`, `DEFENCE`, `TRICK`) and the slot tint come from the card's
role (`roleOf`), replacing a keyword guess at the name that filed Blink as magic and Take Wing as
utility.

Each item summary includes its display name, expired state, engine-generated use text,
valid monster names, character usability, and whether its action requires another prompt.
Usability comes from engine `canUseItem`; missing or throwing predicates fail closed.

The source list is part of the contract. A type may exist both in the character's pocket
and on a monster. The UI carries `itemSource: 'character'|'monster'` so the engine spends
the copy the player selected.

## Item use and targets

The engine owns source and timing semantics:

- outside an encounter, a target monster can use compatible items it carries and compatible
  items from the character's pocket;
- during an encounter, the pool narrows to that monster's carried items;
- a monster waiting in the ring but not yet in an encounter can still receive a pocket item;
- character-targeting items omit `monsterName`;
- `itemSource` disambiguates duplicate types without changing chat's legacy first-match path.

`canUseItem` is a compatibility predicate, not proof that an action's runtime condition
will succeed. The action result determines `applied`; a no-effect item is not consumed and
the UI must not claim success.

`game.useItem` supplies `confirmed: true` because the web button already obtained deliberate
confirmation. It skips only the engine's generic yes/no prompt. Item selection, source
resolution, encounter narrowing, application, and consumption remain in the engine.

Items whose actions ask their own question declare `requiresPrompt` and stay unavailable
to the prompt-free web mutation. The Sorting Hat currently uses the Console or Discord.

### Outcome narration (`announcements`)

`game.useItem` also returns `announcements: string[]` — the player-facing text the engine's
own `action()` produced for this one call, in publish order. An item narrates by emitting
`'narration'` with the `channel` it was given (`TargetingScroll.action()`'s
`getTargetingDetails()` line, `HealingPotion.action()`'s heal amount, …); the announcements
handler (`announceNarration`) calls that `channel({ announce })` directly rather than
publishing to the bus when a channel is present. `createSilentChannel` accepts an optional
`announcements` array and pushes each `announce` string into it in addition to publishing
the existing private event — the private event (audit trail) is unchanged, this is an
additional, in-memory capture of the same text for the one call that built that channel
instance. Because the channel is constructed fresh per mutation invocation, closed over
that call's `commandId`/`userId`, the array cannot pick up another user's or another room's
narration.

`applied: false` (the item's own runtime condition was not met) means the action returned
early and emitted no narration, so `announcements` is `[]` in that case — the Workshop uses
`applied` first and only reads `announcements` when the item actually acted. A caller that
supplies no collector (every other `createSilentChannel` call site) is unaffected; the
parameter is additive. Some items also emit a second, un-channeled narration line straight
to the public feed (e.g. the Lottery Ticket's celebratory line) — that one bypasses this
collector by design, since it is already visible in the room's feed.

## Prompt-free mutation rule

Workshop and Ring action mutations are awaited HTTP operations, so they must be short and
must never call `channel({ question })`.

`runSerializedMutation(roomId, userId, fn)`:

1. rejects if that user has an interactive console flow in the room;
2. synchronously acquires a `roomId:userId` prompt-free ownership token so a second
   same-user mutation fails fast;
3. runs the operation in the room-wide engine lane;
4. releases the token in `finally`.

The room-wide lane serializes shared room resources such as ring membership and shop stock.
`createSilentChannel` publishes private announcements for the audit trail and throws if an
engine path attempts a question. A mutation that publishes its own summary line (equip,
unequip, unequip all, unequip many, move, move many, reorder) passes `publish: false`, so the
Console gets **one line per Workshop action**: the summary, which names any skipped or failed
cards and why. A move that stops short (a full hand, a card the monster cannot hold, the copy
limit) returns `blockedBy` from `Beastmaster.moveCard`, and the move summaries carry it, since
the engine's line that said so is no longer published. Publishing both printed an equip twice and a batch move as a line per card type plus
the summary, which a player read as the game moving cards on its own (10b #195). Never add a prompt to an awaited Workshop path. Collect
all answers in the form first, or use the interactive per-user command flow described in
[engine concurrency and timing](engine-concurrency-and-timing.md).

## The guided start in the Workshop

After the first-run form, the Workshop shows the same getting-started box as the Console,
under the Train row and above the monsters, for every step except `spawn` (the wizard already
covers training). Both surfaces read `hooks/useGuidedStart.ts`; the box is
`components/GuidedStartBox.tsx` (the Workshop version has words only, no chips). It is hidden
while a Console flow is in progress, like the Workshop's other controls. The steps, the
shared dismissal flag and why "established" is decided once are in
[web workspace](web-workspace.md#the-getting-started-guide).

## First-run character creation

Training from the Workshop must also work when the member has no room character.
`characterCreationChoices` returns the engine's pronoun/avatar choices and a display-name
suggestion. `spawnMonster` accepts complete optional character input.

Creation and training run in one serialized mutation. Before calling `Game.getCharacter`,
the router checks the room for a character-name collision because engine creation would
otherwise re-prompt on the silent channel. It supplies every answer the engine can ask:
name, class index, persisted pronoun key, and avatar. If training later fails, the created
character remains intentionally.

New characters start with 30 coins (`STARTING_COINS`, `characters/helpers/create.ts`). It is
set in `createCharacter` only, never on hydrate: `creatures/base.ts` still defaults a missing
`coins` to 0, so saved characters keep what they have. Boss and harness characters are built
in `characters/helpers/random.ts`, not `createCharacter`, so they get none and sims are
unaffected. An owner room reset re-creates characters with 30 each; that is fine because the
reset wipes everything else.

The Console path asks the same question the form does. `Game.getCharacter({ askName })`
(set by `commands/index.ts`, not for admin aliases) hands the display name to
`createCharacter` as `suggestedName` instead of `name`, so a new player is asked, before
pronouns, `What should we call you? Type a name, or type ok to be {suggested}.` The answer
`ok`, `okay`, `yes`, `y` (any case) or an empty one takes the suggestion. The word exists
because neither the web Console nor Discord can send an empty message, so "take this one"
needs something to type. The suggestion gets the typed name's clean-up (control characters
stripped, trimmed, `CHARACTER_NAME_MAX_LENGTH` = 40). If it is empty after that, or already
another character's name, the question is `What should we call you? Type a name.` with no
`ok`; after a clash it is re-asked in that form, so the taken name is never offered again.
Callers that supply `name` (the Workshop, the Discord slash commands) are never asked. Before
roadmap 39 the Console silently used the display name, which is how a player ended up with a
name they never chose.

## Training: type descriptions and place count

Each monster type has one line in `MONSTER_TYPE_SUMMARIES`. The classes' own `description` is long lore, so it is not reused.
The Workshop reads the line from `spawnOptions` (`types[].summary`) and shows it under the
Type select; the Console prompt puts `Label: line` rows in the *question text*. The lines are
not in `choices`: choices are the labels an answer is matched against
([prompt answer contract](../reference/prompt-answer-contract.md)), and a label with a
description glued on would stop the Discord button answer from resolving. The lines live in
`monsters/helpers/type-summaries.ts`, one source for both paths.

`Beastmaster.spawnMonster` opens with `You can train {n} more {monster|monsters}.` and, with
no places left, refuses with `Every place at your side is taken ({slots} {monster|monsters}).`,
the Workshop Train row's wording.

## Training: the wizard

The Workshop's Train monster button opens `components/TrainWizard.tsx`, one question per
screen (About you on a first run only, then Type, Pronouns, Name, Look, Ready), replacing the
old one-screen form. It still sends the same `spawnMonster` input; only the gathering changed.
All answers live in the wizard, so Back keeps them. A server refusal returns the wizard to the
step at fault (`stepForError`: a taken monster name goes to Name, a taken character name to
About you) instead of closing it.

- Type cards read `spawnOptions` (`types[]` carries `summary`, `class` and `signatureCard`).
- The Look step reads the engine's look table (`monsters/helpers/looks.ts`, browser-safe:
  `lookEntry`, `lookQuestionShort`, `lookPreview`), the same table the Console's
  `askForColor` reads. It previews the look line only; the rest of the description is drawn
  when the monster is made.
- Name suggestions come from the room-scoped, membership-checked `suggestMonsterNames`
  query ({ roomId, type, gender }), because `fantasy-names` is Node-only. It skips names
  taken in the room. `chooseName` compares taken names case-insensitively: the room's lookup
  keys are lowercased, and an exact match used to let the Console re-suggest a taken name.

## Card moves say why

`Beastmaster.equipCards` and `loadPreset` return `skipped: [{ cardName, reason }]` (reason is
`cannot_hold` class restriction, `deck_full`, `max_copies`, or `not_in_inventory`) plus
`cardCount` and `cardSlots`, the deck after the call; the router passes them through.
`characters/helpers/equip-message.ts` is the one home for the reason texts, the refusal
sentence (`{Card} can't go on {Monster}: {reason}.`) and the result line
(`Equipped {Card} on {Monster}. {Monster} holds {k} of {slots} cards.`, or `Equipped {n} cards
on ...`). The engine's announce, the server's private announcement, the Workshop's equip and
preset messages all call `equipResultMessage`, so they cannot drift; one sentence is written
per distinct card and reason, not per copy. The old `(1/1)` was cards equipped of cards
requested in that one call, not the deck. The pre-tap hint on a monster panel uses
`cardRefusalReason` (also `fighting`), which checks in the order `equipCards` does: fight, free
slot, class, copies. A `cardSlots` of 0 is the server's fallback for an unreadable record and
means unknown, not full. `loadPreset` checks copies before class, so its reason can differ
from the hint's when a card fails both. Monster-to-monster moves already carry the engine's
reason text and are unchanged.

Before a character exists, the Workshop leaves `game.shop` off: it answers `NOT_FOUND`
without a character, and polling it made a first-run room look broken (10b #188). The
query turns on when `myInventory` reports `hasCharacter`. The "Applying changes…" banner
and the disabled buttons follow in-flight mutations and console flows only, never a
background refetch.

## Room shop and optimistic stock token

Every room owns `Game.shop`; reads and purchases never use a module singleton.
`game.shop` validates membership and serializes the read because accessing an expired shop
may rotate and persist stock.

A direct purchase submits:

- shop closing time;
- section (`items`, `cards`, or `backRoom`);
- stock index;
- expected item/card type.

Inside the room-wide mutation lane, `purchaseShopItem` rereads the current room shop and
checks that tuple before charging. If the shop rotated or another player bought that slot,
the mutation refuses and asks for a refresh instead of silently buying a different item.
Cards enter the character deck; items enter the character inventory; `commitShop()` stores
the remaining room stock.

### Selling

`sellShopItems` (server) runs `sellToShop` (`packages/engine/src/items/store/sell-to-shop.ts`)
on the same prompt-free, room-wide mutation lane as `buyShopItem` — the counterpart the item
follow-ups roadmap called "Web selling". It mirrors the console's guided `sellItems`
(`items/store/sell.ts`) exactly, and both now share pricing through `sell-pricing.ts`
(`getSalePrice`/`getSaleTotal`, `round(cost * shop.priceOffset)`) so a console sale and a web
sale of the same items in the same shop can never disagree.

A selection names a `section` (`items` or `cards`), a `type` (display name, matched the way
the console's named-answer path matches — case-insensitively, via `getItemKey`), and a
`count`. `sellToShop` only ever reads `character.items` and `character.cards` — the
character's own pocket and unequipped deck. A card currently equipped onto a monster's deck,
or an item a monster is carrying, has already left those two arrays (see the inventory read
model above), so there is nothing left to explicitly refuse: the console flow can't sell them
either, for the same reason. Ownership is re-validated inside the mutation (not trusted from
whatever the client last rendered), and an under-count selection refuses the whole call rather
than selling a partial quantity.

Both `sellToShop` and the console's `sellItems` remove the sold card via
`items/helpers/remove-card-from-pool.ts` (splice `character.cards` by identity, then mirror
`removeCard`'s persistence signal and `cardRemoved` event), never via `character.removeCard`
directly. `Beastmaster.removeCard` also calls `monster.resetCards({ matchCard })` on every
owned monster, which clears a monster's *entire* hand if it holds any card that is
JSON-identical to the one being removed — a value check, not an identity check, so a plain
`Hit` on a monster's equipped deck matched a completely different `Hit` instance being sold
from the unequipped pool. That override exists for `removeCard` callers that actually need it;
selling never does, since an equipped card was already spliced out of `character.cards` by
identity when it was equipped (see the inventory read model above) — there is never a
monster's card to reconcile from here. See `docs/roadmap/10b-bugs-fixed.md` #182.

Like `purchaseShopItem`, the shop is re-read inside the serialized mutation and the closing-time
token is revalidated before crediting coins: the price paid is `shop.priceOffset` *now*, not
whatever a stale confirmation dialog displayed, and a rotated shop asks for a refresh instead
of silently selling at a rate the player never confirmed. Sold cards/items are appended to the
current room shop's stock (so another player can buy them back) via the same `commitShop()`
call purchases use.

The Workshop's Sell section groups the character's own items/cards by display name (mirroring
how the shop's own stock groups identical listings) so selling several of one type is one
row with a quantity, not one row per copy. `myInventory` exposes each item's raw `cost` and
each unequipped card's cost (`cardCosts`, keyed by display name); the `shop` query exposes
`sellOffset` (`shop.priceOffset`, read inside its existing serialized lane — selling price
preview never gives `myInventory` its own reason to read `game.shop`). The Workshop combines
`cost * sellOffset` to preview a price and show the confirmation dialog; `sellToShop` computes
the authoritative price the same way, from the shop it re-reads at commit time.

## Client invalidation

Every Workshop query and invalidation includes the active `roomId`. Successful mutations
refresh only that room's inventory, ring state, or shop as applicable.

There is no Sync button. The Workshop refreshes (inventory, `myMonsters`, and the shop once a
character exists) from these triggers:

- the 30 s poll on `myInventory` and `shop`;
- every Workshop mutation, and coins arriving;
- a private `ring.xp` event, which the room sends the moment a fight the player was in pays
  out (this also covers level-ups, which come from the same XP);
- the tab or window regaining focus (`refetchOnWindowFocus` on both queries);
- a timer the panel sets for the soonest running revival (`revivesAt` + 1 s). No room event
  reaches the web when a revival timer fires (the engine's `respawn` is a creature emit,
  not a bus event), so the panel schedules its own refresh.

## Workshop header, Train row and Shop labels

Coins are shown in the Shop only; the header carries no balance (a new player read it as
the price of levelling up the monster beside it, roadmap 39a). "Train monster" has its own
row with a line built from `myInventory.monsterSlots` (the engine's `Beastmaster.monsterSlots`,
never below the roster size) minus the monsters listed: the free-places sentence, or "Every
place at your side is taken (1 monster / n monsters)." with the button disabled (Cancel stays
usable if the form is already open). A first-run player (no character) gets
the plain button. On a phone the header stays a row, with the pane's ⤢ link top-right, and the
Train row stacks with the sentence at its natural height (bug 210) and the button at its own width, left-aligned (owner). A shop price of 0 reads **Free**, with its own confirm and success text.
A fallen monster with a running revival (`revivesAt`, set only once `respawn()` starts, never
merely on death) shows a disabled **Reviving…** button and `Fallen · back at {local time}
({relative})`, where `{relative}` is `formatRelativeFromNow` ("in 12 min", "in 2 h 15 min").
Under 60 s it reads `Fallen · back in {s} s` (never above 59, ticking every second), and once
the time has passed but the client has not refetched, `Fallen · almost back`.

Server validation remains authoritative. Optimistic UI must roll back or refetch when
state changes between render and mutation.

## Change checklist

- [ ] Membership is checked before reading or mutating a room character.
- [ ] Inventory and item source remain room- and viewer-scoped.
- [ ] React consumes engine-projected compatibility; it does not recreate item rules.
- [ ] Awaited mutations cannot ask a question.
- [ ] Shared ring/shop work stays in the room-wide lane.
- [ ] First-run creation supplies every answer and pre-checks name collision.
- [ ] Purchases revalidate the complete optimistic stock token in the mutation lane.
- [ ] Sales revalidate ownership and the closing-time token in the mutation lane, and price
      through the shared `sell-pricing.ts` helper, not a re-derived formula.
- [ ] Cache invalidation carries the same `roomId` as the mutation.
- [ ] Player rule changes update [`ITEMS.md`](../../ITEMS.md).
