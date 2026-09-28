/**
 * The calibration ladder as a conversion (roadmap 34, "Hit-equivalent"). Per level, rung k is
 * the expected score of a reference-chassis hand against 9 Hits: k Hits and 9-k nulls for
 * k <= 9, and for k > 9 a full 9-Hit hand against an opponent missing k-9 Hits (worth k Hits
 * relative to it). `toHE` inverts it: the Hits a hand is worth against 9 Hits, 0..18. A card's
 * value is the hand's HE minus what the rest of the hand is worth (8 Hits: 8).
 *
 * The curve is made monotone before inverting (pool-adjacent-violators), since a rung can dip
 * below its neighbour by noise; the inverse is piecewise linear between rungs and clamped at
 * the ends.
 */
import type { UnitResult } from './units.js';

/** level -> scores for rungs k = 0..18 (9 is a 9-Hit mirror). */
export type Ladder = Record<number, number[]>;

export const LADDER_HAND = 9;
/** Highest rung: 9 Hits against an opponent with none. */
export const LADDER_TOP = 2 * LADDER_HAND;

/** Pool every ladder unit (all seed sets) into one curve per level. */
export function ladderFromResults(results: UnitResult[], set?: string): Ladder {
	const acc = new Map<string, { score: number; fights: number }>();
	for (const r of results) {
		if (r.error || r.tags?.kind !== 'ladder') continue;
		if (set && r.tags.set !== set) continue;
		const key = `${r.tags.level}|${r.tags.k}`;
		const a = acc.get(key) ?? { score: 0, fights: 0 };
		a.score += r.sides[0]!.score * r.fights;
		a.fights += r.fights;
		acc.set(key, a);
	}
	const ladder: Ladder = {};
	for (const [key, a] of acc) {
		const [level, k] = key.split('|').map(Number) as [number, number];
		(ladder[level] ??= Array(LADDER_TOP + 1).fill(NaN))[k] = a.score / a.fights;
	}
	for (const level of Object.keys(ladder)) ladder[Number(level)] = isotonic(ladder[Number(level)]!);
	return ladder;
}

/** Pool-adjacent-violators: the closest non-decreasing sequence (unweighted). */
export function isotonic(values: number[]): number[] {
	const blocks: Array<{ sum: number; n: number }> = [];
	for (const v of values) {
		if (Number.isNaN(v)) continue;
		blocks.push({ sum: v, n: 1 });
		while (blocks.length > 1 && blocks[blocks.length - 2]!.sum / blocks[blocks.length - 2]!.n > blocks[blocks.length - 1]!.sum / blocks[blocks.length - 1]!.n) {
			const last = blocks.pop()!;
			blocks[blocks.length - 1]!.sum += last.sum;
			blocks[blocks.length - 1]!.n += last.n;
		}
	}
	return blocks.flatMap(b => Array(b.n).fill(b.sum / b.n) as number[]);
}

/** Hit-equivalents of a hand that scored `score` at `level` (linear between rungs, clamped). */
export function toHE(ladder: Ladder, level: number, score: number): number {
	const curve = ladder[level];
	if (!curve) throw new Error(`No ladder for level ${level}`);
	const top = curve.length - 1;
	if (score <= curve[0]!) return 0;
	if (score >= curve[top]!) return top;
	for (let k = 1; k <= top; k += 1) {
		const lo = curve[k - 1]!;
		const hi = curve[k]!;
		if (score <= hi) return hi === lo ? k : k - 1 + (score - lo) / (hi - lo);
	}
	return top;
}

/** The expected score of a hand worth `he` Hit-equivalents at `level`. */
export function fromHE(ladder: Ladder, level: number, he: number): number {
	const curve = ladder[level];
	if (!curve) throw new Error(`No ladder for level ${level}`);
	const top = curve.length - 1;
	const x = Math.max(0, Math.min(top, he));
	const k = Math.floor(x);
	if (k >= top) return curve[top]!;
	return curve[k]! + (x - k) * (curve[k + 1]! - curve[k]!);
}
