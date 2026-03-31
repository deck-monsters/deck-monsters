import allMonsters from '../monsters/helpers/all.js';
import {
	BASE_AC, BASE_DEX, BASE_HP, BASE_INT, BASE_STR,
	AC_VARIANCE, HP_VARIANCE
} from '../constants/stats.js';

type ChannelFn = (opts: { announce: string }) => Promise<unknown>;

function buildMonsterEntry(Monster: any): string {
	const instance = new Monster();
	const m = Monster as any;

	const dexMod: number = instance.options.dexModifier ?? 0;
	const strMod: number = instance.options.strModifier ?? 0;
	const intMod: number = instance.options.intModifier ?? 0;
	const acVar: number = m.acVariance ?? AC_VARIANCE;
	const hpVar: number = m.hpVariance ?? HP_VARIANCE;

	const sign = (n: number): string => n >= 0 ? `+${n}` : `${n}`;

	const dexRange = `${BASE_DEX + dexMod} – ${BASE_DEX + dexMod} (base ${sign(dexMod)})`;
	const strRange = `${BASE_STR + strMod} – ${BASE_STR + strMod} (base ${sign(strMod)})`;
	const intRange = `${BASE_INT + intMod} – ${BASE_INT + intMod} (base ${sign(intMod)})`;
	const hpRange = `${BASE_HP - hpVar} – ${BASE_HP + hpVar}`;
	const acRange = `${BASE_AC - acVar} – ${BASE_AC + acVar}`;

	const classLabel: string = m.class ?? 'Unknown';
	const creatureType: string = m.creatureType ?? instance.creatureType ?? Monster.name;
	const icon: string = instance.icon ?? '';
	const desc: string = m.description ? m.description.trim() : '';

	return `
${icon}  **${creatureType}** (${classLabel})
${'─'.repeat(40)}
HP:  ${hpRange}
AC:  ${acRange}
STR: ${strRange}
DEX: ${dexRange}
INT: ${intRange}

${desc ? desc.slice(0, 300) + (desc.length > 300 ? '...' : '') : ''}
`.trim();
}

export const monsterManual = ({ channel }: { channel: ChannelFn }): Promise<unknown> => {
	const entries = allMonsters.map(buildMonsterEntry);

	const header = `Monster Manual\n${'═'.repeat(40)}\n${allMonsters.length} monster types:\n\n`;

	return entries.reduce(
		(p: Promise<unknown>, entry: string) => p.then(() => channel({ announce: entry })),
		channel({ announce: header })
	);
};

export default monsterManual;
