# Balance and Mechanics Improvements

**Category**: Game Design / Balance  
**Priority**: Medium (do before or during launch, before new content)  
**Status**: Active — two prerequisite stat calculation bugs were fixed during the TypeScript migration; the first economy audit and reward-floor fixes shipped September 18, 2026
**Source**: Upstream issues tagged with the Balance milestone and related discussions

These are mechanics changes that affect the core game feel. They should be done as a coordinated pass rather than piecemeal, because some of them interact. We should also write a harness which allows us to test mock battles / cards over and over to fine tune the mechanics as they interact, find bugs in their interactions, and resolve issues balance / over powered cards.

---

## Coin Economy and Participation Floor (September 18, 2026)

### Audit findings

The reported symptom — a character that had fought many times still showing zero coins —
had two independent causes. The outcome listeners paid **5 coins for a
win**, **2 for a loss or flee**, and **4 for permanent death**, but the ring's fully
implemented draw outcome had no game-level reward listener. A player whose completed
fights resolved as draws could therefore gain battle-count credit while remaining at zero
coins. The handbook's promise that battles earn coins was too broad for the implementation.

Separately, an all-zero **leaderboard** was a projection bug, not balance: coin rewards are
private `ring.xp` events, while the server's room-internal stats subscriber previously saw
public events only. Character balances changed correctly, but `coins_earned` never did.
That delivery bug is fixed in `10b-bugs-fixed.md` #139. Historical earnings cannot be
reconstructed exactly because spent coins are absent from current balances and the missing
private events were not persisted. Room loading now also reconciles the projection to at
least each character's authoritative current balance, repairing existing all-zero rows
without double-counting newer projected rewards; totals then resume from new rewards.

The surrounding prices made that hole especially visible:

- item/card face-value tiers are 10, 20, 30, 50, 80 and 130 coins;
- ordinary shop purchases use twice the merchant's 0.6–0.9 offset, so the cheapest paid
  listing costs **12–18 coins** and a 50-coin healing item costs **60–90**;
- at the old outcome rates, the cheapest listing therefore represented 3–4 wins or 6–9
  losses, while a draw made no progress at all;
- wins already include a card drop, so raising only the win payout would widen the gap
  between successful and struggling/new players.

Items themselves have a sound acquisition/use loop now: the room merchant rotates every
six hours; the Workshop exposes price, ownership, affordability and direct buying; carried
items can be used from the live Ring; and the console can sell cards/items. The bottleneck
was the currency inflow and its legibility, not missing things to buy or use.

### Shipped adjustment

1. **Draws now pay the same consolation reward as losses/flees:** 2 coins and the same
   character XP. This closes the zero-progress outcome and makes the implementation match
   the player-facing promise.
2. **The first completed fight each UTC day pays 5 bonus coins automatically.** This is
   participation-based rather than a login claim: opening the app does not mint currency,
   there is no claim button to discover, and a player still contributes a contestant to a
   completed room fight. The date is stored on the room-scoped character, so the bonus is
   persistent and independent in each room.
3. **The reward announcement includes the combined coin amount and names the daily bonus.**
   Players can now understand why the first payout is larger.

With the daily bonus, a player's first loss/draw/flee of the day pays 7 coins and first win
pays 10. That does not immediately buy the cheapest marked-up listing, but it guarantees
visible progress and reduces the cheapest purchase to at most one additional win or three
additional consolation outcomes. Subsequent fights retain the existing 5/2 rates, limiting
inflation and preserving wins as the faster path.

### Follow-up plan (needs telemetry and/or the simulation harness)

- [ ] Measure median coins earned, spent and held per active player-room; time from first
  fight to first purchase; outcome mix (especially draws); and shop stock that expires
  unaffordable. Review after at least two merchant rotations and again after two weeks.
- [ ] Add economy scenarios to the battle simulation harness: new-player 1/5/20-fight
  sessions, expected outcome mixes, purchase-time distributions and currency sinks.
- [ ] If first-purchase time remains too long, prefer a small starter purse or a
  first-purchase discount over another permanent increase to win rewards. Both target
  onboarding without compounding long-term inflation.
- [ ] Add prompt-free web selling from the existing item/shop roadmap. Selling is already
  a valid currency source, but console-only discovery makes it a poor answer for web users.
- [ ] Revisit healing-item prices only with use/outcome telemetry. Their 60–90 coin shop
  price is much steeper than the entry tier, but lowering it blindly risks making bounded
  mid-fight intervention routine rather than strategic.

---

## Crit Fail Consequences for All Cards (upstream #183)

Currently some cards have no crit fail (natural 1) outcome. Every card should have one.

**Design principle**: A natural 1 should always result in something bad for the attacker — backfire, fumble, self-damage, wasted turn, etc. The specific penalty should be thematically appropriate to the card.

Related: **#182** — Crit fail on a time-shift card specifically should freeze the attacker for a turn and make them untargetable.

**Action**: Audit all cards for missing crit fail handlers. Add appropriate outcomes. The `curseOfLoki` mechanic (computed in `helpers/chance.ts`, propagated through `checkSuccess`) already provides the flag — the issue is that not all cards act on it.

---

## Stat Variance and Bonus Reform (upstream #188)

The current stat system awards too-linear bonuses. Proposed overhaul:

- **Base stat**: 8 (all monsters start here before variance)
- **Variance**: 0–2 (rolled at spawn, per stat)
- **Modifier**: -1 to +2 based on stat value (below 8 = penalty, 12+ = bonus)
- **Per-level increase**: +1 to a stat per level (player choice or random)
- **Encounter modifiers**: temporary buffs/debuffs applied during battle
- Adjusted bonus calculation thresholds for bonus, curse, and saving throw mechanics

This is a significant change. Requires careful migration for existing characters or a "reroll on the new system" mechanic for the revival launch.

**Action**: Design the new stat tables, implement the new calculations, update all card modifier math to be consistent.

---

## Initiative (upstream #189)

Play order in the ring is currently based on entry order (shuffled on add). It should be based on an initiative roll:

- Each monster rolls **1d20** at the start of each encounter
- Modified by a **SPEED stat** bonus (no current monster class has a speed advantage — reserved for a future Thief/Rogue class)
- Ties broken by re-rolling

This adds meaningful variance to fights and prevents the "first mover always wins" dynamic.

**Action**: Add initiative roll to `Ring.startEncounter()`. Add SPEED stat to `constants/stats.ts` (even if all current monsters start at 0 modifier).

---

## Card Counterparts and Balance Caps (upstream #190)

Some cards are disproportionately powerful relative to others at the same level. Each card should have:

- A **counterpart** (a card that specifically counters or weakens it), or
- A **saving throw** mechanism, or
- A **class-specific weakness** (e.g., Enchanted Faceswap is ineffective against Blast)

Additionally, card scaling on level-up should maintain relative difficulty ratios — a card that's strong at level 1 shouldn't become dominant at level 5.

**Action**: Audit card power at each level tier. Document intended counterparts. Add saving throw hooks where missing.

---

## Crit Ticks — Stat Improvement on Crit (upstream #164)

Add a "crit tick" system to reward skilled play and create a stat progression path beyond levels:

- During battles, track each monster's **critical roll count** (natural 20s)
- On level-up, display a "highlights reel" showing the crit ticks earned
- For each crit tick, roll **d100**: rolling 100 grants one **bonus stat point** (player's choice of stat)
- This is rare (1% per crit tick) but creates exciting level-up moments

**Action**: Track crit ticks per battle on the monster object. Add the d100 resolution step to the level-up flow. Add the highlights reel announcement.

---

## Fights in Threads (upstream #83)

Each fight in the ring should post its battle narration in a **thread** rather than flooding the main ring channel. The main channel gets a short summary post; full narration lives in the thread.

This maps naturally onto the event bus architecture:

- The engine emits a `ring.fightStart` event (summary, posted to the main channel)
- Subsequent combat events (`card.played`, `damage.dealt`, etc.) are tagged with a `threadId` linking them to the fight
- Connectors decide how to render threads:
  - **Discord**: native thread support per message
  - **Web app**: collapsible fight sections in the ring feed
  - **Slack**: native thread replies
  - **Mobile**: expandable/collapsible fight sections

The `GameEvent` type could include an optional `threadId` field. Connectors that don't support threads (or haven't implemented thread rendering) just ignore it and display events inline as before.

**Action**: Add optional `threadId` to `GameEvent`. Emit a `ring.fightStart` summary event. Tag all subsequent fight events with the thread ID.

---

## Critical Bug Fixes Completed (prerequisite to balance work)

Before balance work begins, two critical stat calculation bugs were fixed (PR [#286](https://github.com/deck-monsters/deck-monsters/pull/286)):

- **Double-counted level bonus**: `getModifier()` was adding the level boost AND `getPreBattlePropValue()` was adding it again for STR/DEX/INT. Fixed: level scaling lives only in `getModifier()`, `getPreBattlePropValue()` uses the modifier as-is.
- **Wrong property key**: `this.modifiers[modifier]` used the numeric modifier value as an object key (always `undefined`). Fixed to `permanentModifiers[targetProp]` (permanent/option modifiers only); encounter modifiers are handled separately in `getProp()`.

These bugs meant all creatures were effectively one extra level-worth stronger than intended, and permanent stat modifiers (from `setModifier(..., permanent=true)`) were silently ignored. All 365 tests pass with the corrected behavior.

---

## AI-Assisted Balance Validation

The battle simulation harness (below) pairs well with AI-assisted validation. An agent skill documenting the combat system, stat calculations, and known balance pitfalls would allow contributors to:

- Describe a proposed card or mechanic change in natural language
- Have the agent review the proposal against existing cards and flag potential issues (overpowered scaling, missing crit fail handlers, interactions that break the game loop)
- Run simulated battles to verify the change doesn't produce degenerate outcomes

This addresses historical problems where new cards inadvertently disrupted game mechanics because the author didn't anticipate interactions with the full card pool. The simulation harness provides empirical evidence; the agent skill provides institutional knowledge about what "balanced" means in this game.

**Action**: Build the battle simulation harness first, then create the Cursor skill. See also the AI-assisted card authoring section in the new content backlog.

---

## Tasks

- [ ] Audit all cards for missing crit fail handlers; add appropriate outcomes (upstream #183)
- [ ] Implement time-shift specific crit fail (frozen + untargetable) (upstream #182)
- [ ] Design and implement new stat variance/modifier system (upstream #188)
- [ ] Decide migration path for existing characters on the new stat system
- [ ] Add initiative roll to `Ring.startEncounter()`; add SPEED stat (upstream #189)
- [ ] Audit card power by level tier; add counterparts/saving throws (upstream #190)
- [ ] Implement crit tick tracking and level-up d100 resolution (upstream #164)
- [ ] Add `threadId` to `GameEvent`; implement thread rendering in Discord + web (upstream #83)
- [ ] Build a battle simulation harness for mechanics testing and balance tuning
