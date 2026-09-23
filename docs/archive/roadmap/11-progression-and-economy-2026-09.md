---
type: Archive
title: September 2026 progression and economy analysis
description: Shipped before-and-after analysis behind the early XP discount, coin participation floor, and daily bonus.
status: deprecated
audience: internal
tags: [archive, progression, economy, balance]
---
# September 2026 progression and economy analysis

> Historical record. The tuning knobs live in `packages/engine/src/constants/progression.ts`
> and `constants/coins.ts`; current code wins. Open follow-ups are in
> [`11-balance-and-mechanics.md`](../../roadmap/11-balance-and-mechanics.md).

These two sections were shipped analysis in `docs/roadmap/11-balance-and-mechanics.md`.
They moved here unchanged when that file became an open-work backlog, because code
comments cite the numbers they were tuned against.

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

Each item below is now owned by the active backlog: telemetry, harness scenarios,
progression review, and healing prices in `11-balance-and-mechanics.md`; web selling in
`item-followups.md`.

- Measure median coins earned, spent and held per active player-room; time from first
  fight to first purchase; outcome mix (especially draws); and shop stock that expires
  unaffordable. Review after at least two merchant rotations and again after two weeks.
- Add economy scenarios to the battle simulation harness: new-player 1/5/20-fight
  sessions, expected outcome mixes, purchase-time distributions and currency sinks.
- If first-purchase time remains too long, prefer a small starter purse or a
  first-purchase discount over another permanent increase to win rewards. Both target
  onboarding without compounding long-term inflation.
- Add prompt-free web selling from the existing item/shop roadmap. Selling is already
  a valid currency source, but console-only discovery makes it a poor answer for web users.
- Revisit healing-item prices only with use/outcome telemetry. Their 60–90 coin shop
  price is much steeper than the entry tier, but lowering it blindly risks making bounded
  mid-fight intervention routine rather than strategic.

## Early progression front-loading (September 18, 2026)

### Player feedback

"It seems to take so long to level up, gain xp, gain coins, get the interesting exciting
cards and items, etc. Overall this may be a good thing but especially for early stage
beginner monsters it feels slow and like we need to see it more visually plus maybe get a
bit more of the taste of the excitement of higher levels."

The feedback explicitly did not ask for the whole economy to be flattened — the slow burn
"may be a good thing" overall. So this pass steepens only the first few levels/fights and
converges back to the existing curve, rather than raising win/loss rates or level costs
permanently across the board.

### Before: the XP curve at low levels

`helpers/levels.ts`'s `getLevel()` used a Fibonacci-style cumulative threshold — each
level's XP requirement is the sum of the previous two — seeded at 50 for level 1:

| Level reached | Cumulative XP (old) | ~wins needed (14xp/same-level win) |
|---|---|---|
| 1 | 50 | 4 |
| 2 | 100 | 8 |
| 3 | 150 | 11 |
| 4 | 250 | 18 |
| 5 | 400 | 29 |
| 6 | 650 | 47 |

(14xp is `calculateXP`'s payout for killing a same-level opponent as the last one
standing in a 1-round fight — see `helpers/experience.test.ts`.)

Coins: after the September 18 economy audit (above) shipped in the same day, a new
player's first win pays 10 coins (5 win + 5 once-daily bonus) — already enough for the
cheapest marked-up shop listing (12-18 coins, see `constants/coins.ts`) in roughly one
more fight. But a player who is *losing* every early fight (very plausible sharing a room
with higher-level monsters) was paying 7 coins on the first loss and 2 per loss after
that — 3-4 losses to reach the cheapest item, "not dozens", but also not the "small
handful" this feedback asked for in the worst case.

Card drops: every win already draws a card (100% of the time — `Game.handleWinner` calls
`drawCard` unconditionally), gated to cards at or below the monster's own level
(`canHoldCard`). Within that legal pool, each card's own rarity (`.probability`) decided
which one dropped, uniformly at every level — a level-0 monster had no better odds of the
rarer common-tier options than a level-10 monster restricted to that same pool would.

### After: the front-loaded curve

All three knobs are centralized in one new file, `constants/progression.ts`, specifically
so "front-load early, converge back to the existing curve" is one place to tune rather
than scattered constants. Each is documented in-file with the reasoning; summary:

- **XP**: `earlyXpDiscount(level)` multiplies the cumulative threshold for reaching each
  level by a factor that starts at 0.55 for level 1 and climbs by 0.10/level, capped at
  1.0 (no change) from level 6 on. New cumulative thresholds:

  | Level reached | Cumulative XP (new) | ~wins needed (14xp/win) |
  |---|---|---|
  | 1 | 28 | 2 |
  | 2 | 65 | 5 |
  | 3 | 113 | 9 |
  | 4 | 213 | 16 |
  | 5 | 380 | 28 |
  | 6 | 650 (unchanged) | 47 (unchanged) |

  Levels 1-3 are roughly twice as fast; level 6 onward is byte-for-byte the same curve as
  before, so nothing about mid/late pacing changed.

- **Coins**: `earlyCoinBonus(battlesPlayedBeforeThisFight)` adds a tapering bonus (+3 for
  a player's first 5 completed fights, +1 for the next 5, +0 after) on top of the existing
  win/loss/daily payout, tracked via the same `character.battles.total` counter
  `addWin`/`addLoss`/`addDraw` already maintain. This guarantees a first purchase within a
  handful of fights even in an all-losses run, without permanently raising the win/loss
  rates the September 18 audit just tuned.

- **Card drops**: `earlyDropBoost(level)` multiplies each *eligible* card's rarity roll
  (3x at level 0, decreasing to 1x — no change — at level 5) before the drop check in
  `cards/helpers/draw.ts`. The level gate itself (`canHoldCard`) is untouched — a level-0
  monster still cannot hold a level-3 card — this only improves its odds of the more
  interesting card *among the ones it already qualifies for*. This is also what a new
  character's starting deck draws from (`cards/helpers/deck.ts` calls the same `draw()`),
  so a level-0 starting deck already leans toward the more interesting early-tier cards —
  the "taste of higher-level excitement" the feedback asked for, without letting a
  beginner monster hold anything above its level.

### Visibility

XP gain was already a private `ring.xp` event (`announcements/xpGain.ts`, `scope:
'private'`, `targetUserId`), and level-up was already a public announcement
(`announcements/level-up.ts`) — both existed before this change and needed no fix, just
confirmation while reading `events/room-event-bus.ts` and the persistence path. What
was missing was Workshop-side visibility: monsters had no on-screen XP/level progress at
all (only a static `L{n}` label), so the server's `myInventory` summary
(`packages/server/src/trpc/router.ts`) now also returns `xpIntoLevel`/`xpNeededForLevel`
per monster (derived from `getXpCapForLevel`, already exported by the engine), and
`MonsterWorkshopPanel.tsx` renders a second meter row (`.workshop-xp-meter`, styled after
the existing card-slot meter — label beside the track, never on the fill, per
`10b-bugs-fixed.md` #120) beneath the slot meter. The room-level coin balance
(`.workshop-wallet` in the Workshop header) already existed by the time this landed.

### Deliberately not done

- **No blanket increase to win/loss coin or XP rates.** That would undo the balance the
  September 18 audit just tuned and contradicts the feedback's own "may be a good thing
  overall".
- **No change to `canHoldCard`'s level gate.** Loosening it would let a beginner monster
  hold cards its level was never meant to unlock — the drop boost only re-weights within
  the pool the gate already allows.
- **No separate "starter item" seeding mechanic.** The drop-boost lever already reaches
  the starting deck (`cards/helpers/deck.ts` draws through the same boosted `draw()`), so
  a second, bespoke seeding system would duplicate it for a smaller marginal gain — see
  the effort/impact tradeoff called out in `19-player-agency-and-items.md` §1 ("prefer one
  well-executed idea").
- **No new tRPC procedure for the Workshop's coin balance** — the concurrent shop/workshop
  data work already added `.workshop-wallet`, so this pass only added the per-monster XP
  fields.
