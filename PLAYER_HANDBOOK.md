╔══════════════════════════════════╗
║     PLAYER HANDBOOK              ║
║     Deck Monsters                ║
╚══════════════════════════════════╝

Welcome to Deck Monsters — the monster capturing, deck-building, turn-based RPG.

You capture monsters to fight for you. Build their decks, send them into the ring, and watch them battle automatically. Earn coins and XP to grow stronger.

Choose your cards wisely, good luck, and have fun!

── Getting Started ──────────────────

1) Spawn a monster
   spawn monster

2) Equip it with cards from your deck
   equip [monster name]

   Or specify cards directly:
   equip [monster name] with "Hit", "Heal", "Hit"

3) Send it to the ring
   send [monster name] to the ring

That's it — your monster will fight automatically once the battle begins.

── The Ring ─────────────────────────

The ring is the auto-battle arena. Once 2 or more monsters are present, a fight starts every 60 seconds.

The ring holds up to 12 monsters at once. Monsters battle in turn order, each playing the next card in their deck. When the deck runs out it loops back to the beginning.

Call your monster back at any time:
   summon [monster name] from the ring

Check who's fighting:
   look at the ring

── XP and Leveling ──────────────────

Monsters earn XP from every battle, win or lose. More XP unlocks higher-level cards.

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

   look at cards          — see your full deck
   look at [card name]    — inspect a specific card

Items work similarly. You can carry up to 3 items, and give up to 3 more to each monster. Items used mid-battle must be pre-assigned to the monster before the fight.

── Coins and the Shop ───────────────

Earn coins by winning (and even losing) battles. Spend them at the shop to expand your card pool and buy items.

The merchant changes every 6 hours, so prices and stock rotate. Each room has its own merchant, so what's in stock next door has nothing to do with what's in stock here. Never sell to the shop for less than a card is worth — shop prices are always lower than face value, but some merchants are fairer than others.

   visit the shop         — browse and buy
   sell to the shop       — sell cards or items

── All Commands ─────────────────────

Deck Monsters — Commands

-- Monsters --
  spawn monster
    Spawn a new monster
  equip [monster]
    Equip a monster with cards from your deck
  equip [monster] with "Card", "Card"
    Equip a monster with specific cards. For a card name containing a quote character, use a JSON array instead: ["Card"]
  dismiss [monster]
    Release a monster
  revive [monster]
    Revive a dead monster
  look at monsters
    View all your monsters
  look at monsters in detail
    View your monsters with full stats
  look at [monster]
    View a specific monster's stats

-- The Ring --
  send [monster] to the ring
    Send a monster into battle
  send monster to the ring
    Select a monster and send to the ring
  summon [monster] from the ring
    Call a monster back from battle
  summon a boss
    Call a boss into the ring to fight your monster (3 per day)
  look at the ring
    See which monsters are currently fighting

-- Cards --
  look at cards
    View all cards in your deck
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
    View your full card deck
  unequip [card] from [monster]
    Remove a card from a monster back to your deck
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
  give item to [monster]
    Give an item to a monster to carry
  take item from [monster]
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

── Example Deck Builds ───────────────

Here are some starting strategies by monster type and level. When hidden, use stat boost or healing cards. When your opponent is immobilized, it's a great time to play non-damaging cards since they can't attack you between turns.

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