# Items, Inventory, and the Shop

Items are Deck Monsters' **bounded live-combat lever**. Your deck is locked once a fight
starts, but a monster may still use an item it carried into the ring. Choosing what to
stock is therefore part of the build, just like choosing and ordering cards.

## The rule that matters

- Your character can carry up to **3 items**; each monster can carry up to **3 more**.
- Before a fight, pocket items can be used on any compatible owned monster.
- During a fight, a monster can use **only its own carried items**. You cannot move an item
  into or out of an active encounter.
- A monster merely waiting in the ring is not yet fighting, so pocket items can still reach
  it until the encounter begins.
- Used-up items disappear. An item whose conditions are not met is not consumed.

Use the Workshop to see every item, where it is carried, remaining uses, valid targets and
why an unavailable item cannot be used. During your monster's fight, **Use an item** appears
directly below the ring roster for its carried, currently compatible items.

## Commands

```text
look at items                 list pocket and monster-carried items
look at [item name]           inspect an item
give [item] to [monster]      stock a monster before battle
take [item] from [monster]    return it to your pocket
use [item] on [monster]       use a named item
use item                      choose an item to use on yourself
visit the shop                browse and buy through the guided console flow
sell to the shop              sell pocket items or cards
```

The Workshop provides direct use and purchase buttons. The console and Discord retain the
guided flows, including item selling and items that need an extra answer.

## Potions and utility items

| Item | Effect |
|---|---|
| Chocolate Bar | Restores 1 HP. |
| Potion of Healing | Restores 8 HP once. |
| Swiss Chocolate | Restores 10 HP. |
| Pokecen | Heals a monster; usable once. |
| Spin Up | Revives a dead monster in a new sleeve; usable once. It has no effect on a living monster and is not consumed then. |
| Lottery Ticket | Used on your character for a chance to win coins; usable once. |
| Sorting Hat | Chooses a team. It asks a follow-up question, so use it through the console or Discord rather than the prompt-free web button. |

## Targeting scrolls

Targeting scrolls permanently change how a monster chooses opponents until another scroll
changes it. Most can be used three times. The monster's stat card shows its current
`Strategy`. “According to Clever Hans” variants use the corresponding imperfect/mistaken
interpretation and are cheaper.

| Scroll family | Strategy taught |
|---|---|
| Chaos Theory for Beginners | Pick a random opponent. |
| The Way of the Cobra Kai | Target the opponent with the lowest current HP. |
| House Lannister | Retaliate against whoever hit the monster last. |
| The Ballad of La Carambada | Target the opponent with the highest maximum HP. |
| The Gospel According to Parsifal | Target the next eligible opponent in ring order. |
| The Annals of Qin Shi Huang | Target the opponent with the highest XP. |
| The Tale of Sir Robin | Target the opponent with the highest current HP. |

## The room shop

Each room has its own merchant, stock and closing time. Stock rotates every six hours;
another room's purchases cannot affect yours. Standard prices vary with the merchant. Rare
back-room goods cost considerably more.

The Workshop shop shows your coin balance, live stock, price, affordability, how many copies
you already own, and the rotation time. A purchase is checked again atomically when you
confirm: the shop generation, stock position and item name are checked again. If somebody
else bought that stock or the shop rotated, you are asked to refresh rather than receiving
an item from a different listing or merchant. Selling remains available through
`sell to the shop`; sale prices are lower than face value and vary by merchant.

## Practical preparation

1. Inspect a prospective item and its remaining uses.
2. Give fight-critical items to the monster before sending it to the ring.
3. Treat carried slots as part of the build: healing buys survival, while targeting scrolls
   change who receives the deck's attacks.
4. Watch the live roster. If the monster needs help, open **Use an item** in the ring pane;
   you do not need to leave the fight or answer a prompt chain.

For card order and builds see [CARDS.md](CARDS.md). For complete game rules and commands see
[PLAYER_HANDBOOK.md](PLAYER_HANDBOOK.md).
