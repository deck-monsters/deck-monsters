import { actionCard, itemCard } from '../helpers/card.js';
import allCards from '../cards/helpers/all.js';
import allItems from '../items/helpers/all.js';
import allMonsters from '../monsters/helpers/all.js';
import {
	BASE_AC, BASE_DEX, BASE_HP, BASE_INT, BASE_STR,
	AC_VARIANCE, HP_VARIANCE,
} from '../constants/stats.js';

type ChannelFn = (opts: { announce: string }) => Promise<unknown>;

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

Damage:    varies by card (1d4, 1d6, 1d8, 2d4, 2d6...)
Modifiers: STR/DEX/INT bonuses added based on card class

AC boost cards absorb melee damage before HP is reduced.
Stat curses (from cards like Soften, Concussion, Molasses)
cap at -3 per level; further penalties come out of HP instead.
`.trim();

export const dungeonMasterGuide = async ({ channel }: { channel: ChannelFn }): Promise<void> => {
	await channel({ announce: DMG_HEADER });
	await channel({ announce: ADMIN_COMMANDS });
	await channel({ announce: STATS_REFERENCE });
	await channel({ announce: COMBAT_MATH });

	await channel({ announce: `── Card Catalog (verbose) ────────────\n${allCards.map((Card: any) => (Card as any).cardType ?? '').join(', ')}` });
	for (const Card of allCards) {
		await channel({ announce: actionCard(new (Card as any)(), true) });
	}

	await channel({ announce: `── Item Catalog ──────────────────────\n${allItems.map((Item: any) => (Item as any).itemType ?? '').join(', ')}` });
	for (const Item of allItems) {
		await channel({ announce: itemCard(new (Item as any)(), true) });
	}
};

export default dungeonMasterGuide;
