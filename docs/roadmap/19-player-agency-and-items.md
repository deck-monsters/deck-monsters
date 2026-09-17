# Player Agency, Items, and the Empirical Case

**Category**: Design / Mechanics
**Priority**: Medium — the items audit (§3) is actionable now; the rest needs the balance sim harness
**Status**: 🔧 Active — item documentation, Workshop use, the live ring affordance and the
room shop have shipped; the feedback loop, prompt-free spawn, web selling and the one
prompt-driven item remain

This doc exists because a research pass on what makes tabletop RPGs enjoyable was brought
into the project, and applying it to an auto-battler turned out to need a clearer statement
of what Deck Monsters' fun actually *is*. The mechanics proposals follow from that.

---

## 1. The design frame: commitment, then surrender

Deck Monsters is hands-off during a fight on purpose, and the pleasure is closer to a bet
than to a battle. You do the thinking up front — which cards, in which order, on which
monster — and then you release it and cannot intervene. The strategy is real and grows
with level as the card pool opens up; the outcome is not yours to steer.

**This is a feature, and it should be protected rather than "fixed".** The obvious reading
of the motivation literature is that a player with no moment-to-moment control lacks
autonomy and will enjoy the game less. That reading is wrong, and the distinction matters
enough to write down: Self-Determination Theory's autonomy need is about **volition** —
acting from your own choices — not about continuous control. A deck you agonised over is a
high-autonomy act. The fight is the consequence of it.

What the frame does imply is that **the build phase has to carry the whole weight of
agency**, because it is the only place agency lives. Anything that makes deck-building
shallower, or that hides the connection between a build decision and a fight outcome, costs
more here than it would in a game where you could compensate with live play.

---

## 2. What the research supports, and how far it transfers

Source: *What Makes D&D Fun for Kids — Evidence-Based Revisions to a Family Starter Kit*
(internal research pass, Sept 2026), summarising Self-Determination Theory, flow theory,
TTRPG player-experience work, and practitioner accounts.

**Transfers well.** The strongest source — Ryan, Rigby & Przybylski, "The Motivational Pull
of Video Games" (*Motivation and Emotion* 30(4), 2006) — is **video-game** research. For the
kids' tabletop kit it was an extrapolation; for us it is closer to the original setting. Its
finding is that autonomy, competence and relatedness each independently predict enjoyment.

- **Autonomy** → deck-building (§1). Already strong.
- **Competence** → the felt experience of getting better. The research flags this as the
  need most often under-weighted, and it is where Deck Monsters has the most unclaimed
  ground: the game records a great deal about a monster and shows the player almost none of
  it.
- **Relatedness** → a shared room watching the same fight. Already strong.
- **Attachment** (from Liapis & Denisova's TTRPG-PX components, and the single most
  consistent finding in the practitioner accounts) → named monsters, individual
  descriptions, permadeath, per-monster records. Strong foundations, thinly surfaced.

**Does not transfer.** Roughly half the source document is about running a table for
6–8-year-olds with a human DM: tactile puzzles, picture menus for non-readers, the Three
Clue Rule, "say yes or roll the dice". We have no DM, no puzzles, and adult players. Those
findings are not evidence for anything here and should not be cited as if they were.

**Caveats to carry.** The document rates its own kids'-play evidence as "observed pattern,
not proof" and notes the player-type taxonomies are heuristics, not validated instruments.
Treat the SDT spine as load-bearing and everything downstream as a hypothesis worth
testing — ideally against the balance sim harness (`11-balance-and-mechanics.md`) rather
than shipped on faith.

---

## 3. Items: the lever that already exists

**Finding: items are the one real-time control in the game, and the web client has no
surface for them at all.**

### What is already true

- **Items are usable mid-fight, deliberately — but only the ones the monster is already
  carrying.** This was first written up as "items are usable mid-fight" full stop, which is
  wrong in a way that changes the whole design, so the correction is recorded rather than
  quietly patched.

  `beastmaster.useItems` carries no `inEncounter` guard, where `equipMonster`, `moveCard`,
  `giveItemsToMonster`, `takeItemsFromMonster` and `reviveMonster` all refuse. **The guard
  exists one level down.** `items/helpers/use.ts` builds the usable pool from
  `monster.items` alone while `monster.inEncounter`, adding the character's own items only
  when the monster is *not* in an encounter — and `items/helpers/transfer.ts` refuses to
  move items to or from a monster in an encounter.

  So: **what a monster carries into the ring is what it can use.** Mid-fight use is
  intended and balanced around (owner, Sept 2026), and the in-game handbook already says
  so — *"Items used mid-battle must be pre-assigned to the monster before the fight"* —
  which is accurate.

  This makes the design better, not smaller. Stocking a monster before it fights is a
  commitment decision in its own right, exactly like building its deck: the real-time lever
  is bounded by foresight. That is the commitment-then-surrender frame (§1) applied twice,
  not an exception to it.
- **Targeting is already player-controlled, via scrolls.** `items/scrolls/targeting.ts`
  sets `monster.targetingStrategy` in its `action()`, and there are seven strategies shipped
  — Cobra Kai, House Lannister, Sir Robin, Parsifal, Qin Shi Huang, La Carambada, Chaos
  Theory — each with an "according to Clever Hans" variant, plus the Sorting Hat. The
  strategy then prints on the monster's stat card as `Strategy: …`.
- **The inventory is substantial**: ~5 potions (healing, Pokécen, spin-up, two chocolate
  bars) and ~15 scrolls, with rarity and cost tiers.

### What is missing

- **No web UI whatsoever.** `InventoryPanel.tsx` is the deck workshop — cards only. There is
  no item list, no use affordance, no quick action, and `use <item> on <monster>` does not
  appear in the command reference. On the web the entire item system is discoverable only by
  already knowing it exists.
- **The use flow fights the clock.** `useItems` routes through `chooseMonster`, an
  interactive prompt. Using a healing potion during a fight means noticing low HP on the
  roster, typing a command, and answering prompts while the fight advances on its own
  timers. The mechanic is real-time; the interface is not.
- **No feedback loop.** Nothing tells a player that an item *would have* helped, or that a
  targeting scroll changed an outcome.

### Proposals

1. **Surface items in the web client.** An items panel beside the deck workshop, and a
   one-tap "use" affordance on the ring pane while a fight is live. This is the highest
   value-to-effort item in this doc: the engine, the commands and the persistence all exist.
2. **Make mid-fight use a first-class action.** The flow should be one tap from the ring
   pane with no prompt chain: today it routes through `chooseMonster`, an interactive
   prompt, so using a healing potion means noticing low HP, typing a command and answering
   questions while the fight advances on its own timers. The mechanic is real-time; the
   interface is not. Any change to *how much* can be used (a per-fight budget, say) is a
   balance change and wants the sim harness — but removing the prompt chain is not, and
   should not wait for it.
3. **Document mid-fight use as a rule of the game, not an implementation detail.** Now
   settled as intended (above) and recorded at the call site. What remains is player-facing:
   nothing in the help text, the command reference or the web UI tells a player that items
   are the one thing they can still do once the fight starts. That is the single most
   valuable piece of missing documentation in the game, because it is the mechanic most
   likely to be missed entirely.
4. **Surface the pre-fight stocking decision.** Since a monster can only use what it
   carried in, "give items to this monster" is a build-phase decision with the same weight
   as equipping cards — and the workshop does not mention items at all. This is a stronger
   argument for the items panel than convenience.
5. **Teach targeting scrolls.** They are the most interesting strategic item in the game and
   are nearly invisible. Surfacing the current `Strategy:` on the roster, and explaining what
   a scroll changed when it is read, would make an existing system legible.

---

## 4. Competence and attachment: surfacing what the game already records

Both are cheap, because the data exists and is simply not shown.

1. **Per-monster records** — best hit, longest win streak, nemesis (the monster that has
   beaten it most). `announceHit` now publishes `damage`/`assailantName` (10b #110), so best-hit
   tracking has a source. Competence made visible.
2. **A memorial for the dead.** Permadeath currently just removes a monster. A graveyard
   listing what each one did is the cheapest possible attachment feature, and permadeath is
   what gives it weight.
3. **Earned titles** derived from what a monster actually did ("the Thrice-Fled", "Boss-Slayer"),
   rather than assigned. Attachment and competence in one.
4. **Reward mix.** The practitioner finding that "things" beat money is the weakest transfer
   in this doc — it is an observation about children — but the underlying point, that a named
   card drop is more memorable than a coin total, is worth testing against the drop tables.

---

## 5. What not to do

- **Do not add live combat control beyond a bounded item action.** It would dissolve the
  frame in §1, which is the thing that makes this game itself.
- **Do not cite the kids'-play findings as evidence for adult player behaviour.** Cite SDT
  for the motivational claims and mark the rest as hypothesis.
- **Do not ship balance changes from this doc without the sim harness.** See
  `11-balance-and-mechanics.md`.

---

## 6. The workshop as a monster-management hub

**Decision (owner, Sept 2026): the workshop becomes where a web player manages monsters** —
decks, spawning, reviving, sending to the ring, plus items and the shop. The console stays
for power users and for Discord parity, but a web player should never need to know a command
exists. That is the target; the steps below are ordered by confidence, not by size.

Today the workshop is cards-only, and everything else is a typed command.

### Shipped

- **Tapping a monster now scrolls the inventory into view.** The tap already set
  `activeMonsterFilter` and filtered the inventory to compatible cards — but the inventory
  sits below the monster row and is off-screen on a phone, so the filter applied where the
  player could not see it and the tap read as doing nothing. Respects
  `prefers-reduced-motion`.
- **An explicit "Equip N to `<monster>`" button** appears when a monster is highlighted and
  cards are selected. Drag-and-drop and tap-a-slot both worked already, but neither
  announces itself; on a phone the only discoverable way to equip was to know the gesture.
- **Revive and send-to-ring are typed Workshop actions.** Both validate room membership,
  resolve the authenticated player's character, serialize through the prompt-free mutation
  lane and delegate eligibility to the engine. Send-to-ring confirms the monster and room. Its confirm-then-fail case — any other owned monster already in the ring, or a dead contestant still awaiting cleanup — is now caught client-side, disabling the button with the reason rather than failing after the confirm; see `10b-bugs-fixed.md` #115.

### Next, in order

1. **Items panel + a use affordance on the ring pane. Shipped.** The Workshop supports
   preparation and the Ring exposes only the fighting monster's carried, usable items.
2. **Finish lifecycle actions: prompt-free spawn.** Revive and send-to-ring have shipped;
   spawn still needs an authoritative non-interactive engine operation rather than replaying
   the console prompt flow from React.
3. **Shop. Shipped for browse and buy.** The Workshop shows the room merchant, rotation,
   coins, ownership, affordability and back-room stock. Purchases revalidate an optimistic
   stock token inside the room mutation lane. Selling remains a guided console operation.
4. **Command reference parity.** Every action the workshop gains should also be listed as
   the command it maps to, so the console stays learnable rather than becoming legacy.

---

## 7. Spec: the item list

### Sort, do not filter, and never add a mode

The obvious designs are "show only what I can use now" or "show everything". A toggle
between them was considered and **rejected**: a toggle is a *mode*, and this list's primary
home is the ring pane during a live fight. If you open it in the wrong mode you pay to
notice and pay again to correct, at the one moment the game gives you no slack. Modes are
worst exactly where this one would live.

The workshop already solved the same problem a third way. `isCardUnavailable` does not hide
incompatible cards — it renders them at `opacity: 0.35` with a dashed border
(`.workshop-card-slot.incompatible`) and puts a count in the header,
*"Showing cards usable by Stonefang (3/12)"*. Nothing is hidden, so you still learn what
exists; what you can act on is unmistakable at a glance; and there is no control to operate.

**The item list follows that pattern, plus an ordering.** One list, sorted, dim what does
not apply:

| Tier | Meaning | Rendering |
|---|---|---|
| 1 | Usable now on a valid target | Full opacity, tappable |
| 2 | Owned, but not usable here | Dimmed, not tappable, reason on hover/long-press |
| 3 | Spent | Dimmed further, "All used up!" |

Header count reads *"4 usable now (9 items)"*.

Tier 3 earns its place: a spent scroll should not vanish, because "you had this and it is
gone" is information, and it is exactly what a filter would throw away.

### The predicates already exist

- **Usability**: `monster.canUseItem(item)` and `character.canUseItem(item)`, used by
  `items/helpers/use.ts` to build the selectable list. The UI should use the same predicate
  rather than inventing a parallel rule.
- **Spent**: `item.expired` — a derived getter, `used >= numberOfUses`
  (`items/potions/base.ts`). Expired items **stay in inventory**; `item.stats` renders
  `'All used up!'`. So tier 3 is real and reachable, not hypothetical.
- **Uses left**: `item.stats` already renders "Usable 1 time." / "N times", so the list has
  a ready-made secondary line.

### Mid-fight flow

One tap, no prompt chain. Today `use <item> on <monster>` routes through `chooseMonster`,
an interactive prompt, so using a healing potion means noticing low HP, typing a command
and answering questions while the fight advances on its own timers. Tapping an item in
tier 1 should resolve target and item together and dispatch directly.

Removing the prompt chain is **not** a balance change and should not wait for the sim
harness. Changing *how much* can be used (a per-fight budget) is, and should.

### Resolved: what counts as tier 1 mid-fight

**Tier 1 requires `canUseItem` AND a target the engine will actually accept right now.**
Outside a fight: any owned monster, drawing on both the monster's items and the character's.
**During a fight: only items the fighting monster is already carrying** — `use.ts` excludes
the character's own items while `inEncounter`, so a pocket healing potion is genuinely not
usable, and showing it as tier 1 would be a lie the engine then refuses.

**The gate is `inEncounter`, not `inRing`** — a distinction worth keeping straight. A monster
waiting in the ring for the next fight to start is *not* in an encounter, so pocket items
still reach it. The window closes when the fighting does, not when it steps in.

A benched monster, and any item in the character's pocket during a fight, drop to tier 2 —
dimmed, still listed, with the reason shown.

This is a *sort*, never a prohibition. The `use <item> on <monster>` command keeps working on
any monster it always worked on; the list only changes what it puts in front of you. That
distinction is the whole reason the spec sorts rather than filters, and it must survive
implementation.

Owner framing, worth keeping: using an item on a monster outside the ring mid-fight is
"technically fine but in practice odd and likely a mistake". So tier 2 during a fight should
say **why** it is dimmed — "not in the ring", or "not carried into the ring" for a pocket
item — rather than being silently greyed. A dimmed
row with no reason reads as a bug; a dimmed row with a reason reads as the game looking out
for you. The tap should still be possible for the player who means it.

### Data the list needs, and what the API gives it today

**Shipped (server side).** `myInventory` (`summarizeInventory`, `packages/server/src/trpc/router.ts`)
now returns items as `ItemSummary` objects instead of bare name strings:

```ts
type ItemSummary = {
	displayName: string;
	expired: boolean;
	stats: string; // engine's own "Usable 1 time." / "N times" / "All used up!"
	usableOnMonsters: string[]; // player's monster names that pass canUseItem(item) right now
	usableOnCharacter: boolean; // character.canUseItem(item), for usableWithoutMonster items
};

items: {
	character: ItemSummary[];
	monsters: Array<{ monsterName: string; items: ItemSummary[] }>;
};
```

Usability is computed **server-side**, once, via a `canUseItemSafe(entity, item)` helper that
calls the entity's own `monster.canUseItem(item)` / `character.canUseItem(item)` — the same
predicate `items/helpers/use.ts` uses to build its selectable list — so there is one
definition of "usable" and the client never reimplements the rule. `InventoryMonsterSummary` already carries `inRing`.

**Deriving the tiers — note which list an item came from.** The summary separates
`items.character` from `items.monsters[].items`, and that separation is what encodes the
mid-fight rule above: while a monster is in an encounter, only items in *its* list are
usable at all. So:

- **tier 1, during a fight**: the item is in `items.monsters[<fighting monster>].items`,
  `usableOnMonsters` includes that monster, and it is not `expired`. A `items.character`
  item is **never** tier 1 during a fight, whatever `usableOnMonsters` says — `use.ts` will
  refuse it, and offering a tap that the engine then rejects is worse than dimming it.
- **tier 1, outside a fight**: either list, `usableOnMonsters` includes the chosen monster.
- **tier 2**: usable in principle but not right now — a pocket item during a fight, or a
  benched monster's item. Show the reason.
- **tier 3**: `expired`.

`usableOnMonsters` answers "can this item apply to this creature", which is necessary but
not sufficient; the list an item lives in answers "can it be reached from here".

**Shipped**: `apps/web/src/utils/item-tiers.ts` implements this as a pure, tested classifier
(tier, reason string, sort), and `components/ItemsPanel.tsx` renders it inside the workshop —
the first time the workshop has mentioned items at all. Display-only for now: there is no
`use item` tRPC procedure, and inventing one was out of scope. That is the next step, along
with the ring-pane affordance (§7 "Mid-fight flow").

Degradation, matching `canMonsterHoldCard`'s existing style: a missing `canUseItem` degrades to
`false` (never claim an item is usable when the engine can't confirm it — this drives a live
tap-to-use affordance, so a false positive is worse than a false negative, unlike card-slot
compatibility which degrades to `true`). A missing `expired` degrades to `false`. A missing
`stats` getter degrades to `'All used up!'` when `expired` is true, else
`'Usable an unlimited number of times.'`. `canUseItem` throwing is caught and treated as `false`.

**Still open (web side).** `apps/web/src/hooks/useDeckWorkshop.ts` has its own local
`InventorySummary`-shaped type with `items: { character: string[]; monsters: [...] }` that
needs updating to the shape above, plus the actual three-tier item list UI (tap affordance,
dimming, reason text) described in this section. Not done in this change — see the router
change for the server half.

---

## 8. State at the end of the September 2026 session

**Shipped**
- Items are documented for players at last, in both the engine help and the web command
  reference — including the constraint, after an earlier draft stated only the headline and
  taught the opposite (`10b-bugs-fixed.md` #111).
- `myInventory` returns `ItemSummary` objects (name, `expired`, `stats`, `usableOnMonsters`,
  `usableOnCharacter`) with usability computed server-side by the engine's own `canUseItem`.
- `utils/item-tiers.ts` — pure, tested tier classifier and sort, implementing §7.
- `components/ItemsPanel.tsx` — mounted in the workshop, which had never mentioned items.

- **`game.useItem`** — the prompt-free tRPC procedure, following the
  `reviveMonster`/`sendMonsterToRing` pattern (`runSerializedMutation` + silent channel +
  `assertMember`). An absent `monsterName` means "use on the character"; the engine skips
  the monster lookup entirely in that case.
- **The prompt chain is gone for API callers.** `items/helpers/use.ts` takes `confirmed`,
  which skips *only* the "Are you sure?" question. That question was unconditional — it
  fired even when the item was named explicitly — and it is what made item use impossible
  from a mutation, where no prompt can be answered. Discord and the console still ask.
  Which items are usable, and the mid-fight narrowing to `monster.items`, stay in the engine
  helper so the rule has one home rather than a server-side copy that can drift.
- **A real use button on every tier-1 row**, with a target picker when more than one target
  is valid. Targets come from `resolveUseTargets`, derived from the same facts that set the
  tier, so the button cannot offer a target the engine will refuse. The web confirm is what
  stands in for the engine's prompt.

**Three things review caught in the first cut, worth keeping straight**

- **`canUseItem` is only `canHoldItem`** — a compatibility check, with no runtime
  conditions in it. A tier-1 classification therefore does *not* prove the item's action
  can run: Spin Up refuses a living monster, a healing potion refuses a dead one. The engine
  declines and does **not** consume the item, so nothing is wasted, but the first cut
  reported success anyway. `useItem` now returns `applied`, and the panel says "had no
  effect … it was not used up" rather than claiming a use. Mirroring each item's conditions
  client-side was the alternative and would have drifted from the engine immediately.
- **The same item type can sit in both pools.** With a monster out of an encounter the pool
  is `[...monster.items, ...character.items]` and a name match takes the first hit, so
  clicking the pocket row spent the copy stocked on the monster. The click now carries
  `itemSource`; chat callers, who cannot express it, keep first-match behaviour.
- **An item can ask its own question.** `SortingHat.action` prompts for a team, and
  `useItem`'s channel rejects prompts — so the panel was advertising an item that could only
  ever fail after the confirm. Items now declare `requiresPrompt`, and the panel dims those
  with a reason pointing at the console. Supporting item-driven prompts over tRPC is real
  work and belongs with the ring-pane affordance, not before it.

**Not shipped, and the next real work**
0. **Item-driven prompts over tRPC.** The Sorting Hat is the only item that prompts today,
   and it is currently unusable from the web by design rather than by accident. Supporting it
   means carrying a choice into the mutation, or a two-step call. The ring-pane affordance
   is now shipped; this remains a separate prompt-transport feature.
1. **Web selling.** Browse and direct buying now live in the Workshop; selling still uses
   `sell to the shop`, whose multi-select confirmation flow remains first-class in the
   console and Discord.
2. **No feedback loop** (§6 item 5, untouched). Nothing tells a player that an item *would
   have* helped, or what a targeting scroll changed. This is the "teach the mechanic by
   showing its effect" half of the story, and it is independent of the UI work above.
3. **Per-fight budgets or any change to item power** — still wants the sim harness first,
   as §6 item 2 says. Nothing above changes how much can be used, only how it is reached.

**Open questions for whoever picks this up**
- The tier-2 reason strings (`'Not in the ring.'`, `'Not carried into the ring.'`,
  `'Not usable right now.'`) are centralised as exported constants in `item-tiers.ts` and
  were written by implementation, not chosen by the owner. Worth a read-through.
- §4's competence/attachment work (per-monster records, a memorial, earned titles) is
  untouched and independent of everything above.

## 9. September 17: shop and live-item completion

- Added the first dedicated player reference, [`ITEMS.md`](../../ITEMS.md), covering
  inventory limits, use timing, every item family, targeting strategy and room-shop rules.
- Added an authoritative prompt-free engine purchase operation. Its `(shop closing time,
  section, index, expected item type)` tuple is an optimistic stock token: under the room
  serialization lane it either buys from the merchant the player saw or refuses rotated or
  stale stock, never an item from the next shop generation.
- Added membership-checked, room-scoped `game.shop` and `game.buyShopItem` procedures and a
  Workshop merchant surface with balance, prices, owned counts, affordability, rotation
  time and back-room stock.
- Added the ring-pane item affordance. It deliberately queries the same inventory read
  model and only offers compatible items carried by the authenticated player's active
  monster, preserving the pre-stock rule rather than creating a second item system.
