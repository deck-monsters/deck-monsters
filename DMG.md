```
			██████╗ ███╗   ███╗ ██████╗
			██╔══██╗████╗ ████║██╔════╝
			██║  ██║██╔████╔██║██║  ███╗
			██║  ██║██║╚██╔╝██║██║   ██║
			██████╔╝██║ ╚═╝ ██║╚██████╔╝
			╚═════╝ ╚═╝     ╚═╝ ╚═════╝

*Dungeon Master Guide (Game Master Reference):*
Full card stats, modifier math, damage-per-turn tables, and probability breakdowns.

Multi-roll attacks (Lucky Strike, Horn Swipe, Rehit): when a card rolls
more than once and keeps only one result, Stroke of Luck / Curse of Loki
apply to the selected roll only — discarded natural 20s/1s do not crit.
```

╔══════════════════════════════════╗
║     DUNGEON MASTER GUIDE         ║
║     Deck Monsters                ║
╚══════════════════════════════════╝

Full card stats, modifier math, damage-per-turn tables, and probability breakdowns.
── How to Run a Session ──────────────

Deck Monsters runs as a room-scoped game engine behind connector adapters.
Each room has its own persisted game state, shop inventory, and event stream.

Web (deck-monsters.com):
  • Players sign in, join or create a room from the lobby, then use the
    Console pane for text commands and the Ring pane for the live fight feed.
  • The Workshop page supports drag-and-drop deck management; console commands
    remain available for the same operations.
  • Room Settings (gear icon) lets room owners reset game state or manage members.

Discord:
  • Each guild maps to one or more rooms. Slash commands (/spawn, /ring, /equip,
    /shop, /status, /create-room, /join-room, …) and free-text DMs both dispatch
    into the same engine command parser.
  • Interactive prompts arrive as DM button menus or free-text collectors; players
    must be able to receive DMs from the bot for multi-step flows.
  • /create-room and /join-room set the caller's active room for subsequent commands.

Starting a session:
  1) Ensure the server process is running with database connectivity configured.
  2) Load or create the target room (web navigation or Discord guild default).
  3) Players spawn monsters, equip decks, and send fighters to the ring.
  4) Once 2+ monsters are in the ring, the fight timer arms automatically.

State saves debounce (~30 s) on engine mutations; fights and prompts do not block saves.
── Fight Pacing ──────────────────────

Ring quorum: fights require at least 2 monsters in the ring (up to
12). When quorum is met, a 60-second countdown
re-arms after each encounter.

During a fight:
  • Each contestant plays the next card in its deck (wraps when exhausted).
  • Card-to-card pacing uses veryShortDelay (~2–4 s between plays in production).
  • Round transitions use shortDelay (~3–6 s).
  • Sub-event pacing within a single card play (~1 s between roll/hit/damage) is
    separate and much shorter — do not confuse the two layers.

Tests and harness runs set DECK_MONSTERS_SKIP_DELAYS=1 to zero all timers.
Operators may tune midpoints via DECK_MONSTERS_*_DELAY_MIDPOINT_MS env vars
(see packages/engine/src/helpers/delay-times.ts); no secrets are required.

Ring fights run on an internal timer chain outside server command lanes — they
interleave with player commands by design.
── Admin Commands ────────────────────

Run any command as another player (admin only):
  [command] as [player name]
  Example: spawn monster as Alice

Reset the room's game state from the Room Settings page (gear icon in the header).
── Stats Reference ───────────────────

Base stats (all monsters start here):
  HP:  23–33 (base 28 ± 5)
  AC:  3–7 (base 5 ± 2)
  STR: 5  DEX: 5  INT: 5

Per-monster-type modifiers:
  Basilisk (Barbarian)
    HP: 26–30  AC: 3–7  STR +2  DEX -1  INT +1
  Gladiator (Fighter)
    HP: 25–31  AC: 3–7  STR +1  DEX +1  INT +0
  Jinn (Bard)
    HP: 28–28  AC: 3–7  STR +0  DEX +1  INT +1
  Minotaur (Barbarian)
    HP: 24–32  AC: 6–4  STR +2  DEX +1  INT -1
  Weeping Angel (Cleric)
    HP: 27–29  AC: 4–6  STR -1  DEX +1  INT +2
── Combat Math ───────────────────────

To hit:    roll 1d20 + attacker modifier vs target stat
A roll of 20 is always a stroke of luck (extra effect).
A roll of 1 is always a curse of loki (bad effect).

Multi-roll attacks (Lucky Strike, Horn Swipe, Rehit): when a card rolls
more than once and keeps only one result, Stroke of Luck / Curse of Loki
apply to the selected roll only — discarded natural 20s/1s do not crit.

Damage:    varies by card (1d4, 1d6, 1d8, 2d4, 2d6...)
Modifiers: STR/DEX/INT bonuses added based on card class

AC boost cards absorb melee damage before HP is reduced.
Stat curses (from cards like Soften, Concussion, Molasses)
cap at -3 per level; further penalties come out of HP instead.
── Operator Concurrency Notes ────────

These rules prevent "commands ignored" and workshop/console interleaving bugs.
Full detail: docs/engine-concurrency-and-timing.md

  • Interactive console commands serialize per roomId:userId — never room-wide.
    A user's multi-prompt flow must not starve other members.
  • Workshop mutations (equip, presets, …) use a room-wide lane plus a same-user
    guard so they cannot interleave with that user's active console flow.
  • activeFlows: at most one interactive console flow per user per room.
  • Ring fights are not awaited by the server and are not inside any lane.
  • Cross-user console commands may run concurrently on the shared Game — intentional.
    Shared mutations (shop, ring roster) stay on the room lane.
  • Never put a user-input wait inside a room-wide serialized lane.

Discord mirrors web lane keys via connector-local flow locks; prompt collectors
resolve outside the lane so answers can release waiting actions.
── Card Catalog (verbose) ────────────
Adrenaline Rush
Bad Batch
Basic Shield
Battle Focus
Berserk
Blast
Blast II
Blink
Harden
Brain Drain
Calisthenics
Camouflage Vest
Cloak of Invisibility
Coil
Concussion
Constrict
Soften
Delayed Hit
Enchanted Faceswap
Enthrall
Entrance
Ecdysis
Feline Companion
Fight or Flight
Fists of Villainy
Fists of Virtue
Flee
Forked Metal Rod
Forked Stick
Heal
Hit
Hit Harder
Horn Gore
Horn Swipe
Iocane
The Kalevala
Lucky Strike
Mesmerize
Molasses
Pick Pocket
Pound
1993-09-7202 18:58
Random Play
Rehit
Sandstorm
Scotch
Survival Knife
Thick Skin
Turkey Thigh
Vengeful Rampage
Whiskey Shot
Wooden Spear

```
==================================
 ❗️  Adrenaline Rush  ○
----------------------------------

 Life or Death brings about a 
 certain focus... A certain 
 AWAKENESS most people don't 
 actually want. It's what you 
 live for. It's how you know you 
 exist. You embrace it and 
 welcome the rush.

 Boost: dex +1
 Boost: str +1

 Level: 2
 Usable by: Barbarian, Fighter
 MSRP: 50
 Class: Boost

==================================
```


```
==================================
 🍻  Bad Batch  ◆
----------------------------------

 Nothing like a little bathtub 
 moonshine stored in sturdy lead 
 jugs.

 The next Whiskey Shot or Scotch 
 played will poison rather than 
 heal.

 Level: 1
 Usable by: Bard
 MSRP: 50
 Class: Poison

==================================
```


```
==================================
 🛡  Basic Shield  ○
----------------------------------

 Equip yourself for the battle 
 ahead.

 Boost: ac +2 (max boost of level 
 * 2, or 1 for beginner, then 
 boost granted to hp instead).
 If hit by melee attack, damage 
 comes out of ac boost first.

 Level: 2
 Usable by: Bard, Fighter
 Heal chance: 20% | HPT: 0
 MSRP: 50
 Class: Boost

==================================
```


```
==================================
 🥋  Battle Focus  ☆
----------------------------------

 Years of training, drill after 
 drill, kick in. An attack is not 
 a single hit, but a series of 
 strikes each leading to another. 
 Time seems to disappear and for 
 a brief moment you and your 
 adversary become perfectly in 
 sync as you lead in a dance of 
 their destruction.

 Hit: 1d20 + str bonus vs ac on 
 first hit
 then also + int bonus (fatigued 
 by 1 each subsequent hit) until 
 you miss
 1d6 damage on first hit.
 1 damage per hit after that.

 Stroke of luck increases damage 
 per hit by 1.

 Level: Beginner
 Usable by: Gladiator
 Hit chance: 70% | DPT: 5
 MSRP: 130
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 😤  Berserk  ○
----------------------------------

 The whole world disappears into 
 a beautiful still, silent, red. 
 At the center of all things is 
 the perfect face of your enemy. 
 Destroy it.

 Hit: 1d20 + str bonus vs ac on 
 first hit
 then also + int bonus (fatigued 
 by 1 each subsequent hit) until 
 you miss
 1 damage per hit.

 Stroke of luck increases damage 
 per hit by 1.

 Level: 1
 Usable by: Barbarian
 Hit chance: 70% | DPT: 3
 MSRP: 50
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 💥  Blast  •
----------------------------------

 A magical blast against every 
 opponent in the encounter.

 Blast: 3 base damage +1 per 
 level of the caster

 Level: Beginner
 Usable by: Cleric
 Hit chance: 100% | DPT: 3
 MSRP: 50
 Class: AOE

==================================
```


```
==================================
 💥  Blast II  ◆
----------------------------------

 A strong magical blast against 
 every opponent in the encounter.

 Blast II: 3 base damage + int 
 bonus of caster

 Level: 2
 Usable by: Cleric
 Hit chance: 100% | DPT: 4
 MSRP: 80
 Class: AOE

==================================
```


```
==================================
 ⏳  Blink  ☆
----------------------------------

 Consume your victim's potential 
 energy

 1d20 vs opponent's int. They are 
 removed from the battle (and can 
 not be targeted).
 On what would have been their 
 next turn, if you are still 
 alive you drain 1d4 hp and 4d4 
 xp

 Level: Beginner
 Usable by: Weeping Angel
 Effect chance: 75%
 MSRP: 130
 Targets: ac
 Class: Psychic

==================================
```


```
==================================
 🆙  Harden  ○
----------------------------------

 It's time to put on your big boy 
 pants, and toughen up!

 Boost: ac +1 (max boost of level 
 * 2, or 1 for beginner, then 
 boost granted to hp instead).
 If hit by melee attack, damage 
 comes out of ac boost first.

 Level: 1
 Usable by: All
 MSRP: 20
 Class: Boost

==================================
```


```
==================================
 🤡  Brain Drain  ◆
----------------------------------

 And we shall bury our enemies in 
 their own confusion.

 Hit: 1d20 vs int / Damage: 1d4
 Curse: xp -20
 Can reduce xp down to 40, then 
 takes 4 from hp instead.

 Level: 1
 Usable by: Cleric, Jinn
 Hit chance: 77% | DPT: 3
 MSRP: 50
 Targets: int
 Class: Psychic

==================================
```


```
==================================
 🙆‍  Calisthenics  ○
----------------------------------

 Your daily workout routine 
 limbers you up for battle.

 Boost: dex +1-2 depending on how 
 deep the stretch is

 Level: 2
 Usable by: Barbarian, Fighter
 Heal chance: 10% | HPT: 0
 MSRP: 50
 Class: Boost

==================================
```


```
==================================
 ☁️  Camouflage Vest  ◇
----------------------------------

 You don your vest and blend in, 
 if only for a while.

 You are invisible until you play 
 a card that targets another 
 player, or for the next 2 cards 
 you play (whichever comes 
 first).
 1d20 vs your int for opponent to 
 see you on their turn (natural 
 20 removes your cloak).

 Level: 1
 Usable by: Barbarian, Fighter
 Effect chance: 100%
 MSRP: 80
 Class: Hide

==================================
```


```
==================================
 ☁️  Cloak of Invisibility  ◇
----------------------------------

 You don your cloak and 
 disappear, if only for a while.

 You are invisible until you play 
 a card that targets another 
 player, or for the next 2 cards 
 you play (whichever comes 
 first).
 1d20 vs your int for opponent to 
 see you on their turn (natural 
 20 removes your cloak).

 Level: 1
 Usable by: Bard, Cleric, Wizard
 Effect chance: 100%
 MSRP: 80
 Class: Hide

==================================
```


```
==================================
 ➰  Coil  ☆
----------------------------------

 Coil around your enemies with 
 your body, and squeeze.

 Immobilize and hit your opponent 
 by coiling your serpentine body 
 around them and squeezing. If 
 opponent is immune, hit instead.

 If already immobilized, hit 
 instead.
 Hit: 1d20 vs dex / Damage: 1d6
 
 +2 advantage vs Gladiator, 
 Minotaur
 
 -2 disadvantage vs Basilisk, 
 Jinn

 Opponent breaks free by rolling 
 1d20 vs immobilizer's dex +/- 
 advantage/disadvantage - (turns 
 immobilized * 3)
 Hits immobilizer back on stroke 
 of luck.
 Turns immobilized resets on 
 curse of loki.

 -1 hp each turn immobilized.

 Level: Beginner
 Usable by: Basilisk
 Hit chance: 77% | DPT: 4
 Effect chance: 100%
 MSRP: 130
 Targets: dex
 Class: Melee

==================================
```


```
==================================
 🥊  Concussion  ◆
----------------------------------

 A hard blow to the head should 
 do the trick.

 Hit: 1d20 vs ac / Damage: 1d4
 Curse: int -1-2 depending on how 
 hard the hit is, with a maximum 
 total curse of -3 per level. 
 Afterwards penalties come out of 
 hp instead.

 Level: 1
 Usable by: Barbarian, Fighter
 Hit chance: 85% | DPT: 3
 MSRP: 50
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 ➰➰  Constrict  ★
----------------------------------

 Coil around your enemies with 
 your body, and squeeze like you 
 mean it.

 Immobilize and hit your opponent 
 by coiling your serpentine body 
 around them and squeezing. If 
 opponent is immune, hit instead.

 If already immobilized, hit 
 instead.
 Hit: 1d20 vs dex / Damage: 1d6
 
 +3 advantage vs Gladiator, 
 Minotaur
 
 -3 disadvantage vs Basilisk, 
 Jinn

 Opponent breaks free by rolling 
 1d20 vs immobilizer's dex +/- 
 advantage/disadvantage - (turns 
 immobilized * 3)
 Hits immobilizer back on stroke 
 of luck.
 Turns immobilized resets on 
 curse of loki.

 -2 hp each turn immobilized.

 Level: 1
 Usable by: Basilisk
 Hit chance: 77% | DPT: 4
 Effect chance: 100%
 MSRP: 80
 Targets: dex
 Class: Melee

==================================
```


```
==================================
 😖  Soften  ◆
----------------------------------

 Sweep the leg... You have a 
 problem with that? No mercy.

 Hit: 1d20 vs ac / Damage: 1d4
 Curse: ac -1, with a maximum 
 total curse of -3 per level. 
 Afterwards penalties come out of 
 hp instead.

 Level: 1
 Usable by: All
 Hit chance: 76% | DPT: 3
 MSRP: 20
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 🤛  Delayed Hit  ◆
----------------------------------

 Patience. Patience is key. When 
 your opponent reveals 
 themselves, then you strike.

 Delay your turn. Use the delayed 
 turn to immediately hit the next 
 player who hits you.
 Hit: 1d20 vs ac / Damage: 1d6

 Level: Beginner
 Usable by: All
 MSRP: 50
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 👥  Enchanted Faceswap  ◇
----------------------------------

 A snapchat filter for the 
 magically inclined. This spell 
 will cause the next card played 
 with the caster as the target to 
 be reversed so that the player 
 of the card becomes the target.

 Level: 1
 Usable by: Bard, Cleric
 Effect chance: 100%
 MSRP: 80
 Class: Hide

==================================
```


```
==================================
 🎇  Enthrall  ◆
----------------------------------

 You strut and preen. Your beauty 
 enthralls everyone, except 
 yourself.

 Immobilize all opponents.

 If already immobilized, hit 
 instead.
 Hit: 1d20 vs int / Damage: 1d6
 
 +2 advantage vs Basilisk, 
 Gladiator
 
 -2 disadvantage vs Minotaur, 
 Weeping Angel
 ineffective against Jinn

 Opponent breaks free by rolling 
 1d20 vs immobilizer's int +/- 
 advantage/disadvantage - (turns 
 immobilized * 3)
 Hits immobilizer back on stroke 
 of luck.
 Turns immobilized resets on 
 curse of loki.

 Level: 2
 Usable by: Weeping Angel
 MSRP: 50
 Targets: int
 Class: Psychic

==================================
```


```
==================================
 🎆  Entrance  ◇
----------------------------------

 You strut and preen. Your 
 painful beauty entrances and 
 hits everyone, except yourself.

 Immobilize and hit all 
 opponents.

 If already immobilized, hit 
 instead.
 Hit: 1d20 vs int / Damage: 1d6
 
 +2 advantage vs Basilisk, 
 Gladiator
 
 -2 disadvantage vs Minotaur, 
 Weeping Angel
 ineffective against Jinn

 Opponent breaks free by rolling 
 1d20 vs immobilizer's int +/- 
 advantage/disadvantage - (turns 
 immobilized * 3)
 Hits immobilizer back on stroke 
 of luck.
 Turns immobilized resets on 
 curse of loki.

 -1 hp each turn immobilized.

 Level: 3
 Usable by: Weeping Angel
 MSRP: 80
 Targets: int
 Class: Psychic

==================================
```


```
==================================
 📶  Ecdysis  ○
----------------------------------

 Evolve into your more perfect 
 form.

 Boost: dex +1
 Boost: str +1

 Level: 2
 Usable by: Basilisk
 MSRP: 50
 Class: Boost

==================================
```


```
==================================
 🐈  Feline Companion  ○
----------------------------------

 A low purr in your ears helps 
 you focus your energy.

 Boost: int +2 (max boost of 
 level * 2, or 1 for beginner, 
 then boost granted to hp 
 instead).

 Level: 2
 Usable by: Bard, Cleric
 Heal chance: 20% | HPT: 0
 MSRP: 80
 Class: Boost

==================================
```


```
==================================
 😖  Fight or Flight  •
----------------------------------

 Survival instincts are nothing 
 to be ashamed of.

 Hit: 1d20 vs ac / Damage: 1d6
 Chance to flee if below a 
 quarter health

 Level: Beginner
 Usable by: All
 Hit chance: 70% | DPT: 3
 MSRP: 10
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 🐀  Fists of Villainy  ◆
----------------------------------

 You show no mercy to the weak.

 Hit: 1d20 vs ac / Damage: 1d6
 Strikes opponent with lowest 
 current hp.

 Level: 1
 Usable by: All
 Hit chance: 71% | DPT: 3
 MSRP: 20
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 🙏  Fists of Virtue  ○
----------------------------------

 You strike at the biggest bully 
 in the room.

 Hit: 1d20 vs ac / Damage: 1d8
 Strikes opponent with highest 
 current hp.

 Level: 1
 Usable by: All
 Hit chance: 73% | DPT: 4
 MSRP: 30
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 🏃  Flee  ◆
----------------------------------

 There is no shame in living to 
 fight another day.

 Chance to run away if bloodied 
 (hp < half)

 Level: Beginner
 Usable by: All
 MSRP: 10
 Class: Hide

==================================
```


```
==================================
 ⑂⑂  Forked Metal Rod  ★
----------------------------------

 A dangerously sharp forked metal 
 rod fashioned for Gladiator and 
 Basilisk-hunting.

 Attack twice (once with each 
 prong). +2 to hit and immobilize 
 for each successful prong hit.

 Chance to immobilize: 1d20 vs 
 str.

 If already immobilized, hit 
 instead.
 Hit: 1d20 vs ac / Damage: 1d6
 
 +5 advantage vs Gladiator, 
 Basilisk
 
 +1 advantage vs Jinn, Minotaur
 ineffective against Weeping 
 Angel

 Opponent breaks free by rolling 
 1d20 vs immobilizer's str + 
 advantage - (turns immobilized * 
 3)
 Hits immobilizer back on stroke 
 of luck.
 Turns immobilized resets on 
 curse of loki.

 Level: 2
 Usable by: Fighter, Barbarian
 Hit chance: 96% | DPT: 7
 Effect chance: 75%
 MSRP: 80
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 ⑂  Forked Stick  ◆
----------------------------------

 A simple weapon fashioned for 
 Basilisk and Gladiator-hunting.

 Attempt to immobilize your 
 opponent by pinning them between 
 the branches of a forked stick.

 Chance to immobilize: 1d20 vs 
 str.
 If already immobilized, hit 
 instead.
 Hit: 1d20 vs dex / Damage: 1d4
 
 +2 advantage vs Basilisk, 
 Gladiator
 
 -2 disadvantage vs Jinn, 
 Minotaur
 ineffective against Weeping 
 Angel

 Opponent breaks free by rolling 
 1d20 vs immobilizer's str +/- 
 advantage/disadvantage - (turns 
 immobilized * 3)
 Hits immobilizer back on stroke 
 of luck.
 Turns immobilized resets on 
 curse of loki.

 Level: Beginner
 Usable by: Bard, Barbarian, 
 Fighter
 Hit chance: 64% | DPT: 2
 Effect chance: 61%
 MSRP: 50
 Targets: dex
 Class: Melee

==================================
```


```
==================================
 💊  Heal  ○
----------------------------------

 A well-timed healing can be the 
 difference between sweet victory 
 and devastating defeat.

 Health: 1d4
 + int bonus (diminished by 1 
 each use until 0, then resets)

 1% chance to heal half max hp
 1% chance to poison

 Level: Beginner
 Usable by: All
 Hit chance: 1% | DPT: 0
 Heal chance: 95% | HPT: 3
 MSRP: 10
 Class: Heal

==================================
```


```
==================================
 👊  Hit  •
----------------------------------

 A basic attack, the staple of 
 all good monsters.

 Hit: 1d20 vs ac / Damage: 1d6

 Level: Beginner
 Usable by: All
 Hit chance: 73% | DPT: 3
 MSRP: 10
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 🔨  Hit Harder  ○
----------------------------------

 You hit just a little bit harder 
 than the average bear...

 Hit: 1d20 vs ac / Damage: 1d6
 Roll for damage twice, and use 
 the best result.

 Level: 2
 Usable by: Barbarian, Fighter
 Hit chance: 70% | DPT: 4
 MSRP: 130
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 🐂  Horn Gore  ☆
----------------------------------

 You think those horns are just 
 there to look pretty? Think 
 again...

 Attack twice (once with each 
 horn). +2 to hit and immobilize 
 for each successful horn hit.

 If either horn hits, chance to 
 immobilize: 1d20 vs str.

 If already immobilized, hit 
 instead.
 Hit: 1d20 vs ac / Damage: 1d4
 
 -2 disadvantage vs Minotaur, 
 Gladiator
 
 -6 disadvantage vs Basilisk, 
 Jinn, Weeping Angel

 Opponent breaks free by rolling 
 1d20 vs immobilizer's str - 
 disadvantage - (turns 
 immobilized * 3)
 Hits immobilizer back on stroke 
 of luck.
 Turns immobilized resets on 
 curse of loki.

 Level: Beginner
 Usable by: Minotaur
 Hit chance: 71% | DPT: 3
 Effect chance: 50%
 MSRP: 130
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 ⾓  Horn Swipe  ◇
----------------------------------

 Swing your horns at your 
 opponent.

 Hit: 1d20 vs str / Damage: 1d6
 Roll twice for hit. Use the best 
 roll. Stroke of Luck and Curse 
 of Loki apply only to the 
 selected roll (discarded rolls 
 do not crit).

 Level: 2
 Usable by: Minotaur
 Hit chance: 93% | DPT: 4
 MSRP: 50
 Targets: str
 Class: Melee

==================================
```


```
==================================
 ⚗️  Iocane  ◆
----------------------------------

 They were both poisoned. I spent 
 the last few years building up 
 an immunity to iocane powder...

 Hit: 1d20 vs ac / Damage: 2d4
 - or, below 1/4 health -
 Health: 2d4
 + int bonus (diminished by 1 
 each use until 0, then resets)

 1% chance to heal half max hp
 1% chance to poison

 Level: 1
 Usable by: Bard, Cleric
 Hit chance: 70% | DPT: 4
 Heal chance: 0% | HPT: 0
 MSRP: 20
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 🎻  The Kalevala (1d4)  ★
----------------------------------

 Steadfast old Väinämöinen 
 himself fashioned this 
 instrument of eternal joy. Tune 
 its pikebone pegs and it may 
 lead you on to victory.

 Hit: 1d20 vs int / Damage: 1d4

 Level: 1
 Usable by: All
 Hit chance: 75% | DPT: 8
 MSRP: 80
 Targets: int
 Class: Acoustic, Psychic

==================================
```


```
==================================
 🚬  Lucky Strike  ◇
----------------------------------

 A man in a jester's hat smiles 
 at you from the crowd. You 
 feel... Lucky for some reason. 
 Or perhaps feel the unluckiness 
 of your opponent...

 Hit: 1d20 vs ac / Damage: 1d6
 Roll twice for hit. Use the best 
 roll. Stroke of Luck and Curse 
 of Loki apply only to the 
 selected roll (discarded rolls 
 do not crit).

 Level: 2
 Usable by: Bard, Cleric, Fighter
 Hit chance: 90% | DPT: 4
 MSRP: 50
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 🌠  Mesmerize  ○
----------------------------------

 You strut and preen. Your beauty 
 mesmerizes everyone, including 
 yourself.

 Immobilize everyone.

 If already immobilized, hit 
 instead.
 Hit: 1d20 vs int / Damage: 1d6
 
 +2 advantage vs Basilisk, 
 Gladiator
 
 -2 disadvantage vs Minotaur, 
 Weeping Angel
 ineffective against Jinn

 Opponent breaks free by rolling 
 1d20 vs immobilizer's int +/- 
 advantage/disadvantage - (turns 
 immobilized * 3)
 Hits immobilizer back on stroke 
 of luck.
 Turns immobilized resets on 
 curse of loki.

 Level: 1
 Usable by: Weeping Angel
 Hit chance: 14% | DPT: 1
 Effect chance: 80%
 MSRP: 20
 Targets: int
 Class: AOE

==================================
```


```
==================================
 🍯  Molasses  ◆
----------------------------------

 Slow down your enemies like it's 
 1919.

 Hit: 1d20 vs ac / Damage: 1d4
 Curse: dex -1, with a maximum 
 total curse of -3 per level. 
 Afterwards penalties come out of 
 hp instead.

 Level: 1
 Usable by: All
 Hit chance: 72% | DPT: 2
 MSRP: 50
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 👇  Pick Pocket  ○
----------------------------------

 Reach into the pocket of the 
 most skilled player and grab one 
 of their cards to play as your 
 own.

 Level: Beginner
 Usable by: All
 MSRP: 20
 Class: Melee

==================================
```


```
==================================
 ⚒  Pound  ★
----------------------------------

 You wield the mighty pound card 
 and can do double the damage.

 Hit: 1d20 vs ac / Damage: 2d6

 Level: 3
 Usable by: Bard, Barbarian
 Hit chance: 71% | DPT: 6
 MSRP: 130
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 旦  1993-09-7202 18:58  ☆
----------------------------------

 Buy a questionable round of 
 milkshakes for everyone.

 Serve everyone a nice round of 
 milkshakes!
 Usually restores between 0-3hp 
 to each opponent, and 1-4hp for 
 the player.
 1:50 chance to kill each 
 opponent.
 1:100 chance to kill yourself.

 Level: 2
 Usable by: All
 Hit chance: 2% | DPT: 0
 Heal chance: 77% | HPT: 2
 MSRP: 130
 Class: Poison, AOE

==================================
```


```
==================================
 🎲  Random Play  ○
----------------------------------

 You find the illegible scraps of 
 an ancient card in the corner. 
 Curious to see what it does, you 
 play it --as it crumbles to 
 dust.

 Level: Beginner
 Usable by: All
 MSRP: 10
 Class: Psychic

==================================
```


```
==================================
 🔂  Rehit  ◆
----------------------------------

 At the last moment you realize 
 your trajectory is off and 
 quickly attempt to correct your 
 aim.

 Hit: 1d20 vs ac / Damage: 1d6
 Roll for attack, if you roll 
 less than 10, roll again and use 
 the second roll no matter what. 
 Stroke of Luck and Curse of Loki 
 apply only to the selected roll 
 (discarded rolls do not crit).

 Level: 2
 Usable by: Cleric, Fighter
 Hit chance: 87% | DPT: 4
 MSRP: 20
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 🌪  Sandstorm  ☆
----------------------------------

 A blinding cloud of sand whips 
 across the desert, damaging and 
 confusing all those caught in 
 it.

 1 storm damage +1 per level of 
 the jinni to everyone in the 
 ring. Temporarily confuses 
 opponents and causes them to 
 mistake their targets.

 Level: Beginner
 Usable by: Jinn
 Hit chance: 100% | DPT: 1
 Effect chance: 100%
 MSRP: 130
 Class: AOE

==================================
```


```
==================================
 🥃  Scotch  ◇
----------------------------------

 Keep the heid, this battle's far 
 from over.

 Health: 2d6
 + int bonus (diminished by 1 
 each use until 0, then resets)

 1% chance to heal half max hp
 1% chance to poison

 Level: 4
 Usable by: All
 Hit chance: 1% | DPT: 0
 Heal chance: 99% | HPT: 5
 MSRP: 80
 Class: Heal

==================================
```


```
==================================
 🗡  Survival Knife  ◆
----------------------------------

 If times get too rough, stab 
 yourself in the thigh and press 
 the pommel for a Stimpak 
 injection.

 Hit: 1d20 vs ac / Damage: 2d4
 - or, below 1/4 health -
 Health: 2d4
 + int bonus (diminished by 1 
 each use until 0, then resets)

 1% chance to heal half max hp
 1% chance to poison

 Level: 1
 Usable by: Fighter
 Hit chance: 72% | DPT: 4
 MSRP: 20
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 🔬  Thick Skin  ○
----------------------------------

 Grow a heavy layer of scales to 
 deflect the blows of thine 
 enemies.

 Boost: ac +2 (max boost of level 
 * 2, or 1 for beginner, then 
 boost granted to hp instead).
 If hit by melee attack, damage 
 comes out of ac boost first.

 Level: 2
 Usable by: Basilisk
 Heal chance: 20% | HPT: 0
 MSRP: 50
 Class: Boost

==================================
```


```
==================================
 🍗  Turkey Thigh  ◆
----------------------------------

 Beat your opponent with a huge 
 turkey thigh. If times get 
 tough, take a bite for a quick 
 hp boost.

 Hit: 1d20 vs ac / Damage: 2d4
 - or, below 1/4 health -
 Health: 2d4
 + int bonus (diminished by 1 
 each use until 0, then resets)

 1% chance to heal half max hp
 1% chance to poison

 Level: 1
 Usable by: Barbarian
 Hit chance: 70% | DPT: 4
 Heal chance: 0% | HPT: 0
 MSRP: 20
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 👊  Vengeful Rampage  ◇
----------------------------------

 Your wounds only make you 
 stronger.

 Hit: 1d20 vs ac
 Damage: 1d6 +1 per wound 
 suffered

 Level: 3
 Usable by: Barbarian
 Hit chance: 72% | DPT: 9
 MSRP: 80
 Targets: ac
 Class: Melee

==================================
```


```
==================================
 🥃  Whiskey Shot  ○
----------------------------------

 1 shot of whiskey for your 
 health. Doctor's orders.

 Health: 1d8
 + int bonus (diminished by 1 
 each use until 0, then resets)

 1% chance to heal half max hp
 1% chance to poison

 Level: 2
 Usable by: All
 Hit chance: 1% | DPT: 0
 Heal chance: 97% | HPT: 4
 MSRP: 50
 Class: Heal

==================================
```


```
==================================
 🌳  Wooden Spear  ○
----------------------------------

 A simple weapon fashioned for 
 Minotaur-hunting.

 Hit: 1d20 vs ac / Damage: 1d6
 +3 damage vs Minotaur

 Level: 1
 Usable by: Bard, Fighter
 Hit chance: 71% | DPT: 4
 MSRP: 30
 Targets: ac
 Class: Melee

==================================
```

── Item Catalog ──────────────────────
Chocolate Bar, Potion of Healing, Pokecen, Spin Up, Swiss Chocolate, Chaos Theory for Beginners According to Clever Hans, Chaos Theory for Beginners, The Way of the Cobra Kai According to Clever Hans, The Way of the Cobra Kai, House Lannister According To Clever Hans, House Lannister, The Ballad of La Carambada According to Clever Hans, The Ballad of La Carambada, Lottery Ticket, The Gospel According to Clever Hans, The Gospel According to Parsifal, The Annals of Qin Shi Huang According to Clever Hans, The Annals of Qin Shi Huang, The Tale of Sir Robin According to Clever Hans, The Tale of Sir Robin, Sorting Hat

```
==================================
 🍫  Chocolate Bar  ○
----------------------------------

 A quick snack to restore 1 hp.

 Usable 1 time.

 Level: 1
 Usable by: All
 MSRP: 20

==================================
```


```
==================================
 💊  Potion of Healing  ○
----------------------------------

 Instantly heal 8 hp.

 Usable 1 time.

 Level: 1
 Usable by: All
 MSRP: 50

==================================
```


```
==================================
 🏩  Pokecen  ○
----------------------------------

 ポケモンセンター Heal Your Monsters!

 Usable 1 time.

 Level: 1
 Usable by: All
 MSRP: 50

==================================
```


```
==================================
 🧠  Spin Up  ○
----------------------------------

 Instantly spin monster back up 
 in a new sleeve.

 Usable 1 time.

 Level: 1
 Usable by: All
 MSRP: 20

==================================
```


```
==================================
 🍫  Swiss Chocolate  ☆
----------------------------------

 Only the finest Swiss chocolate. 
 Restores 10 hp.

 Usable 1 time.

 Level: 1
 Usable by: All
 MSRP: 20

==================================
```


```
==================================
 👦  Chaos Theory for Beginners 
 According to Clever Hans  ○
----------------------------------

 Tiny variations, the orientation 
 of hairs on your hand, the 
 amount of blood distending your 
 vessels, imperfections in the 
 skin... vastly affect the 
 outcome.

 Your mother told you to target a 
 random monster in the ring 
 rather than following a defined 
 order, and that's exactly what 
 you'll do.

 Usable 3 times.

 Level: 1
 Usable by: All
 MSRP: 10

==================================
```


```
==================================
 🦋  Chaos Theory for Beginners  
 ○
----------------------------------

 Tiny variations, the orientation 
 of hairs on your hand, the 
 amount of blood distending your 
 vessels, imperfections in the 
 skin... vastly affect the 
 outcome.

 Target a random opponent in the 
 ring (other than yourself) 
 rather than following a defined 
 order

 Usable 3 times.

 Level: 1
 Usable by: All
 MSRP: 20

==================================
```


```
==================================
 👦  The Way of the Cobra Kai 
 According to Clever Hans  ○
----------------------------------

 We do not train to be merciful 
 here. Mercy is for the weak. 
 Here, in the streets, in 
 competition: A man confronts 
 you, he is the enemy. An enemy 
 deserves no mercy.

 Your mother told you to target 
 the weakest monster in the ring, 
 every time, and that's exactly 
 what you'll do.

 Usable 3 times.

 Level: 1
 Usable by: All
 MSRP: 10

==================================
```


```
==================================
 🐍  The Way of the Cobra Kai  ○
----------------------------------

 We do not train to be merciful 
 here. Mercy is for the weak. 
 Here, in the streets, in 
 competition: A man confronts 
 you, he is the enemy. An enemy 
 deserves no mercy.

 You target the weakest player in 
 the ring, every time.

 Usable 3 times.

 Level: 1
 Usable by: All
 MSRP: 20

==================================
```


```
==================================
 👦  House Lannister According To 
 Clever Hans  ○
----------------------------------

 A Lannister always pays his 
 debts...

 Your mother told you to target 
 the monster who attacked you 
 last, unless directed otherwise 
 by a specific card, and that's 
 exactly what you'll do.

 Usable 3 times.

 Level: 1
 Usable by: All
 MSRP: 10

==================================
```


```
==================================
 🦁  House Lannister  ○
----------------------------------

 A Lannister always pays his 
 debts...

 Target the opponent who attacked 
 you last, unless directed 
 otherwise by a specific card.

 Usable 3 times.

 Level: 1
 Usable by: All
 MSRP: 20

==================================
```


```
==================================
 👦  The Ballad of La Carambada 
 According to Clever Hans  ○
----------------------------------

 Junto a ellos, aterrorizó la 
 comarca, aguardando el día de la 
 venganza. Hizo fama por su 
 diestro manejo de la pistola, 
 del machete y, sobre todo, por 
 su extraordinaria habilidad para 
 cabalgar. En tiempos en que las 
 mujeres acompañaban a sus 
 hombres a un lado del caballo, 
 ver a una mujer galopando era un 
 acontecimiento mayor.

 Your mother told you to target 
 whoever has the highest maximum 
 hp in the ring even if they 
 currently have less hp, and 
 that's exactly what you'll do.

 Usable 3 times.

 Level: 1
 Usable by: All
 MSRP: 10

==================================
```


```
==================================
 💃  The Ballad of La Carambada  
 ○
----------------------------------

 Junto a ellos, aterrorizó la 
 comarca, aguardando el día de la 
 venganza. Hizo fama por su 
 diestro manejo de la pistola, 
 del machete y, sobre todo, por 
 su extraordinaria habilidad para 
 cabalgar. En tiempos en que las 
 mujeres acompañaban a sus 
 hombres a un lado del caballo, 
 ver a una mujer galopando era un 
 acontecimiento mayor.

 Target whoever has the highest 
 maximum hp in the ring (other 
 than yourself) even if they 
 currently have less hp.

 Usable 3 times.

 Level: 1
 Usable by: All
 MSRP: 20

==================================
```


```
==================================
 💰  Lottery Ticket  •
----------------------------------

 Play the odds for a chance to 
 win up to 10000 coins.

 Usable 1 time.

 Level: Beginner
 Usable by: All
 MSRP: 10

==================================
```


```
==================================
 🐎  The Gospel According to 
 Clever Hans  •
----------------------------------

 Your mother said that my mother 
 said that if you know your enemy 
 and know yourself, you will not 
 be put at risk even in a hundred 
 battles. If you only know 
 yourself, but not your opponent, 
 you may win or may lose. If you 
 know neither yourself nor your 
 enemy, you will always endanger 
 yourself.

 Your mother told you to keep 
 your strategy simple: your 
 opponent is always the person to 
 your right (wait, no, your other 
 right --No no, the other 
 other... You know what? Just 
 forget it... That one's fine).

 Usable 3 times.

 Level: Beginner
 Usable by: All
 MSRP: 20

==================================
```


```
==================================
 🏇  The Gospel According to 
 Parsifal  •
----------------------------------

 My mother said that if you know 
 your enemy and know yourself, 
 you will not be put at risk even 
 in a hundred battles. If you 
 only know yourself, but not your 
 opponent, you may win or may 
 lose. If you know neither 
 yourself nor your enemy, you 
 will always endanger yourself.

 Keep your strategy simple: your 
 opponent is always the person 
 next to you.

 Usable an unlimited number of 
 times.

 Level: Beginner
 Usable by: All
 MSRP: 20

==================================
```


```
==================================
 👦  The Annals of Qin Shi Huang 
 According to Clever Hans  ○
----------------------------------

 焚書坑儒

 Your mother told you to target 
 the monster who has the highest 
 xp, and that's exactly what 
 you'll do.

 Usable 3 times.

 Level: 1
 Usable by: All
 MSRP: 10

==================================
```


```
==================================
 焚  The Annals of Qin Shi Huang  
 ○
----------------------------------

 焚書坑儒

 Target the opponent who has the 
 highest xp.

 Usable 3 times.

 Level: 1
 Usable by: All
 MSRP: 20

==================================
```


```
==================================
 👦  The Tale of Sir Robin 
 According to Clever Hans  ○
----------------------------------

 He was not in the least bit 
 scared to be mashed into a pulp, 
 or to have his eyes gouged out, 
 and his elbows broken, to have 
 his kneecaps split, and his body 
 burned away... brave Sir Robin!

 Your mother told you to target 
 whichever monster currently has 
 the highest hp, and that's 
 exactly what you'll do.

 Usable 3 times.

 Level: 1
 Usable by: All
 MSRP: 10

==================================
```


```
==================================
 🙏  The Tale of Sir Robin  ○
----------------------------------

 He was not in the least bit 
 scared to be mashed into a pulp, 
 or to have his eyes gouged out, 
 and his elbows broken, to have 
 his kneecaps split, and his body 
 burned away... brave Sir Robin!

 Target whichever opponent 
 currently has the highest hp.

 Usable 3 times.

 Level: 1
 Usable by: All
 MSRP: 20

==================================
```


```
==================================
 🎩  Sorting Hat  •
----------------------------------

 This enchanted hat that once 
 belonged to Godric Gryffindor. 
 Put it on and find out where you 
 truly belong.

 If your character has joined a 
 team but your monster hasn't, 
 that monster will be on your 
 character's team by default.

 Usable 1 time.

 Level: Beginner
 Usable by: All
 MSRP: free

==================================
```
