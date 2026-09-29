#!/usr/bin/env node
/**
 * Read the per-fight split of a runner run (roadmap 36 task 4):
 * `node dist/scripts/sim-split-report.js <run-dir> [--side 0] [--by card,v,level]`.
 *
 * For every unit that asked for `probes`, prints the chosen side's win / draw / loss in fights
 * where each probe fired for that side and in fights where it did not, summed over units that
 * share the `--by` tags (default: every tag but `opp`). An all-or-nothing card whose "fired"
 * row is far better than its "did not fire" row decides single fights, whatever its average;
 * compare it with a weak version of the same card, since fights where an effect landed are
 * biased toward fights already going well (docs/archive/studies/2026-09-gloaming-rest.md).
 * Engine-free, so it exits at once.
 */
import { readResults } from '../balance/results.js';
import type { UnitResult } from '../balance/units.js';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
};
const dir = args.find((a, i) => !a.startsWith('--') && !['--side', '--by'].includes(args[i - 1] ?? ''));
if (!dir) {
	process.stderr.write('Usage: sim-split-report <run-dir> [--side 0] [--by card,v,level]\n');
	process.exit(2);
}
const side = Number(flag('--side') ?? 0);
const by = flag('--by')?.split(',');

type Tally = { wins: number; draws: number; losses: number };
const add = (a: Tally, b: Tally): Tally => ({ wins: a.wins + b.wins, draws: a.draws + b.draws, losses: a.losses + b.losses });
const zero = (): Tally => ({ wins: 0, draws: 0, losses: 0 });
const show = (t: Tally): string => {
	const n = t.wins + t.draws + t.losses;
	if (!n) return '— (0 fights)';
	const pct = (x: number) => `${Math.round((100 * x) / n)}%`;
	return `win ${pct(t.wins)} draw ${pct(t.draws)} loss ${pct(t.losses)} (${n} fights)`;
};

const groups = new Map<string, Record<string, { with: Tally; without: Tally }>>();
for (const r of readResults(dir) as UnitResult[]) {
	if (r.error || !r.split) continue;
	const tags = r.tags ?? {};
	const keys = by ?? Object.keys(tags).filter(k => k !== 'opp').sort();
	const key = keys.map(k => `${k}=${tags[k]}`).join(' ');
	const group = groups.get(key) ?? {};
	for (const [probe, s] of Object.entries(r.split)) {
		const g = (group[probe] ??= { with: zero(), without: zero() });
		if (s.with[side]) g.with = add(g.with, s.with[side]!);
		if (s.without[side]) g.without = add(g.without, s.without[side]!);
	}
	groups.set(key, group);
}

if (!groups.size) {
	process.stdout.write('No unit in this run asked for probes.\n');
	process.exit(0);
}
for (const [key, group] of [...groups.entries()].sort()) {
	process.stdout.write(`\n${key || '(all units)'}\n`);
	for (const [probe, g] of Object.entries(group)) {
		process.stdout.write(`  ${probe}: fired ${show(g.with)} | did not ${show(g.without)}\n`);
	}
}
