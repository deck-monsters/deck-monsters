import { formatCommandList } from '../commands/catalog.js';

type ChannelFn = (opts: { announce: string }) => Promise<unknown>;

const FIGHT_DELAY_SECONDS = 60;
const MAX_MONSTERS = 12;
const MIN_MONSTERS = 2;

const XP_THRESHOLDS = [50, 100, 150, 250, 400, 650, 1050];

const HANDBOOK_HEADER = `
╔══════════════════════════════════╗
║     PLAYER HANDBOOK              ║
║     Deck Monsters                ║
╚══════════════════════════════════╝

Welcome to Deck Monsters — the monster capturing, deck-building, turn-based RPG.

You capture monsters to fight for you. Build their decks, send them into the ring, and watch them battle automatically. Earn coins and XP to grow stronger.

Choose your cards wisely, good luck, and have fun!
`.trim();

const GETTING_STARTED = `
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
`.trim();

const THE_RING = `
── The Ring ─────────────────────────

The ring is the auto-battle arena. Once ${MIN_MONSTERS} or more monsters are present, a fight starts every ${FIGHT_DELAY_SECONDS} seconds.

The ring holds up to ${MAX_MONSTERS} monsters at once. Monsters battle in turn order, each playing the next card in their deck. When the deck runs out it loops back to the beginning.

Call your monster back at any time:
   summon [monster name] from the ring

Check who's fighting:
   look at the ring
`.trim();

const XP_AND_LEVELING = `
── XP and Leveling ──────────────────

Monsters earn XP from every battle, win or lose. More XP unlocks higher-level cards.

Level thresholds (XP required):
  Beginner: 0–${XP_THRESHOLDS[0] - 1} XP
${XP_THRESHOLDS.map((xp, i) => `  Level ${i + 1}: ${xp}+ XP`).join('\n')}

Higher levels unlock more powerful cards in the shop and allow you to equip better equipment.
`.trim();

const YOUR_DECK = `
── Your Deck & Cards ─────────────────

Your card pool is shared across all your monsters. You can hold up to 4 copies of any individual card.

When equipping, the order matters — your monster plays cards in the order you set them. A good deck mixes attack, defense, and recovery cards.

   look at cards          — see your full deck
   look at [card name]    — inspect a specific card

Items work similarly. You can carry up to 3 items, and give up to 3 more to each monster. Items used mid-battle must be pre-assigned to the monster before the fight.
`.trim();

const COINS_AND_SHOP = `
── Coins and the Shop ───────────────

Earn coins by winning (and even losing) battles. Spend them at the shop to expand your card pool and buy items.

The merchant changes every 8 hours, so prices and stock rotate. Never sell to the shop for less than a card is worth — shop prices are always lower than face value, but some merchants are fairer than others.

   visit the shop         — browse and buy
   sell to the shop       — sell cards or items
`.trim();

const BUILD_STRATEGIES = `
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
`.trim();

export const playerHandbook = (channel: ChannelFn): Promise<unknown> =>
	Promise.resolve()
		.then(() => channel({ announce: HANDBOOK_HEADER }))
		.then(() => channel({ announce: GETTING_STARTED }))
		.then(() => channel({ announce: THE_RING }))
		.then(() => channel({ announce: XP_AND_LEVELING }))
		.then(() => channel({ announce: YOUR_DECK }))
		.then(() => channel({ announce: COINS_AND_SHOP }))
		.then(() => channel({ announce: `── All Commands ─────────────────────\n\n${formatCommandList()}` }))
		.then(() => channel({ announce: BUILD_STRATEGIES }));

export default playerHandbook;
