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
give [item] to [monster]      stock a monster before a fight
take [item] from [monster]    return it to your pocket
use [item] on [monster]       use a named item
use item                      choose an item to use on yourself
visit the shop                browse and buy through the guided console flow
sell to the shop              sell pocket items or cards
```

The Workshop provides direct use, purchase, and sell buttons. The console and Discord retain
the guided flows too, plus items that need an extra answer (currently only the Sorting Hat),
which are not yet offered as a prompt-free web button.

## Potions and utility items

| Item | Effect |
|---|---|
| Chocolate Bar | Restores 1 HP. |
| Potion of Healing | Restores 8 HP once. |
| Swiss Chocolate | Restores 10 HP. |
| Pokecen | Heals a monster; usable once. |
| Spin Up | Revives a dead monster in a new sleeve; usable once. It has no effect on a living monster and is not consumed then. |
| Lottery Ticket | Used on your character for a chance to win coins; usable once. |
| Sorting Hat | Chooses a team, or **No team** if you are on one of your own. Teammates go after everyone else first and only turn on each other when nobody else is left. A monster with no team of its own fights for its beastmaster's. Every shop keeps one in stock, free. It asks a follow-up question, so use it through the console or Discord rather than the prompt-free web button. To leave a team without a hat, type `leave team`: it takes you and all your monsters off any team. |

## Targeting scrolls

Targeting scrolls permanently change how a monster chooses opponents until another scroll
changes it. Most can be used three times. The monster's stat card shows them as its
orders (`[monster]'s orders:`). “According to Clever Hans” variants use the corresponding imperfect/mistaken
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
you already own, and the rotation time — for pocket items, cards for sale and the back room
alike, matching what the console's `visit the shop` flow offers. A purchase is checked again
atomically when you confirm: the shop generation, stock position and item name are checked
again. If somebody else bought that stock or the shop rotated, you are asked to refresh
rather than receiving an item from a different listing or merchant. Buying a card adds it to
your deck, the same as buying an item adds it to your pocket inventory.

Selling is also on the Workshop shop, in its own "Sell to the shop" section, listing your own
unequipped cards and pocket items (never a card equipped onto a monster, and never a
monster's own carried items — those never left your character's inventory in the console
flow either). Pick a quantity for a type you own more than one of, and confirm — the dialog
names the item, quantity, and coins you will receive before anything leaves your hands, the
same safety the console's yes/no step gives. The price is the shop's current buy-back rate
for that card or item: `sell to the shop` in the console and Discord still works too, and both
surfaces pay the same rate for the same shop. Sale prices are always lower than face value and
vary by merchant. Your balance is also shown in the Workshop's header, and updates as soon as
a fight you were in pays out — not only when the shop section itself refreshes.

## Practical preparation

1. Inspect a prospective item and its remaining uses.
2. Give fight-critical items to the monster before sending it to the ring.
3. Treat carried slots as part of the build: healing buys survival, while targeting scrolls
   change who receives the deck's attacks.
4. Watch the live roster. If the monster needs help, open **Use an item** in the ring pane;
   you do not need to leave the fight or answer a prompt chain.

For card order and builds see [CARDS.md](CARDS.md). For complete game rules and commands see
[PLAYER_HANDBOOK.md](PLAYER_HANDBOOK.md).

<!-- generated:every-item:start -->

## Every item

Each item with its full card. Generated from the game; the rules above explain how to use them.

### Chaos Theory for Beginners

```text
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

### Chaos Theory for Beginners According to Clever Hans

```text
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

### Chocolate Bar

```text
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

### House Lannister

```text
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

### House Lannister According To Clever Hans

```text
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

### Lottery Ticket

```text
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

### Pokecen

```text
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

### Potion of Healing

```text
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

### Sorting Hat

```text
==================================
 🎩  Sorting Hat  •
----------------------------------

 Join a team, switch teams, or 
 leave one. Teammates go after 
 everyone else in the ring first, 
 and only turn on each other when 
 nobody else is left. If your 
 character has joined a team but 
 your monster hasn't, that 
 monster is on your character's 
 team.

 It's free, and every shop keeps 
 one in stock, because choosing a 
 side should never cost you. 
 `leave team` also takes you and 
 your monsters off a team for 
 free.

 An enchanted hat that once 
 belonged to Godric Gryffindor. 
 Put it on and find out where you 
 truly belong.

 Usable 1 time.

 Level: Beginner
 Usable by: All
 MSRP: free

==================================
```

### Spin Up

```text
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

### Swiss Chocolate

```text
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

### The Annals of Qin Shi Huang

```text
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

### The Annals of Qin Shi Huang According to Clever Hans

```text
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

### The Ballad of La Carambada

```text
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

### The Ballad of La Carambada According to Clever Hans

```text
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

### The Gospel According to Clever Hans

```text
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

### The Gospel According to Parsifal

```text
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

### The Tale of Sir Robin

```text
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

### The Tale of Sir Robin According to Clever Hans

```text
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

### The Way of the Cobra Kai

```text
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

### The Way of the Cobra Kai According to Clever Hans

```text
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

<!-- generated:every-item:end -->
