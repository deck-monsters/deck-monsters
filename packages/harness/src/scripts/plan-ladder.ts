#!/usr/bin/env node
/**
 * Plan the calibration ladder (roadmap 34 tasks 3-4): on the reference chassis, two-sided.
 * Rungs k = 0..9: a hand of k Hits and 9-k null cards against 9 Hits. Rungs k = 10..18: 9 Hits
 * against an opponent of 18-k Hits and k-9 nulls, so a hand worth more than 9 Hits has a rung
 * to land on (the first, one-sided ladder topped out at 9 Hits and read every stronger card as
 * exactly one Hit). Null cards take a slot, so action economy is held fixed; each unit
 * shuffles its hands from its own seed, and several units per rung average slot position out
 * (a null's cost depends on its slot). Two independent seed sets check repeatability.
 * `node dist/scripts/plan-ladder.js --out plan.json [--fights 35] [--units-per-rung 6]
 * [--levels 0,1,2,3,4,5,6,7,10,12,15,20]`.
 */
import '../sim-env.js';
import '../set-env.js';
import { writeFileSync } from 'node:fs';
import { mulberry32 } from '../rng.js';
import type { Plan, Unit } from '../balance/units.js';

function arg(name: string, fallback: string): string {
	const i = process.argv.indexOf(name);
	return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const out = arg('--out', 'plan-ladder.json');
const fights = Number(arg('--fights', '35'));
const perRung = Number(arg('--units-per-rung', '6'));
const levels = arg('--levels', '0,1,2,3,4,5,6,7,10,12,15,20').split(',').map(Number);
const HAND = 9;

function shuffledHand(k: number, seed: number): string[] {
	const hand = [...Array(k).fill('Hit'), ...Array(HAND - k).fill('Ideal:Null')] as string[];
	const rand = mulberry32(seed);
	for (let i = hand.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rand() * (i + 1));
		[hand[i], hand[j]] = [hand[j]!, hand[i]!];
	}
	return hand;
}

const units: Unit[] = [];
for (const set of ['A', 'B']) {
	let seed = set === 'A' ? 110_003 : 910_007;
	for (const level of levels) {
		for (let k = 0; k <= 2 * HAND; k += 1) {
			for (let u = 0; u < perRung; u += 1) {
				seed += 7919;
				const mine = k <= HAND ? shuffledHand(k, seed) : (Array(HAND).fill('Hit') as string[]);
				const theirs = k <= HAND ? (Array(HAND).fill('Hit') as string[]) : shuffledHand(2 * HAND - k, seed + 1);
				units.push({
					id: `ladder:${set}:L${level}:k${k}:u${u}`,
					group: `ladder|${set}|L${level}|k${k}`,
					sides: [
						{ type: 'Gladiator', level, deck: mine, chassis: 'reference' },
						{ type: 'Gladiator', level, deck: theirs, chassis: 'reference' },
					],
					fights,
					seed,
					tags: { kind: 'ladder', set, level, k },
				});
			}
		}
	}
}

const plan: Plan = { name: 'calibration ladder', profile: fights >= 100 ? 'full' : 'quick', units };
writeFileSync(out, `${JSON.stringify(plan)}\n`);
process.stdout.write(`Wrote ${units.length} units (${units.length * fights * 2} fights) to ${out}\n`);
process.exit(0);
