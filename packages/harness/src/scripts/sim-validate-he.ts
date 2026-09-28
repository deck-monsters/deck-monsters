#!/usr/bin/env node
/**
 * Validate the Hit-equivalent (roadmap 34 task 4): `node dist/scripts/sim-validate-he.js
 * <ladder-run-dir> <validate-run-dir>`.
 *
 * (a) Stacking: a variant's HE with 1, 2, and 3 copies; linear if the per-copy value holds.
 * (b) Prediction: each held-out mix's score predicted from single-copy values (Hit 1, null 0,
 *     a variant its c=1 value) through the ladder, against its simulated score. The pass
 *     mark is a mean absolute error of 5 points or less; the noise floor (the error expected
 *     from sampling alone) is printed beside it.
 */
import { readResults } from '../balance/results.js';
import { fromHE, ladderFromResults, toHE } from '../balance/ladder.js';

const [ladderDir, validateDir] = process.argv.slice(2);
if (!ladderDir || !validateDir) {
	process.stderr.write('Usage: sim-validate-he <ladder-run-dir> <validate-run-dir>\n');
	process.exit(2);
}
const ladder = ladderFromResults(readResults(ladderDir));
const results = readResults(validateDir).filter(r => !r.error);
const strikeName = (dice: string): string => `Ideal:Strike:${JSON.stringify({ damageDice: dice })}`;

const single = new Map<string, number>();
process.stdout.write('Stacking (HE per copy, from c copies + (9-c) Hits against 9 Hits):\n');
const stacks = results.filter(r => r.tags?.kind === 'he-stack');
const levels = [...new Set(stacks.map(r => Number(r.tags!.level)))].sort((a, b) => a - b);
for (const level of levels) {
	const variants = [...new Set(stacks.filter(r => r.tags!.level === level).map(r => String(r.tags!.dice)))];
	for (const dice of variants) {
		const perCopy = [1, 2, 3].map(c => {
			const r = stacks.find(x => x.tags!.level === level && x.tags!.dice === dice && x.tags!.copies === c);
			if (!r) return NaN;
			const he = toHE(ladder, level, r.sides[0]!.score);
			return (he - (9 - c)) / c;
		});
		single.set(`${level}|${strikeName(dice)}`, perCopy[0]!);
		process.stdout.write(`  L${level} ${dice.padEnd(5)} ${perCopy.map(v => v.toFixed(2).padStart(6)).join('')}\n`);
	}
}

const mixes = results.filter(r => r.tags?.kind === 'he-mix');
let absError = 0;
let noise = 0;
const rows: string[] = [];
for (const r of mixes) {
	const level = Number(r.tags!.level);
	const hand = JSON.parse(String(r.tags!.hand)) as string[];
	const he = hand.reduce((sum, card) => sum + (card === 'Hit' ? 1 : card === 'Ideal:Null' ? 0 : (single.get(`${level}|${card}`) ?? NaN)), 0);
	const predicted = fromHE(ladder, level, he);
	const actual = r.sides[0]!.score;
	absError += Math.abs(predicted - actual);
	noise += Math.sqrt((actual * (1 - actual)) / r.fights) * Math.sqrt(2 / Math.PI);
	rows.push(`  L${level} HE ${he.toFixed(2).padStart(5)}  predicted ${(100 * predicted).toFixed(0).padStart(3)}  actual ${(100 * actual).toFixed(0).padStart(3)}`);
}
if (mixes.length) {
	process.stdout.write(`\nHeld-out mixes (${mixes.length}):\n${rows.join('\n')}\n`);
	const mae = (100 * absError) / mixes.length;
	process.stdout.write(`\nMean absolute error ${mae.toFixed(1)} points (noise floor ${((100 * noise) / mixes.length).toFixed(1)}); pass mark 5: ${mae <= 5 ? 'PASS' : 'FAIL'}\n`);
}
process.exit(0);
