import { writeFileSync } from 'node:fs';

import { formatCommandList } from '../commands/catalog.js';
import { generateCardCatalogue } from './card-catalogue.js';
import { DM_ONLY_MARKERS } from './dm-only-sections.js';
import { generateDungeonMasterGuide } from './dungeon-master-guide.js';
import { buildMonsterEntry } from './monster-manual.js';
import allMonsters from '../monsters/helpers/all.js';
import { generateCardCatalogueHtml } from './card-catalogue-html.js';

const FIGHT_DELAY_SECONDS = 60;
const MAX_MONSTERS = 12;
const MIN_MONSTERS = 2;

export { DM_ONLY_MARKERS };

type Collector = string[];

const collectSections = async (generate: (output: (section: string) => Promise<void>) => Promise<void>): Promise<string> => {
	const sections: Collector = [];
	await generate(section => {
		sections.push(section);
		return Promise.resolve();
	});

	return sections.join('\n');
};

const DMG_ASCII_HEADER = `
\`\`\`
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
\`\`\`
`.trim();

const CARDS_ASCII_HEADER = `
\`\`\`
			.------..------..------..------..------.
			|C.--. ||A.--. ||R.--. ||D.--. ||S.--. |
			| :/\\: || (\\/) || :(): || :/\\: || :/\\: |
			| :\\/: || :\\/: || ()() || (__) || :\\/: |
			| '--'C|| '--'A|| '--'R|| '--'D|| '--'S|
			\`------'\`------'\`------'\`------'\`------'
\`\`\`
`.trim();

const MONSTERS_ASCII_HEADER = `
\`\`\`

 ███▄ ▄███▓ ▒█████   ███▄    █   ██████ ▄▄▄█████▓▓█████  ██▀███
▓██▒▀█▀ ██▒▒██▒  ██▒ ██ ▀█   █ ▒██    ▒ ▓  ██▒ ▓▒▓█   ▀ ▓██ ▒ ██▒
▓██    ▓██░▒██░  ██▒▓██  ▀█ ██▒░ ▓██▄   ▒ ▓██░ ▒░▒███   ▓██ ░▄█ ▒
▒██    ▒██ ▒██   ██░▓██▒  ▐▌██▒  ▒   ██▒░ ▓██▓ ░ ▒▓█  ▄ ▒██▀▀█▄
▒██▒   ░██▒░ ████▓▒░▒██░   ▓██░▒██████▒▒  ▒██▒ ░ ░▒████▒░██▓ ▒██▒
░ ▒░   ░  ░░ ▒░▒░▒░ ░ ▒░   ▒ ▒ ▒ ▒▓▒ ▒ ░  ▒ ░░   ░░ ▒░ ░░ ▒▓ ░▒▓░
░  ░      ░  ░ ▒ ▒░ ░ ░░   ░ ▒░░ ░▒  ░ ░    ░     ░ ░  ░  ░▒ ░ ▒░
░      ░   ░ ░ ░ ▒     ░   ░ ░ ░  ░  ░    ░         ░     ░░   ░
       ░       ░ ░           ░       ░              ░  ░   ░

    ███▄ ▄███▓ ▄▄▄       ███▄    █  █    ██  ▄▄▄       ██▓
   ▓██▒▀█▀ ██▒▒████▄     ██ ▀█   █  ██  ▓██▒▒████▄    ▓██▒
   ▓██    ▓██░▒██  ▀█▄  ▓██  ▀█ ██▒▓██  ▒██░▒██  ▀█▄  ▒██░
   ▒██    ▒██ ░██▄▄▄▄██ ▓██▒  ▐▌██▒▓▓█  ░██░░██▄▄▄▄██ ▒██░
   ▒██▒   ░██▒ ▓█   ▓██▒▒██░   ▓██░▒▒█████▓  ▓█   ▓██▒░██████▒
   ░ ▒░   ░  ░ ▒▒   ▓▒█░░ ▒░   ▒ ▒ ░▒▓▒ ▒ ▒  ▒▒   ▓▒█░░ ▒░▓  ░
   ░  ░      ░  ▒   ▒▒ ░░ ░░   ░ ▒░░░▒░ ░ ░   ▒   ▒▒ ░░ ░ ▒  ░
   ░      ░     ░   ▒      ░   ░ ░  ░░░ ░ ░   ░   ▒     ░ ░
          ░         ░  ░         ░    ░           ░  ░    ░  ░
\`\`\`
`.trim();

const HANDBOOK_HEADER = `
╔══════════════════════════════════╗
║     PLAYER HANDBOOK              ║
║     Deck Monsters                ║
╚══════════════════════════════════╝

Welcome to Deck Monsters — the monster capturing, deck-building, turn-based RPG.

You capture monsters to fight for you. Build their decks, send them into the ring, and watch them battle automatically. Earn coins and XP to grow stronger.

Choose your cards wisely, good luck, and have fun!
`.trim();

const HANDBOOK_GETTING_STARTED = `
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

const HANDBOOK_RING = `
── The Ring ─────────────────────────

The ring is the auto-battle arena. Once ${MIN_MONSTERS} or more monsters are present, a fight starts every ${FIGHT_DELAY_SECONDS} seconds.

The ring holds up to ${MAX_MONSTERS} monsters at once. Monsters battle in turn order, each playing the next card in their deck. When the deck runs out it loops back to the beginning.

Call your monster back at any time:
   summon [monster name] from the ring

Check who's fighting:
   look at the ring
`.trim();

const HANDBOOK_XP = `
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
`.trim();

const HANDBOOK_DECK = `
── Your Deck & Cards ─────────────────

Your card pool is shared across all your monsters. You can hold up to 4 copies of any individual card.

When equipping, the order matters — your monster plays cards in the order you set them. A good deck mixes attack, defense, and recovery cards.

Some cards roll more than once (Lucky Strike, Horn Swipe, Rehit). Critical success (natural 20) and Curse of Loki (natural 1) apply only to the roll the card keeps — a discarded roll never crits.

   look at cards          — see your full deck
   look at [card name]    — inspect a specific card

Items work similarly. You can carry up to 3 items, and give up to 3 more to each monster. Items used mid-battle must be pre-assigned to the monster before the fight.
`.trim();

const HANDBOOK_SHOP = `
── Coins and the Shop ───────────────

Earn coins by winning (and even losing) battles. Spend them at the shop to expand your card pool and buy items.

The merchant changes every 6 hours, so prices and stock rotate. Each room has its own merchant, so what's in stock next door has nothing to do with what's in stock here. Never sell to the shop for less than a card is worth — shop prices are always lower than face value, but some merchants are fairer than others.

   visit the shop         — browse and buy
   sell to the shop       — sell cards or items
`.trim();

const HANDBOOK_BUILDS = `
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

export const collectDmgMarkdown = async (): Promise<string> => {
	const body = await collectSections(generateDungeonMasterGuide);

	return `${DMG_ASCII_HEADER}\n\n${body}`;
};

export const collectCardsMarkdown = async (): Promise<string> => {
	const body = await collectSections(generateCardCatalogue);

	return `${CARDS_ASCII_HEADER}\n\n${body}`;
};

export const collectMonstersMarkdown = async (): Promise<string> => {
	const monsterList = allMonsters.map((Monster: { creatureType?: string }) => Monster.creatureType ?? '').join('\n');
	const entries = allMonsters.map((Monster: new () => object) => buildMonsterEntry(Monster)).join('\n\n');

	return `${MONSTERS_ASCII_HEADER}

There are ${allMonsters.length} different types of monsters:

${monsterList}

Stat ranges by monster type (deterministic reference):
${entries}
`;
};

export const collectPlayerHandbookMarkdown = async (): Promise<string> =>
	[
		HANDBOOK_HEADER,
		HANDBOOK_GETTING_STARTED,
		HANDBOOK_RING,
		HANDBOOK_XP,
		HANDBOOK_DECK,
		HANDBOOK_SHOP,
		`── All Commands ─────────────────────\n\n${formatCommandList()}`,
		HANDBOOK_BUILDS,
	].join('\n\n');

export const collectCardsHtml = async (): Promise<string> =>
	collectSections(generateCardCatalogueHtml);

export type WriteFileFn = (basename: string, content: string, suffix?: string) => void;

export const generateRootDocs = async (writeFile: WriteFileFn): Promise<void> => {
	writeFile('DMG', await collectDmgMarkdown());
	writeFile('CARDS', await collectCardsMarkdown());
	writeFile('MONSTERS', await collectMonstersMarkdown());
	writeFile('PLAYER_HANDBOOK', await collectPlayerHandbookMarkdown());
	writeFile('cards', await collectCardsHtml(), 'html');
};

export const generateRootDocsToDisk = async (rootDir = '.'): Promise<void> => {
	const writeFile: WriteFileFn = (basename, content, suffix = 'md') => {
		writeFileSync(`${rootDir}/${basename}.${suffix}`, content);
	};

	await generateRootDocs(writeFile);
};

export default generateRootDocs;
