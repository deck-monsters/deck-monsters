#!/usr/bin/env node
/**
 * Plan the Hit-equivalent validation (roadmap 34 task 4), on synthetic strikes whose only
 * difference is their damage dice (a Hit is 1d6):
 * - singles and stacking: c copies of a variant plus 9-c Hits against 9 Hits, c = 1..3;
 * - held-out mixes: random 9-card hands of Hits, nulls, and variants, whose scores are then
 *   predicted from the single-copy values alone (`sim-validate-he`).
 * `node dist/scripts/plan-validate-he.js --out plan.json [--fights 150] [--mixes 20]`.
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

export const VALIDATION_VARIANTS = ['1d4', '1d8', '1d10', '2d6'];
export const VALIDATION_LEVELS = [1, 4, 7, 12];
const strike = (dice: string): string => `Ideal:Strike:${JSON.stringify({ damageDice: dice })}`;

const out = arg('--out', 'plan-validate-he.json');
const fights = Number(arg('--fights', '150'));
const mixes = Number(arg('--mixes', '20'));

function shuffle(hand: string[], rand: () => number): string[] {
	for (let i = hand.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rand() * (i + 1));
		[hand[i], hand[j]] = [hand[j]!, hand[i]!];
	}
	return hand;
}

const units: Unit[] = [];
let seed = 440_009;
const opponent = Array(9).fill('Hit') as string[];
for (const level of VALIDATION_LEVELS) {
	for (const dice of VALIDATION_VARIANTS) {
		for (let c = 1; c <= 3; c += 1) {
			seed += 7919;
			const hand = shuffle([...Array(c).fill(strike(dice)), ...Array(9 - c).fill('Hit')], mulberry32(seed));
			units.push({
				id: `he:stack:L${level}:${dice}:c${c}`,
				sides: [
					{ type: 'Gladiator', level, deck: hand, chassis: 'reference' },
					{ type: 'Gladiator', level, deck: opponent, chassis: 'reference' },
				],
				fights,
				seed,
				tags: { kind: 'he-stack', level, dice, copies: c },
			});
		}
	}
	const pool = ['Hit', 'Ideal:Null', ...VALIDATION_VARIANTS.map(strike)];
	for (let m = 0; m < mixes; m += 1) {
		seed += 7919;
		const rand = mulberry32(seed);
		const hand = Array.from({ length: 9 }, () => pool[Math.floor(rand() * pool.length)]!);
		units.push({
			id: `he:mix:L${level}:m${m}`,
			sides: [
				{ type: 'Gladiator', level, deck: hand, chassis: 'reference' },
				{ type: 'Gladiator', level, deck: opponent, chassis: 'reference' },
			],
			fights,
			seed,
			tags: { kind: 'he-mix', level, hand: JSON.stringify(hand) },
		});
	}
}

const plan: Plan = { name: 'HE validation', profile: 'full', units };
writeFileSync(out, `${JSON.stringify(plan)}\n`);
process.stdout.write(`Wrote ${units.length} units (${units.length * fights * 2} fights) to ${out}\n`);
process.exit(0);
