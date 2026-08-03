import allMonsters from '../monsters/helpers/all.js';
import { BASE_DEX, BASE_INT, BASE_STR } from '../constants/stats.js';
import {
	acRangeAtLevel,
	formatNumericRange,
	getMonsterTypeOffsets,
	hpRangeAtLevel,
} from './monster-stat-ranges.js';

type ChannelFn = (opts: { announce: string }) => Promise<unknown>;

export function buildMonsterEntry(Monster: new (...args: any[]) => any, level = 0): string {
	const offsets = getMonsterTypeOffsets(Monster);
	const m = Monster as any;
	const hp = hpRangeAtLevel(offsets.typeHpOffset, level);
	const ac = acRangeAtLevel(offsets.typeAcOffset, level);
	const sign = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);
	const desc: string = m.description ? m.description.trim() : '';

	return `
${offsets.creatureType} (${offsets.classLabel})
${'─'.repeat(40)}
HP:  ${formatNumericRange(hp)} (spawn + level ${level})
AC:  ${formatNumericRange(ac)} (spawn + level ${level})
STR: ${BASE_STR + offsets.strModifier} (base ${sign(offsets.strModifier)})
DEX: ${BASE_DEX + offsets.dexModifier} (base ${sign(offsets.dexModifier)})
INT: ${BASE_INT + offsets.intModifier} (base ${sign(offsets.intModifier)})

${desc ? desc.slice(0, 300) + (desc.length > 300 ? '...' : '') : ''}
`.trim();
}

export const monsterManual = ({ channel }: { channel: ChannelFn }): Promise<unknown> => {
	const entries = allMonsters.map(Monster => buildMonsterEntry(Monster, 0));

	const header = `Monster Manual\n${'═'.repeat(40)}\n${allMonsters.length} monster types:\n\n`;

	return entries.reduce(
		(p: Promise<unknown>, entry: string) => p.then(() => channel({ announce: entry })),
		channel({ announce: header })
	);
};

export default monsterManual;
