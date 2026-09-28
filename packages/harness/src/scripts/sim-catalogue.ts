#!/usr/bin/env node
/**
 * Read the real-card catalogue (roadmap 34 task 6): `node dist/scripts/sim-catalogue.js
 * <catalogue-run-dir> <ladder-run-dir>... [--json out.json] [--md out.md]`.
 *
 * Per card and level:
 * - sHE: its value in Hit-equivalents on the reference chassis against 9 Hits, through the
 *   calibration ladder (position-balanced: the card in every slot of 8 Hits).
 * - field HE: its value against the reference field, as 1 + (score - 9 Hits' score) / slope,
 *   where the slope is what one Hit is worth against the field (9 Hits against a null in 8 Hits).
 * Flags compare each card to its action class's median sHE at that level: above 1.5x (with a
 * rarity premium of 1.25x for rare and 1.5x for epic on top, owner's rule) or below 0.5x.
 */
import { writeFileSync } from 'node:fs';
import { engineReady } from '@deck-monsters/engine';
import '../sim-env.js';
import '../set-env.js';
import { readResults } from '../balance/results.js';
import { ladderFromResults, toHE } from '../balance/ladder.js';
import { catalogueCards, type CardInfo } from '../balance/catalogue.js';
import type { UnitResult } from '../balance/units.js';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const [catalogueDir, ...ladderDirs] = positional;
if (!catalogueDir || !ladderDirs.length) {
	process.stderr.write('Usage: sim-catalogue <catalogue-run-dir> <ladder-run-dir>... [--json out.json] [--md out.md]\n');
	process.exit(2);
}

const rarityName = (p: number): string => (p <= 5 ? 'epic' : p <= 10 ? 'very rare' : p <= 15 ? 'rare' : p <= 25 ? 'uncommon' : p <= 40 ? 'common' : 'abundant');
const premium = (p: number): number => (p <= 10 ? 1.5 : p <= 15 ? 1.25 : 1);
const median = (xs: number[]): number => {
	const s = xs.filter(x => Number.isFinite(x)).sort((a, b) => a - b);
	if (!s.length) return NaN;
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

async function main(): Promise<void> {
	await engineReady;
	const ladder = ladderFromResults(ladderDirs.flatMap(dir => readResults(dir)));
	const all = readResults(catalogueDir!);
	const ok = all.filter(r => !r.error);
	const errors = all.filter(r => r.error);
	const pooled = (rs: UnitResult[]): number => rs.reduce((a, r) => a + r.sides[0]!.score * r.fights, 0) / Math.max(1, rs.reduce((a, r) => a + r.fights, 0));
	const levels = [...new Set(ok.map(r => Number(r.tags!.level)))].sort((a, b) => a - b);

	const fieldBase = new Map<number, { hits: number; slope: number }>();
	for (const level of levels) {
		const base = ok.filter(r => r.tags?.kind === 'catalogue-base' && r.tags.level === level);
		const hits = pooled(base.filter(r => r.tags!.base === 'hits'));
		const withNull = pooled(base.filter(r => r.tags!.base === 'null'));
		fieldBase.set(level, { hits, slope: hits - withNull });
	}

	const cards = catalogueCards();
	type Row = CardInfo & { she: Record<number, number>; fieldHe: Record<number, number>; errors: number; flags: string[] };
	const rows: Row[] = cards.map(card => ({ ...card, she: {}, fieldHe: {}, errors: errors.filter(r => r.id.includes(`:${card.cardType}:`)).length, flags: [] }));
	for (const row of rows) {
		for (const level of levels) {
			const mine = ok.filter(r => r.tags?.kind === 'catalogue' && r.tags.card === row.cardType && r.tags.level === level);
			const vsHits = mine.filter(r => r.tags!.opponent === 'hits');
			const vsField = mine.filter(r => r.tags!.opponent === 'field');
			if (vsHits.length && ladder[level]) row.she[level] = toHE(ladder, level, pooled(vsHits)) - 8;
			const base = fieldBase.get(level);
			if (vsField.length && base && base.slope > 0) row.fieldHe[level] = 1 + (pooled(vsField) - base.hits) / base.slope;
		}
	}
	const classes = [...new Set(rows.map(r => r.actionClass))];
	for (const level of levels) {
		for (const cls of classes) {
			const inClass = rows.filter(r => r.actionClass === cls && Number.isFinite(r.she[level]));
			const m = median(inClass.map(r => r.she[level]!));
			if (!(m > 0.2) || inClass.length < 3) continue;
			for (const r of inClass) {
				const v = r.she[level]!;
				if (v > 1.5 * premium(r.probability) * m) r.flags.push(`L${level} high (${(v / m).toFixed(1)}x class median)`);
				if (v < 0.5 * m) r.flags.push(`L${level} low (${(v / m).toFixed(1)}x)`);
			}
		}
	}

	const fmt = (x: number | undefined): string => (x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(2));
	const header = `| Card | Class | Rarity | Holders | ${levels.map(l => `sHE L${l}`).join(' | ')} | ${levels.map(l => `field L${l}`).join(' | ')} | Flags |`;
	const sep = `|${Array(4 + 2 * levels.length + 1).fill('---').join('|')}|`;
	const byClass = [...rows].sort((a, b) => a.actionClass.localeCompare(b.actionClass) || (b.she[levels[0]!] ?? -9) - (a.she[levels[0]!] ?? -9));
	const lines = byClass.map(r => `| ${r.cardType} | ${r.actionClass} | ${rarityName(r.probability)} | ${r.holders} | ${levels.map(l => fmt(r.she[l])).join(' | ')} | ${levels.map(l => fmt(r.fieldHe[l])).join(' | ')} | ${[...r.flags, r.errors ? `${r.errors} unit errors` : ''].filter(Boolean).join('; ')} |`);
	const medians = classes.map(cls => `| ${cls} | ${levels.map(l => fmt(median(rows.filter(r => r.actionClass === cls).map(r => r.she[l]!)))).join(' | ')} |`);
	const md = [
		`Units: ${ok.length} ok, ${errors.length} errors. Field baseline per level (9 Hits' score / one Hit's worth): ${levels.map(l => `L${l} ${(100 * fieldBase.get(l)!.hits).toFixed(0)}% / ${(100 * fieldBase.get(l)!.slope).toFixed(1)}`).join(', ')}.`,
		'',
		header,
		sep,
		...lines,
		'',
		`| Class median sHE | ${levels.map(l => `L${l}`).join(' | ')} |`,
		`|${Array(levels.length + 1).fill('---').join('|')}|`,
		...medians,
	].join('\n');
	process.stdout.write(`${md}\n`);
	const mdOut = flag('--md');
	if (mdOut) writeFileSync(mdOut, `${md}\n`);
	const jsonOut = flag('--json');
	if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify({ levels, fieldBase: Object.fromEntries(fieldBase), cards: rows }, null, 1)}\n`);
	if (errors.length) process.stderr.write(`First error: ${errors[0]!.id}: ${errors[0]!.error?.split('\n')[0]}\n`);
	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
