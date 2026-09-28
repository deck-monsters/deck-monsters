/**
 * The calibration ladder as a conversion (roadmap 34, "Hit-equivalent"). A ladder is, per
 * level, the expected score of a reference-chassis hand of k Hits and 9-k null cards against
 * 9 Hits, for k = 0..9. `toHE` inverts it: the number of Hits a hand is worth. A card's value
 * is then the hand's HE minus what the rest of the hand is worth (8 Hits: 8).
 *
 * The curve is made monotone before inverting (pool-adjacent-violators), since a rung can dip
 * below its neighbour by noise; the inverse is piecewise linear between rungs and clamped to
 * 0..9, so a hand worth more than 9 Hits reads as "above the ladder".
 */
import type { UnitResult } from './units.js';

/** level -> scores for k = 0..9. */
export type Ladder = Record<number, number[]>;

export const LADDER_HAND = 9;

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
		(ladder[level] ??= Array(LADDER_HAND + 1).fill(NaN))[k] = a.score / a.fights;
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

/** Hit-equivalents of a hand that scored `score` at `level` (0..9, linear between rungs). */
export function toHE(ladder: Ladder, level: number, score: number): number {
	const curve = ladder[level];
	if (!curve) throw new Error(`No ladder for level ${level}`);
	if (score <= curve[0]!) return 0;
	if (score >= curve[LADDER_HAND]!) return LADDER_HAND;
	for (let k = 1; k <= LADDER_HAND; k += 1) {
		const lo = curve[k - 1]!;
		const hi = curve[k]!;
		if (score <= hi) return hi === lo ? k : k - 1 + (score - lo) / (hi - lo);
	}
	return LADDER_HAND;
}

/** The expected score of a hand worth `he` Hit-equivalents at `level`. */
export function fromHE(ladder: Ladder, level: number, he: number): number {
	const curve = ladder[level];
	if (!curve) throw new Error(`No ladder for level ${level}`);
	const x = Math.max(0, Math.min(LADDER_HAND, he));
	const k = Math.floor(x);
	if (k >= LADDER_HAND) return curve[LADDER_HAND]!;
	return curve[k]! + (x - k) * (curve[k + 1]! - curve[k]!);
}
