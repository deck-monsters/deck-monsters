#!/usr/bin/env node
/**
 * Read Layer 3's fights (roadmap 34 task 7; plan from `plan-holders`):
 * `node dist/scripts/sim-holders.js <holders-run> <catalogue.json> <ladder-run>... [--json out.json]`.
 *
 * - Chassis: each monster's score with the reference field hand against the reference chassis
 *   holding the same hand, and that score as Hit-equivalents over 9 (what the body is worth, in
 *   Hits, with the hand held fixed).
 * - Holders: each restricted card on each real monster that can hold it, in Hit-equivalents
 *   against the same monster with 9 Hits, beside its reference-chassis value from the
 *   catalogue. The ladder is measured on the reference chassis; it is nearly level- and
 *   body-independent near 50% (ladder report), so a holder's mirror is read through it, from
 *   the nearest ladder level. Differences over 0.5 HE are flagged: a type bonus or a stat the
 *   card leans on.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readResults } from '../balance/results.js';
import { ladderFromResults, toHE } from '../balance/ladder.js';
import type { UnitResult } from '../balance/units.js';

const args = process.argv.slice(2);
const jsonIndex = args.indexOf('--json');
const jsonOut = jsonIndex >= 0 ? args[jsonIndex + 1] : undefined;
const positional = jsonIndex >= 0 ? args.filter((_, i) => i !== jsonIndex && i !== jsonIndex + 1) : args;
const [runDir, cataloguePath, ...ladderDirs] = positional;
if (!runDir || !cataloguePath || !ladderDirs.length) {
	process.stderr.write('Usage: sim-holders <holders-run> <catalogue.json> <ladder-run>... [--json out.json]\n');
	process.exit(2);
}

interface CatalogueJson {
	cards: Array<{ cardType: string; label: string; she: Record<string, number> }>;
}
const catalogue = JSON.parse(readFileSync(cataloguePath, 'utf8')) as CatalogueJson;
const ladder = ladderFromResults(ladderDirs.flatMap(dir => readResults(dir)));
const ladderLevels = Object.keys(ladder).map(Number);
const nearestLadder = (level: number): number => ladderLevels.reduce((a, b) => (Math.abs(b - level) < Math.abs(a - level) ? b : a));
const he = (level: number, score: number): number => toHE(ladder, nearestLadder(level), score);

const results = readResults(runDir).filter(r => !r.error);
const pooled = (rs: UnitResult[]): number => rs.reduce((a, r) => a + r.sides[0]!.score * r.fights, 0) / Math.max(1, rs.reduce((a, r) => a + r.fights, 0));
const of = (kind: string): UnitResult[] => results.filter(r => r.tags?.kind === kind);
const types = [...new Set(of('chassis').map(r => String(r.tags!.type)))];
const fmt = (x: number | undefined, d = 2): string => (x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(d));

const chassisLevels = [...new Set(of('chassis').map(r => Number(r.tags!.level)))].sort((a, b) => a - b);
const chassis: Record<string, Record<number, { score: number; he: number }>> = {};
const lines: string[] = [];
lines.push('## Chassis value', '', 'Score (%) with the reference field hand against the reference chassis with the same hand, and in Hit-equivalents over the reference (score read through the ladder, minus 9).', '');
lines.push(`| Monster | ${chassisLevels.map(l => `L${l}`).join(' | ')} |`, `|${Array(chassisLevels.length + 1).fill('---').join('|')}|`);
for (const type of types) {
	chassis[type] = {};
	const cells = chassisLevels.map(level => {
		const score = pooled(of('chassis').filter(r => r.tags!.type === type && r.tags!.level === level));
		const value = he(level, score) - 9;
		chassis[type]![level] = { score, he: value };
		return `${(100 * score).toFixed(0)}% (${value >= 0 ? '+' : ''}${value.toFixed(1)})`;
	});
	lines.push(`| ${type} | ${cells.join(' | ')} |`);
}

const holderLevels = [...new Set(of('holder').map(r => Number(r.tags!.level)))].sort((a, b) => a - b);
const holders: Array<{ type: string; card: string; onHolder: Record<number, number>; reference: Record<number, number> }> = [];
lines.push('', '## Cards on their real holders', '', 'Hit-equivalents on the holder (in 8 Hits, against the same monster with 9 Hits), then the reference-chassis value from the catalogue. Flagged where they differ by more than 0.5.', '');
lines.push(`| Monster | Card | ${holderLevels.map(l => `L${l} holder / ref`).join(' | ')} | Flag |`, `|${Array(holderLevels.length + 3).fill('---').join('|')}|`);
for (const type of types) {
	const cards = [...new Set(of('holder').filter(r => r.tags!.type === type).map(r => String(r.tags!.card)))];
	for (const card of cards) {
		const entry = catalogue.cards.find(c => c.cardType === card);
		const row = { type, card, onHolder: {} as Record<number, number>, reference: {} as Record<number, number> };
		const flags: string[] = [];
		const cells = holderLevels.map(level => {
			const rs = of('holder').filter(r => r.tags!.type === type && r.tags!.card === card && r.tags!.level === level);
			if (!rs.length) return '—';
			const value = he(level, pooled(rs)) - 8;
			const ref = entry?.she[String(level)];
			row.onHolder[level] = value;
			if (ref !== undefined) row.reference[level] = ref;
			if (ref !== undefined && Math.abs(value - ref) > 0.5) flags.push(`L${level} ${value > ref ? '+' : ''}${(value - ref).toFixed(1)}`);
			return `${fmt(value)} / ${fmt(ref)}`;
		});
		holders.push(row);
		lines.push(`| ${type} | ${entry?.label ?? card} | ${cells.join(' | ')} | ${flags.join('; ')} |`);
	}
}
process.stdout.write(`${lines.join('\n')}\n`);
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify({ chassisLevels, holderLevels, chassis, holders }, null, 1)}\n`);
process.exit(0);
