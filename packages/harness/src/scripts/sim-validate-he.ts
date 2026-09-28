#!/usr/bin/env node
/**
 * Validate the Hit-equivalent (roadmap 34 task 4): `node dist/scripts/sim-validate-he.js
 * <ladder-run-dir> <validate-run-dir>`.
 *
 * - Slot weights: w_p is the HE lost by a null in slot p (a Hit is worth w_p there); by default
 *   a straight-line fit over the slots (`--weights raw|smooth|uniform`).
 * - Single values: a variant's HE from its score in each slot, averaged over slots (the ladder
 *   also averages positions), minus the 8 Hits beside it.
 * - Stacking: per-copy value with 2 and 3 copies against the single value.
 * - Prediction: a held-out mix's HE is 9 + sum over slots of (value - 1) * w_p (a Hit is 1, a
 *   null 0), converted to a score through the ladder, against its simulated score. Pass mark:
 *   mean absolute error 5 points or less; the noise floor is printed beside it.
 */
import { readResults } from '../balance/results.js';
import { fromHE, ladderFromResults, toHE } from '../balance/ladder.js';
import type { UnitResult } from '../balance/units.js';

const [ladderDir, validateDir] = process.argv.slice(2);
const weightMode = (process.argv.includes('--weights') ? process.argv[process.argv.indexOf('--weights') + 1] : 'smooth') as 'raw' | 'smooth' | 'uniform';
if (!ladderDir || !validateDir) {
	process.stderr.write('Usage: sim-validate-he <ladder-run-dir> <validate-run-dir>\n');
	process.exit(2);
}
const ladder = ladderFromResults(readResults(ladderDir));
const results = readResults(validateDir).filter(r => !r.error);
const strikeName = (dice: string): string => `Ideal:Strike:${JSON.stringify({ damageDice: dice })}`;
const of = (kind: string): UnitResult[] => results.filter(r => r.tags?.kind === kind);
const pooled = (rs: UnitResult[]): number => rs.reduce((a, r) => a + r.sides[0]!.score * r.fights, 0) / Math.max(1, rs.reduce((a, r) => a + r.fights, 0));
const levels = [...new Set(results.map(r => Number(r.tags!.level)))].sort((a, b) => a - b);

const weights = new Map<number, number[]>();
const single = new Map<string, number>();
for (const level of levels) {
	const raw = Array.from({ length: 9 }, (_, p) => 9 - toHE(ladder, level, pooled(of('he-slot').filter(r => r.tags!.level === level && r.tags!.slot === p))));
	// Raw per-slot weights are noisy (a few hundred fights each). `smooth` fits a straight line
	// over the slots (least squares) and rescales it to the raw mean; `uniform` ignores position.
	const meanRaw = raw.reduce((a, b) => a + b, 0) / 9;
	const slope = raw.reduce((a, w, p) => a + (p - 4) * (w - meanRaw), 0) / raw.reduce((a, _, p) => a + (p - 4) ** 2, 0);
	const smooth = raw.map((_, p) => Math.max(0, meanRaw + slope * (p - 4)));
	const w = weightMode === 'raw' ? raw : weightMode === 'uniform' ? raw.map(() => meanRaw) : smooth;
	weights.set(level, w);
	process.stdout.write(`L${level} slot weights, ${weightMode} (HE a Hit is worth in slot 1..9): ${w.map(x => x.toFixed(2)).join(' ')}  mean ${(w.reduce((a, b) => a + b, 0) / 9).toFixed(2)}\n`);
}

process.stdout.write('\nVariant value (HE), position-balanced; then per copy with 2 and 3 copies:\n');
for (const level of levels) {
	for (const dice of [...new Set(of('he-single').map(r => String(r.tags!.dice)))]) {
		const perSlot = Array.from({ length: 9 }, (_, p) => {
			const r = of('he-single').find(x => x.tags!.level === level && x.tags!.dice === dice && x.tags!.slot === p);
			return r ? toHE(ladder, level, r.sides[0]!.score) - 8 : NaN;
		});
		// Each slot's HE is already position-weighted: about 1 + (v - 1) * w[p]. Averaged over the
		// nine slots that is 1 + (v - 1) * mean(w), so divide the weighting back out before the
		// prediction applies w[p] again (a Codex review of #408: weights that do not average to 1
		// were being applied twice).
		const meanW = weights.get(level)!.reduce((a, b) => a + b, 0) / 9;
		const value = 1 + (perSlot.reduce((a, b) => a + b, 0) / 9 - 1) / meanW;
		single.set(`${level}|${strikeName(dice)}`, value);
		const stacked = [2, 3].map(c => (toHE(ladder, level, pooled(of('he-stack').filter(r => r.tags!.level === level && r.tags!.dice === dice && r.tags!.copies === c))) - (9 - c)) / c);
		process.stdout.write(`  L${level} ${dice.padEnd(5)} single ${value.toFixed(2).padStart(5)}   x2 ${stacked[0]!.toFixed(2).padStart(5)}   x3 ${stacked[1]!.toFixed(2).padStart(5)}\n`);
	}
}

const mixes = of('he-mix');
let absError = 0;
let noise = 0;
const rows: string[] = [];
for (const r of mixes) {
	const level = Number(r.tags!.level);
	const hand = JSON.parse(String(r.tags!.hand)) as string[];
	const w = weights.get(level)!;
	const value = (card: string): number => (card === 'Hit' ? 1 : card === 'Ideal:Null' ? 0 : (single.get(`${level}|${card}`) ?? NaN));
	const he = 9 + hand.reduce((sum, card, p) => sum + (value(card) - 1) * w[p]!, 0);
	const predicted = fromHE(ladder, level, he);
	const actual = r.sides[0]!.score;
	absError += Math.abs(predicted - actual);
	noise += Math.sqrt((actual * (1 - actual)) / r.fights) * Math.sqrt(2 / Math.PI);
	rows.push(`  L${level} HE ${he.toFixed(2).padStart(5)}  predicted ${(100 * predicted).toFixed(0).padStart(3)}  actual ${(100 * actual).toFixed(0).padStart(3)}`);
}
if (mixes.length) {
	const mae = (100 * absError) / mixes.length;
	process.stdout.write(`\nHeld-out mixes (${mixes.length}):\n${rows.join('\n')}\n`);
	process.stdout.write(`\nMean absolute error ${mae.toFixed(1)} points (noise floor ${((100 * noise) / mixes.length).toFixed(1)}); pass mark 5: ${mae <= 5 ? 'PASS' : 'FAIL'}\n`);
}
process.exit(0);
