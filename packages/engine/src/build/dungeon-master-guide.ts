import { actionCard, itemCard } from '../helpers/card.js';
import allCards from '../cards/helpers/all.js';
import allItems from '../items/helpers/all.js';
import allMonsters from '../monsters/helpers/all.js';
import {
	BASE_AC, BASE_DEX, BASE_HP, BASE_INT, BASE_STR,
	AC_VARIANCE, HP_VARIANCE,
} from '../constants/stats.js';
import { eachSeries } from '../helpers/promise.js';
import {
	FIGHT_PACING,
	HOW_TO_RUN_SESSION,
	OPERATOR_CONCURRENCY,
} from './dm-only-sections.js';

type ChannelFn = (opts: { announce: string }) => Promise<unknown>;
export type DocOutputFn = (section: string) => Promise<void> | void;

const DMG_HEADER = `
╔══════════════════════════════════╗
║     DUNGEON MASTER GUIDE         ║
║     Deck Monsters                ║
╚══════════════════════════════════╝

Full card stats, modifier math, damage-per-turn tables, and probability breakdowns.
`.trim();

const ADMIN_COMMANDS = `
── Admin Commands ────────────────────

Run any command as another player (admin only):
  [command] as [player name]
  Example: spawn monster as Alice

Reset the room's game state from the Room Settings page (gear icon in the header).
`.trim();

const STATS_REFERENCE = (() => {
	const sign = (n: number): string => n >= 0 ? `+${n}` : `${n}`;

	const monsterLines = allMonsters.map((Monster: any) => {
		const instance = new Monster();
		const dexMod: number = instance.options?.dexModifier ?? 0;
		const strMod: number = instance.options?.strModifier ?? 0;
		const intMod: number = instance.options?.intModifier ?? 0;
		const hpVar: number = (Monster as any).hpVariance ?? HP_VARIANCE;
		const acVar: number = (Monster as any).acVariance ?? AC_VARIANCE;
		const type: string = (Monster as any).creatureType ?? instance.creatureType ?? Monster.name;
		const cls: string = (Monster as any).class ?? '—';
		return `  ${type} (${cls})\n    HP: ${BASE_HP - hpVar}–${BASE_HP + hpVar}  AC: ${BASE_AC - acVar}–${BASE_AC + acVar}  STR ${sign(strMod)}  DEX ${sign(dexMod)}  INT ${sign(intMod)}`;
	}).join('\n');

	return `
── Stats Reference ───────────────────

Base stats (all monsters start here):
  HP:  ${BASE_HP - HP_VARIANCE}–${BASE_HP + HP_VARIANCE} (base ${BASE_HP} ± ${HP_VARIANCE})
  AC:  ${BASE_AC - AC_VARIANCE}–${BASE_AC + AC_VARIANCE} (base ${BASE_AC} ± ${AC_VARIANCE})
  STR: ${BASE_STR}  DEX: ${BASE_DEX}  INT: ${BASE_INT}

Per-monster-type modifiers:
${monsterLines}
`.trim();
})();

const COMBAT_MATH = `
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
`.trim();

export const generateDungeonMasterGuide = async (output: DocOutputFn): Promise<void> => {
	await output(DMG_HEADER);
	await output(HOW_TO_RUN_SESSION);
	await output(FIGHT_PACING);
	await output(ADMIN_COMMANDS);
	await output(STATS_REFERENCE);
	await output(COMBAT_MATH);
	await output(OPERATOR_CONCURRENCY);

	const cardList = allCards.map((Card: { cardType?: string }) => Card.cardType ?? '').join('\n');
	const itemList = allItems.map((Item: { itemType?: string }) => Item.itemType ?? '').join(', ');

	await output(`── Card Catalog (verbose) ────────────\n${cardList}`);
	await eachSeries(allCards, Card => output(actionCard(new Card(), true)));
	await output(`── Item Catalog ──────────────────────\n${itemList}`);
	await eachSeries(allItems, Item => output(itemCard(new Item(), true)));
};

export const dungeonMasterGuide = async ({ channel }: { channel: ChannelFn }): Promise<void> =>
	generateDungeonMasterGuide(async section => {
		await channel({ announce: section });
	});

export default dungeonMasterGuide;
