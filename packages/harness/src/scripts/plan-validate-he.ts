#!/usr/bin/env node
/**
 * Plan the Hit-equivalent validation (roadmap 34 task 4), on synthetic strikes whose only
 * difference is their damage dice (a Hit is 1d6), against 9 Hits on the reference chassis:
 * - slot weights: 8 Hits and a null in slot p, for each p (what a slot is worth);
 * - singles: one variant in slot p and 8 Hits, for each p, so its value is position-balanced;
 * - stacking: 2 and 3 copies of a variant at shuffled positions;
 * - held-out mixes: random 9-card hands of Hits, nulls, and variants, whose scores are then
 *   predicted from single-copy values weighted by slot (`sim-validate-he`).
 * The first run found slot position dominates (a null in a late slot costs little), so every
 * value here is either measured in each slot or averaged over shuffles.
 * `node dist/scripts/plan-validate-he.js --out plan.json [--fights 40] [--mixes 20]`.
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
const fights = Number(arg('--fights', '40'));
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
const unit = (id: string, level: number, hand: string[], tags: Record<string, string | number>, n = fights): void => {
	seed += 7919;
	units.push({
		id,
		sides: [
			{ type: 'Gladiator', level, deck: hand, chassis: 'reference' },
			{ type: 'Gladiator', level, deck: opponent, chassis: 'reference' },
		],
		fights: n,
		seed,
		tags: { level, ...tags },
	});
};
const withCard = (card: string, slot: number): string[] => opponent.map((c, p) => (p === slot ? card : c));

for (const level of VALIDATION_LEVELS) {
	for (let slot = 0; slot < 9; slot += 1) {
		for (let u = 0; u < 4; u += 1) unit(`he:slot:L${level}:p${slot}:u${u}`, level, withCard('Ideal:Null', slot), { kind: 'he-slot', slot });
		for (const dice of VALIDATION_VARIANTS) unit(`he:single:L${level}:${dice}:p${slot}`, level, withCard(strike(dice), slot), { kind: 'he-single', dice, slot });
	}
	for (const dice of VALIDATION_VARIANTS) {
		for (const c of [2, 3]) {
			for (let u = 0; u < 3; u += 1) {
				const hand = shuffle([...Array(c).fill(strike(dice)), ...Array(9 - c).fill('Hit')], mulberry32(seed + 13));
				unit(`he:stack:L${level}:${dice}:c${c}:u${u}`, level, hand, { kind: 'he-stack', dice, copies: c });
			}
		}
	}
	const pool = ['Hit', 'Ideal:Null', ...VALIDATION_VARIANTS.map(strike)];
	for (let m = 0; m < mixes; m += 1) {
		const rand = mulberry32(seed + 29);
		const hand = Array.from({ length: 9 }, () => pool[Math.floor(rand() * pool.length)]!);
		unit(`he:mix:L${level}:m${m}`, level, hand, { kind: 'he-mix', hand: JSON.stringify(hand) }, fights * 4);
	}
}

const plan: Plan = { name: 'HE validation', profile: 'full', units };
writeFileSync(out, `${JSON.stringify(plan)}\n`);
process.stdout.write(`Wrote ${units.length} units (${units.length * fights * 2} fights) to ${out}\n`);
process.exit(0);
