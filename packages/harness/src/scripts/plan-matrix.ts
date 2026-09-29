#!/usr/bin/env node
/**
 * Plan a fixed-hand matrix for before/after checks (roadmap 35 task 1): every pair of the
 * given hands at each level, seat-swapped, with excitement recorded, on fixed validation
 * seeds. Run the same plan at two commits (before and after a change) into two directories,
 * then compare them with `sim-matrix-report <before> <after>`: the hands and seeds are the
 * same, so the difference is the change.
 * `node dist/scripts/plan-matrix.js --hands <search.json> --out plan.json [--fights 200] [--levels 1,3,5]`.
 * `--hands` takes a `sim-search-report --json` file (its `searches`) or a JSON map of
 * `"Type@Ln": [9 cards]`. `--variants a,b` applies experiment variants (`balance/variants.ts`)
 * to every unit, so a candidate fix can be compared with the same plan without it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { Plan, Unit } from '../balance/units.js';

function arg(name: string, fallback: string): string {
	const i = process.argv.indexOf(name);
	return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const handsPath = arg('--hands', '');
const out = arg('--out', 'plan-matrix.json');
const fights = Number(arg('--fights', '200'));
const levels = arg('--levels', '1,3,5').split(',').map(Number);
const variants = arg('--variants', '').split(',').filter(Boolean);
if (!handsPath) {
	process.stderr.write('Usage: plan-matrix --hands <search.json> --out plan.json [--fights 200] [--levels 1,3,5]\n');
	process.exit(2);
}
const raw = JSON.parse(readFileSync(handsPath, 'utf8')) as { searches?: Record<string, { hand: string[] }> } & Record<string, unknown>;
const hands: Record<string, string[]> = raw.searches
	? Object.fromEntries(Object.entries(raw.searches).map(([k, s]) => [k, s.hand]))
	: (raw as unknown as Record<string, string[]>);

const units: Unit[] = [];
let seed = 88_000_001;
for (const level of levels) {
	const types = Object.keys(hands).filter(k => k.endsWith(`@L${level}`)).map(k => k.split('@')[0]!);
	for (let i = 0; i < types.length; i += 1) {
		for (let j = i + 1; j < types.length; j += 1) {
			const a = types[i]!;
			const b = types[j]!;
			seed += 7919;
			units.push({
				id: `matrix:L${level}:${a}:${b}`,
				sides: [
					{ type: a, level, deck: hands[`${a}@L${level}`]! },
					{ type: b, level, deck: hands[`${b}@L${level}`]! },
				],
				fights,
				seed,
				excitement: true,
				...(variants.length ? { variants } : {}),
				tags: { kind: 'matrix', level, a, b },
			});
		}
	}
}
const plan: Plan = { name: 'fixed-hand matrix', profile: 'quick', units };
writeFileSync(out, `${JSON.stringify(plan)}\n`);
process.stdout.write(`${units.length} units, ${units.reduce((t, u) => t + u.fights * 2, 0)} fights -> ${out}\n`);
