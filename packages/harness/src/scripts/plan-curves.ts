#!/usr/bin/env node
/**
 * Plan the class curves for the balance runner (roadmap 34, task 1): every pair of monsters
 * at each level, as humans, with seat-swapped pairs, so the first-mover edge cancels.
 * `node dist/scripts/plan-curves.js --out plan.json [--fights 30] [--levels 0,1,2,3,4,5,6,7,10,12,15,20]
 * [--styles likely,random]`. Run it with `sim-batch`, read it with `sim-report`.
 */
import '../sim-env.js';
import '../set-env.js';
import { writeFileSync } from 'node:fs';
import { SIM_MONSTER_TYPES } from '../simulate.js';
import type { Plan, Unit } from '../balance/units.js';

function arg(name: string, fallback: string): string {
	const i = process.argv.indexOf(name);
	return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const out = arg('--out', 'plan-curves.json');
const fights = Number(arg('--fights', '30'));
const levels = arg('--levels', '0,1,2,3,4,5,6,7,10,12,15,20').split(',').map(Number);
const styles = arg('--styles', 'likely,random').split(',') as Array<'likely' | 'random'>;

const units: Unit[] = [];
let seed = 340_001;
for (const style of styles) {
	for (const level of levels) {
		SIM_MONSTER_TYPES.forEach((a, i) => {
			SIM_MONSTER_TYPES.slice(i + 1).forEach(b => {
				units.push({
					id: `curves:${style}:L${level}:${a}:${b}`,
					group: `${style}|L${level}`,
					sides: [
						{ type: a, level, role: 'human', deckStyle: style },
						{ type: b, level, role: 'human', deckStyle: style },
					],
					fights,
					seed: (seed += 7919),
					tags: { kind: 'pair', style, level, a, b },
				});
			});
		});
	}
}

const plan: Plan = { name: 'class curves', profile: fights >= 100 ? 'full' : 'quick', units };
writeFileSync(out, `${JSON.stringify(plan, null, 1)}\n`);
process.stdout.write(`Wrote ${units.length} units (${units.length * fights * 2} fights) to ${out}\n`);
process.exit(0);
