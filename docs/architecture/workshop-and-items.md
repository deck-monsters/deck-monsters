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
- character-carried and monster-carried items as separate lists.

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
engine path attempts a question. Never add a prompt to an awaited Workshop path. Collect
all answers in the form first, or use the interactive per-user command flow described in
[engine concurrency and timing](engine-concurrency-and-timing.md).

## First-run character creation

Training from the Workshop must also work when the member has no room character.
`characterCreationChoices` returns the engine's pronoun/avatar choices and a display-name
suggestion. `spawnMonster` accepts complete optional character input.

Creation and training run in one serialized mutation. Before calling `Game.getCharacter`,
the router checks the room for a character-name collision because engine creation would
otherwise re-prompt on the silent channel. It supplies every answer the engine can ask:
name, class index, persisted pronoun key, and avatar. If training later fails, the created
character remains intentionally.

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
refresh only that room's inventory, ring state, or shop as applicable. Live private
`ring.xp` events trigger a room-local inventory/shop refresh so wallet rewards do not wait
for polling.

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
