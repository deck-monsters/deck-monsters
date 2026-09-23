╔══════════════════════════════════╗
║     PLAYER HANDBOOK              ║
║     Deck Monsters                ║
╚══════════════════════════════════╝

Welcome to Deck Monsters — the monster-training, deck-building, turn-based RPG.

You train monsters to fight beside you. Build their decks, send them into the ring, and watch them fight automatically. Earn coins and XP to grow stronger.

Choose your cards wisely, good luck, and have fun!

── Getting Started ──────────────────

1) Train a monster
   train a monster

2) Equip it with your cards
   equip [monster name]

   Or specify cards directly:
   equip [monster name] with "Hit", "Heal", "Hit"

3) Send it to the ring
   send [monster name] to the ring

That's it — your monster will fight automatically once the fight begins.

A beastmaster can keep up to 10 monsters at a time.

── The Ring ─────────────────────────

The ring is where automated fights take place. Once 2 or more monsters are present, a fight starts every 60 seconds.

The ring holds up to 12 monsters at once. Monsters fight in turn order, each playing the next card in their deck. When the deck runs out it loops back to the beginning.

Call your monster back at any time:
   call [monster name] out of the ring

Check who's fighting:
   look at the ring

── XP and Leveling ──────────────────

Monsters earn XP from every fight, win or lose. More XP unlocks higher-level cards.

Level thresholds (XP required):
  Beginner: 0–49 XP
  Level 1: 50+ XP
  Level 2: 100+ XP
  Level 3: 150+ XP
  Level 4: 250+ XP
  Level 5: 400+ XP
  Level 6: 650+ XP
  Level 7: 1050+ XP

Higher levels unlock more powerful cards in the shop and allow you to equip better equipment.

── Your Deck & Cards ─────────────────

Your card pool is shared across all your monsters. You can hold up to 4 copies of any individual card.

When equipping, the order matters — your monster plays cards in the order you set them. A good deck mixes attack, defense, and recovery cards.

Some cards roll more than once (Lucky Strike, Horn Swipe, Rehit). Critical success (natural 20) and Curse of Loki (natural 1) apply only to the roll the card keeps — a discarded roll never crits.

   look at cards          — see your cards
   look at [card name]    — inspect a specific card

Items work similarly. You can carry up to 3 items, and give up to 3 more to each monster. Items used mid-fight must be pre-assigned to the monster before the fight.

   look at items                — see every item and who carries it
   give [item] to [monster]     — stock a monster before a fight
   take [item] from [monster]   — return it to your pocket
   use [item] on [monster]      — use it (even mid-fight, if carried in)

On the web, the Workshop shows valid targets and remaining uses. During your monster's fight, open "Use an item" below the ring roster for a one-step action.

── Coins and the Shop ───────────────

Every completed fight pays coins: 5 for a win and 2 for a loss, flee, or draw. Your first completed fight of each UTC day also pays a 5-coin participation bonus (a permanent death pays 4 before that bonus). The daily bonus is automatic — there is nothing to claim. Spend coins at the shop to expand your card pool and buy items.

The merchant changes every 6 hours, so prices and stock rotate. Each room has its own merchant, so what's in stock next door has nothing to do with what's in stock here. Never sell to the shop for less than a card is worth — shop prices are always lower than face value, but some merchants are fairer than others.

   visit the shop         — browse and buy
   sell to the shop       — sell cards or items

The web Workshop shows live room stock, your balance, affordability, owned counts, rare back-room goods and direct purchase buttons. Selling still uses the guided console flow.

── Your Character ───────────────────

Your character name and icon are separate from your account profile and belong to the current room. To change either one, enter this in the room Console or in Discord:

   edit my character

Choose Name or Icon/color, enter the new value, and confirm the change. This edits your person — the beastmaster named in ring announcements — rather than one of your monsters.

── All Commands ─────────────────────

Deck Monsters — Commands

-- Monsters --
  train a monster
    Train a new monster
  equip [monster]
    Equip a monster with your cards
  equip [monster] with "Card", "Card"
    Equip a monster with specific cards. For a card name containing a quote character, use a JSON array instead: ["Card"]
  dismiss [monster]
    Part ways with a monster for good
  revive [monster]
    Revive a fallen monster
  look at monsters
    View all your monsters
  look at monsters in detail
    View your monsters with full stats
  look at [monster]
    View a specific monster's stats

-- The Ring --
  send [monster] to the ring
    Send a monster to the ring
  send monster to the ring
    Select a monster and send to the ring
  call [monster] out of the ring
    Call a monster out of the ring
  summon a boss
    Call a boss into the ring to fight your monster (3 per day)
  look at the ring
    See which monsters are currently fighting

-- Cards --
  look at cards
    View your cards
  look at card inventory
    View equipped and unequipped cards together
  look at all cards
    Alias for card inventory
  look at inventory
    View all cards and items across your character and monsters
  look at [card name]
    View details about a specific card
  look at card [card name]
    View details about a specific card
  look at deck
    View your full card inventory
  unequip [card] from [monster]
    Remove a card from a monster back to your cards
  unequip [count] [card] from [monster]
    Remove multiple copies of a card from a monster
  unequip all from [monster]
    Clear a monster's full deck back to your inventory
  move [card] from [monster A] to [monster B]
    Move a card directly between monsters
  move [count] [card] from [monster A] to [monster B]
    Move multiple copies directly between monsters
  save preset [name] for [monster]
    Save a monster's current deck as a preset
  load preset [name] on [monster]
    Load a preset onto a monster
  look at presets for [monster]
    List saved presets for a monster
  delete preset [name] for [monster]
    Delete a saved preset

-- Items --
  look at items
    View your items
  look at [item name]
    View details about a specific item
  use item
    Use one of your items on yourself
  use [item] on [monster]
    Use an item on one of your monsters
  give [item] to [monster]
    Give an item to a monster to carry
  take [item] from [monster]
    Retrieve an item from a monster

-- The Shop --
  visit the shop
    Browse and buy items from the merchant
  sell to the shop
    Sell cards or items to the merchant

-- Your Character --
  edit my character
    Edit your character's name and icon
  look at character
    View your character stats and info

-- Reference --
  help
    Show this command reference
  look at player handbook
    Read the full player handbook
  look at monster manual
    Browse all monster types
  look at dm guide
    Read the dungeon master guide

── Combat Stats & Card Roles ─────────

DEX is melee accuracy and DEX saves. It is also the defense a card uses when that card strikes DEX, so a higher DEX makes a pin such as Forked Stick harder to land. STR is melee damage and STR checks, including pin and escape rolls that use STR. INT is curse and psychic accuracy, healing, and INT damage, and it is the defense those cards strike. AC is the defense melee cards roll against. An AC boost absorbs melee damage before that damage reaches HP. AC does not add to an attack. HP is how much damage a monster can take. Level raises these stats and unlocks higher-level cards.

Temporary boosts and curses affect both the stat and rolls derived from it.

A monster plays the deck from the first card to the last, then starts again at the top. Card order is the order of play. Put a setup card ahead of the card that spends it.

Damage cards spend the turn on HP. Healing cards spend the turn on recovery. Control cards, such as a pin, take the opponent's next card away. Reactive cards answer a blow instead of swinging now. Targeting and matchup cards are strong against some monsters and weak against others. Average damage per turn leaves out a pin, a stacked answer, and a card that only pays off against the monster in front of you.

Delayed Hits can remain armed together. Every copy still armed on that monster answers the next qualifying blow.

Molasses → Forked Stick is a setup. Molasses lowers DEX. Forked Stick then pins against that lower DEX. Play Molasses first.

Example, not a universal best deck. This illustration is a Level 3 Minotaur deck for an unknown opponent:

  equip [monster] with "Molasses", "Forked Stick", "Delayed Hit", "Delayed Hit", "Horn Gore", "Adrenaline Rush", "Hit Harder", "Heal", "Heal"

One-Heal alternative: replace the second "Heal" with "Hit" when you would rather spend that turn on damage and trust a single recovery.

Matchup swap: Forked Stick pins a Basilisk or a Gladiator more easily. It is at a disadvantage against a Jinn or another Minotaur, and it does not pin a Weeping Angel. Against another Minotaur, replace "Forked Stick" with "Horn Gore". Against a Jinn or a Weeping Angel, replace "Forked Stick" with "Hit Harder".

── Example Deck Builds ───────────────

Further illustrations by monster and level. Change a list when you know who is waiting in the ring. When hidden, use a stat boost or a healing card. When your opponent is pinned, a card that does not deal damage is a good use of the turn they miss.

Minotaur (Level 1):
  equip [monster] with "Horn Gore", "Delayed Hit", "Delayed Hit", "Heal", "Hit", "Hit", "Hit", "Hit", "Heal"

Gladiator (Level 1):
  equip [monster] with "Soften", "Forked Stick", "Battle Focus", "Camouflage Vest", "Heal", "Delayed Hit", "Delayed Hit", "Forked Stick", "Survival Knife", "Wooden Spear"

Jinn (Level 2):
  equip [monster] with "Sandstorm", "Enchanted Faceswap", "Lucky Strike", "Forked Stick", "Soften", "Delayed Hit", "Forked Stick", "Delayed Hit", "Heal"

Basilisk (Level 3):
  equip [monster] with "Constrict", "Thick Skin", "Delayed Hit", "Coil", "Whiskey Shot", "Delayed Hit", "Berserk", "Hit Harder", "Hit"

Weeping Angel (Level 4):
  equip [monster] with "Blink", "Delayed Hit", "Delayed Hit", "Mesmerize", "Scotch", "Blast", "Blast", "Pick Pocket", "Random Play"

Minotaur (Level 5):
  equip [monster] with "Camouflage Vest", "Delayed Hit", "Delayed Hit", "Soften", "Forked Metal Rod", "Horn Gore", "Turkey Thigh", "Hit Harder", "Berserk"

Gladiator (Level 6):
  equip [monster] with "Camouflage Vest", "Basic Shield", "Delayed Hit", "Forked Metal Rod", "Camouflage Vest", "Scotch", "Delayed Hit", "Lucky Strike", "Battle Focus"