import { formatCommandList } from '../commands/catalog.js';
import { DEFAULT_MONSTER_SLOTS } from '../characters/beastmaster.js';

export const FIGHT_DELAY_SECONDS = 60;
export const MAX_MONSTERS = 12;
export const MIN_MONSTERS = 2;
export const XP_THRESHOLDS = [50, 100, 150, 250, 400, 650, 1050] as const;

export const HANDBOOK_HEADER = `
╔══════════════════════════════════╗
║     PLAYER HANDBOOK              ║
║     Deck Monsters                ║
╚══════════════════════════════════╝

Welcome to Deck Monsters — the monster-training, deck-building, turn-based RPG.

You train monsters to fight beside you. Build their decks, send them into the ring, and watch them fight automatically. Earn coins and XP to grow stronger.

Choose your cards wisely, good luck, and have fun!
`.trim();

export const GETTING_STARTED = `
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

A beastmaster can keep up to ${DEFAULT_MONSTER_SLOTS} monsters at a time.
`.trim();

export const THE_RING = `
── The Ring ─────────────────────────

The ring is where automated fights take place. Once ${MIN_MONSTERS} or more monsters are present, a fight starts every ${FIGHT_DELAY_SECONDS} seconds.

The ring holds up to ${MAX_MONSTERS} monsters at once. Monsters fight in turn order, each playing the next card in their deck. When the deck runs out it loops back to the beginning.

Call your monster back at any time:
   call [monster name] out of the ring

Check who's fighting:
   look at the ring
`.trim();

export const XP_AND_LEVELING = `
── XP and Leveling ──────────────────

Monsters earn XP from every fight, win or lose. More XP unlocks higher-level cards.

Level thresholds (XP required):
  Beginner: 0–${XP_THRESHOLDS[0] - 1} XP
${XP_THRESHOLDS.map((xp, i) => `  Level ${i + 1}: ${xp}+ XP`).join('\n')}

Higher levels unlock more powerful cards in the shop and allow you to equip better equipment.
`.trim();

export const YOUR_DECK = `
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
`.trim();

export const COINS_AND_SHOP = `
── Coins and the Shop ───────────────

Every completed fight pays coins: 5 for a win and 2 for a loss, flee, or draw. Your first completed fight of each UTC day also pays a 5-coin participation bonus (a permanent death pays 4 before that bonus). The daily bonus is automatic — there is nothing to claim. Spend coins at the shop to expand your card pool and buy items.

The merchant changes every 6 hours, so prices and stock rotate. Each room has its own merchant, so what's in stock next door has nothing to do with what's in stock here. Never sell to the shop for less than a card is worth — shop prices are always lower than face value, but some merchants are fairer than others.

   visit the shop         — browse and buy
   sell to the shop       — sell cards or items

The web Workshop shows live room stock, your balance, affordability, owned counts, rare back-room goods and direct purchase buttons. Selling still uses the guided console flow.
`.trim();

export const YOUR_CHARACTER = `
── Your Character ───────────────────

Your character name and icon are separate from your account profile and belong to the current room. To change either one, enter this in the room Console or in Discord:

   edit my character

Choose Name or Icon/color, enter the new value, and confirm the change. This edits your person — the beastmaster named in ring announcements — rather than one of your monsters.
`.trim();

export const COMBAT_STATS_AND_ROLES = `
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
`.trim();

export const BUILD_STRATEGIES = `
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
`.trim();

export const collectPlayerHandbookSections = (): string[] => [
	HANDBOOK_HEADER,
	GETTING_STARTED,
	THE_RING,
	XP_AND_LEVELING,
	YOUR_DECK,
	COINS_AND_SHOP,
	YOUR_CHARACTER,
	`── All Commands ─────────────────────\n\n${formatCommandList()}`,
	COMBAT_STATS_AND_ROLES,
	BUILD_STRATEGIES,
];

export const collectPlayerHandbookMarkdown = (): string =>
	collectPlayerHandbookSections().join('\n\n');
