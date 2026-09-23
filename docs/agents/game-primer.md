---
type: Agent Guide
title: Game primer for agents
description: How the game loop, pacing, healing, bosses, and feeds behave for an agent.
status: stable
audience: internal
tags: [agents, gameplay, primer]
---
# Game primer for agents

How Deck Monsters actually behaves, for someone who has to reason about it without playing
it. Everything here is checked against code and cites the file; where an architecture doc
already covers a subject in depth this links to it rather than restating it.

## The core loop

1. **Train.** (`train a monster`; the parser still accepts `spawn`, and the code keeps
   `spawnMonster` as its identifier — see
   [`docs/reference/voice-and-wording.md`](../reference/voice-and-wording.md)
   for the player-facing lexicon.) A beastmaster keeps up to `DEFAULT_MONSTER_SLOTS` (10)
   monsters. Capacity is *derived*, not stored: `monsterSlots = max(DEFAULT_MONSTER_SLOTS +
   monsterSlotModifier, monsters.length)`, so raising the global constant grants every
   existing character the room, a per-character grant lives in `monsterSlotModifier`, and
   nobody is stranded over capacity — they just cannot train more. A legacy stored
   `monsterSlots` is folded into the modifier once on load
   (`packages/engine/src/characters/beastmaster.ts`). The Workshop's Train form creates the
   character in the same prompt-free mutation when the player has none (#160); the console
   path prompts, and asks for **pronouns** (`he/him`, `she/her`, `they/them`), which map onto
   the persisted `male|female|androgynous` keys via `helpers/pronouns.ts`.
   A player's `Beastmaster` gets a starting deck the first time it needs one —
   `getInitialDeck()` = 15 fixed cards (Blink, Coil, Horn Gore, Battle Focus, Sandstorm,
   Blast, 4x Hit, **2x Delayed Hit**, 2x Heal, Flee) topped up with random draws to
   `DEFAULT_MINIMUM_CARDS` = 20 (`packages/engine/src/cards/helpers/deck.ts`).
2. **Equip.** A monster holds `cardSlots` cards — 9 by default
   (`packages/engine/src/monsters/base.ts`), maximum 4 copies of any one card
   (`MAX_CARD_COPIES_IN_HAND` in `packages/engine/src/characters/beastmaster.ts`). `equip`
   rebuilds the hand from scratch and returns the old hand to the deck.
3. **Ring.** `send <monster> to the ring` → `Beastmaster.sendMonsterToTheRing()` →
   `Ring.addMonster()`.
4. **Encounters.** Two contestants arm a countdown; each encounter every monster plays its
   next card, cards roll 1d20 + modifiers against AC, damage and effects resolve.
5. **Rewards.** `Game.handleWinner()` credits `XP_PER_VICTORY` plus coins via
   `awardFightCoins()` and emits `cardDrop` (`packages/engine/src/game.ts`); the loser path
   credits `XP_PER_DEFEAT`.

## What blocks a monster from entering the ring

`Beastmaster.sendMonsterToTheRing()` (`packages/engine/src/characters/beastmaster.ts`)
refuses in three cases, in this order, and each one announces before throwing:

- the player already has a contestant in the ring (one monster per beastmaster at a time);
- the player has no living monsters (`dead` monsters are filtered out — they must revive or
  be dismissed first);
- **the chosen monster's deck is not full** — `monster.cards.length < monster.cardSlots`
  gives "A beastmaster does not send a companion into the ring without a full deck."

The full-hand rule is the one that most often strands an agent mid-test: a freshly spawned
monster has cards in its beastmaster's *deck*, not in its hand. Equip first, in one shot
(see [`docs/operations/local-testing.md`](../operations/local-testing.md)).

The ring itself holds `MIN_MONSTERS` = 2 to `MAX_MONSTERS` = 12 contestants
(`packages/engine/src/ring/index.ts`).

## Pacing, and the skip-delays mode

`startFightTimer()` announces "Fight will begin in 60 seconds" and arms a `FIGHT_DELAY`
(60000ms) timer; quorum is re-checked when it fires, and a boss counts as one contestant
toward it. Within a fight, gaps between cards, rounds, and sub-events come from
`packages/engine/src/helpers/delay-times.ts` — sampled ranges around tunable midpoints, each
overridable by a `DECK_MONSTERS_*_DELAY_*` env var, with a hard `DECK_MONSTERS_MAX_FEED_GAP_MS`
ceiling (8s) because a longer gap reads as the game having stalled.

`DECK_MONSTERS_SKIP_DELAYS=1` makes every delay return 0 — set it for tests and the harness.
It also changes a clock: `hitLogTimestamp()` returns a **monotonic counter** in that mode
instead of `Date.now()`, so reproducible simulations do not depend on wall-clock ordering.
Anything that compares against a `hitLog` entry must use `hitLogTimestamp()` too. Stamping
`Date.now()` on hits made every recorded hit look newer than any armed Delayed Hit, so the
card fired on blows that landed before it was played, in every test run
(`packages/engine/src/creatures/health.ts`, 10b-bugs-fixed.md #157).

See
[`docs/architecture/engine-concurrency-and-timing.md`](../architecture/engine-concurrency-and-timing.md)
§1 for the
measured reasoning behind the values.

## Healing and revival

- Passive healing is **wall-clock**, not tick-based: `applyPassiveHealing()` reads
  `options.hpUpdatedAt` and credits every `TIME_TO_HEAL_MS` (30s per hp,
  `packages/engine/src/constants/timing.ts`) that has elapsed, so a sleeping host or an
  unloaded room cannot pause recovery (`packages/engine/src/creatures/base.ts`). An interval
  of the same period exists only to make it happen while the room is live.
- Monsters in an encounter, dead monsters, and full-health monsters heal nothing.
- Revival waits `self.level * TIME_TO_RESURRECT_MS` (10 minutes per level), which means a
  **level 0 monster revives instantly**; an instant-revival item restarts the clock at now
  and cancels the pending callback so it cannot fire twice
  (`packages/engine/src/creatures/health.ts`). On revival, HP that would have accrued after
  the scheduled moment is credited too.
- `respawnAt` (non-persisted) holds the *true* completion time of a running revival. After a
  room restore the timer is re-armed with only the remaining delay, so
  `respawnTimeoutBegan + respawnTimeoutLength` is wrong; the server's `myInventory`
  projection (`revivesAt`) and the Workshop's `Fallen · revives in …` label read `respawnAt`
  (#161).
- **Timer ownership**: a creature's healing interval and respawn timeout belong to its
  beastmaster, not to the ring. `Ring.clearRing()` therefore disposes only *transient*
  contestants (`isBoss`, which also covers harness sim monsters); player monsters are torn
  down by `Game.dispose()` on room unload or `Beastmaster.dropMonster()` on dismissal. For
  months `clearRing()` disposed everything, so a revived monster sat at 1 hp for hours
  (#156) — see
  [`docs/architecture/engine-concurrency-and-timing.md`](../architecture/engine-concurrency-and-timing.md)
  §7, "Creature timers belong to whoever owns the creature".

## Bosses and The Editor

Bosses are house monsters. Their owner is a generated character under `userId: 'boss'`, so
narration credits the house — `RING_PATRON` = `👑 The Editor`
(`packages/engine/src/constants/lore.ts`) — rather than an invented beastmaster (#102). The
arrival lines are a deliberate minimal pair: a player's monster "answers the call of" its
beastmaster, a boss "enters the ring at the behest of" The Editor
(`packages/engine/src/announcements/contestant.ts`).

`isBoss` doubles as "nobody owns this", which is why the harness builds its sim monsters as
bosses and why disposal keys off it. Players may summon a boss `BOSS_SUMMON_LIMIT` = 3 times
per rolling 24h window, per room (`packages/engine/src/helpers/boss-summons.ts`). Full rules:
[`docs/architecture/boss-encounters.md`](../architecture/boss-encounters.md).

## Card effects that wrap a play

Some cards arm an effect on `ring.encounterEffects` that wraps subsequent card plays
(`packages/engine/src/ring/index.ts`). The wrappers **nest in arming order**, so the
earlier-armed card's check runs before the later-armed card's counter-attack lands. Any
"check after the play" logic must therefore re-check *every* armed effect, not just its own
— `settleDelayedHits()` loops over all of them until a full pass fires nothing
(`packages/engine/src/cards/delayed-hit.ts`). A self-only check left a counter unanswered
until the next card anyone played, narrating a blow from a turn ago (#157). Two Delayed Hits
in one fight is routine: the starting deck ships with two.

## Prompts

Engine code asks the player questions through `channel({ question, choices })`. The server
bridges that to the web client through the room event bus; Discord uses buttons, select
menus, or a filtered DM collector.

Answer encoding, cancelled-prompt translation, and lane ownership are current contracts:

- [Prompt answer contract](../reference/prompt-answer-contract.md) — what a connector may
  send back.
- [Engine concurrency and timing](../architecture/engine-concurrency-and-timing.md) — the
  per-user console lane, the per-room workshop lane, and `PROMPT_CANCELLED`.

Awaited Workshop mutations stay prompt-free on the per-room workshop lane. A question
inside one throws on the silent channel.

## Quick-action chips

`packages/server/src/quick-actions.ts` builds the chips shown under the web console from
game state. Every emitted `command` string is dispatched verbatim, so it must be one the
parser accepts, and the eligibility checks must mirror the engine's: the chip builder
filters out dead, destroyed, and already-reviving monsters precisely because
`Beastmaster.reviveMonster` refuses a monster whose revival timer is running, and a chip for
it would only ever produce a dead end.

## Room scoping and identity

Room scoping is a hard constraint. A module-level shop is how one room's purchases leaked
into every other room (#26). Membership, identity, display names, and connector mappings
are the current contract in
[Rooms and identity](../architecture/rooms-and-identity.md).

## Combat payloads and the pixel-fight layer

Every combat announcement (`card.played`, hit, miss, heal, death, flee) carries a structured
`payload.combat` DTO (`CombatPayload` in `packages/engine/src/events/types.ts`, built by
`events/combat.ts`) alongside its text — actor/target as `{ name, icon, creatureType, isBoss }`
plus the kind-specific numbers. It exists so connectors and the web can animate or render
without parsing narration; it is additive and must stay JSON-safe (no engine objects).
`Ring.addMonster({ monster, character, userId, isBoss })` copies the flag onto the monster so `combat.isBoss`
and the roster's `Contestant.isBoss` cannot disagree.

The web consumes that payload in `apps/web/src/animations/pixel-fight/`. Sprites are drawn
inside the Ring roster rows, in the box the emoji already occupied. A separate band
duplicated the HP bars and was removed (#167). Sprites are on by default, on every theme.
The opt-out is Account → "Show pixel monsters", stored as `'0'` when off because a missing
value means on. An opted-out player never fetches the lazy chunk. Row order, field
priority, the appearance palette, known-monster storage, and feed portraits are the current
contract in
[Ring roster and pixel monsters](../architecture/ring-roster-and-pixel-monsters.md).
Timer re-arming and an authoritative empty roster are in
[Engine concurrency and timing](../architecture/engine-concurrency-and-timing.md).

## The web feeds

The Ring pane and Console pane are both `react-virtuoso` lists
(`apps/web/src/components/RingPane.tsx`, `ConsolePane.tsx`), sharing one follow policy in
[`apps/web/src/hooks/useFeedAutoScroll.ts`](../../apps/web/src/hooks/useFeedAutoScroll.ts).
Three rules from #159 that are easy to undo by accident:

- Re-pin by scrolling the scroller element to its own `scrollHeight`, **not** with
  `scrollToIndex('LAST')` — that targets Virtuoso's size-tree estimate, which can still hold
  a freshly appended row's estimated height and land tens of pixels short.
- Repeat the snap once after `REPIN_SETTLE_MS` (250ms), because the first one runs before a
  tall row has been measured.
- `AT_BOTTOM_THRESHOLD_PX` must stay under one feed line (currently 8px). A larger tolerance
  disables Virtuoso's own snap-back, so a follow scroll that ends short is never corrected
  and the `↓ Latest` button never appears.

"Not at bottom" counts as the reader leaving only if a real scroll gesture landed within
`USER_SCROLL_INTENT_WINDOW_MS` (1.5s); otherwise the bottom moved on its own and the feed
re-pins. The hook's return value is memoised because consumers put it in effect dependency
arrays (#132).
