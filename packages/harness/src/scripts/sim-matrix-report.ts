#!/usr/bin/env node
/**
 * Read one fixed-hand matrix run, or compare two (roadmap 35 task 1):
 * `node dist/scripts/sim-matrix-report.js <before-run> [<after-run>] [--json out.json]`.
 *
 * Per level: each monster's field average (the band, 35-75%), its worst and best matchups
 * (20-80%, none over 85%), and with two runs the change in each. Then the excitement
 * guardrails over all fights: rounds per fight, Curse of Loki and stroke-of-luck rolls per
 * fight, and turnarounds (winner once 25 or 50 points of HP fraction behind) per decisive
 * fight. 34's working targets flag a drop of more than 20% in turnarounds or rare rolls.
 * Engine-free, so it exits at once.
 */
import { writeFileSync } from 'node:fs';
import { readResults } from '../balance/results.js';
import type { ExcitementTally, UnitResult } from '../balance/units.js';

const args = process.argv.slice(2);
const jsonIndex = args.indexOf('--json');
const jsonOut = jsonIndex >= 0 ? args[jsonIndex + 1] : undefined;
const dirs = jsonIndex >= 0 ? args.filter((_, i) => i !== jsonIndex && i !== jsonIndex + 1) : args;
if (!dirs.length || dirs.length > 2) {
	process.stderr.write('Usage: sim-matrix-report <before-run> [<after-run>] [--json out.json]\n');
	process.exit(2);
}

interface Summary {
	levels: Record<number, Record<string, { average: number; worst: [string, number]; best: [string, number] }>>;
	excitement: ExcitementTally;
}

function summarize(dir: string): Summary {
	const results = readResults(dir).filter((r: UnitResult) => !r.error && r.tags?.kind === 'matrix');
	const levels: Summary['levels'] = {};
	const excitement: ExcitementTally = { fights: 0, decisive: 0, rounds: 0, loki: 0, luck: 0, turnaround25: 0, turnaround50: 0 };
	const scores = new Map<string, Map<string, number>>();
	for (const r of results) {
		const level = Number(r.tags!.level);
		const a = `${String(r.tags!.a)}@${level}`;
		const b = `${String(r.tags!.b)}@${level}`;
		(scores.get(a) ?? scores.set(a, new Map()).get(a)!).set(String(r.tags!.b), r.sides[0]!.score);
		(scores.get(b) ?? scores.set(b, new Map()).get(b)!).set(String(r.tags!.a), r.sides[1]!.score);
		for (const k of Object.keys(excitement) as Array<keyof ExcitementTally>) excitement[k] += r.excitement?.[k] ?? 0;
	}
	for (const [key, vs] of scores) {
		const [type, level] = key.split('@') as [string, string];
		const entries = [...vs.entries()];
		const average = entries.reduce((t, [, s]) => t + s, 0) / entries.length;
		const worst = entries.reduce((x, y) => (y[1] < x[1] ? y : x));
		const best = entries.reduce((x, y) => (y[1] > x[1] ? y : x));
		(levels[Number(level)] ??= {})[type] = { average, worst, best };
	}
	return { levels, excitement };
}

const runs = dirs.map(summarize);
const pct = (x: number): string => `${(100 * x).toFixed(0)}%`;
const delta = (x: number): string => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)}`;
const lines: string[] = [];
const [before, after] = runs as [Summary, Summary | undefined];
for (const level of Object.keys(before.levels).map(Number).sort((x, y) => x - y)) {
	lines.push(`## Level ${level}`, '');
	lines.push(after ? '| Monster | Field average (before → after) | Change | Worst matchup after | Best matchup after | Band after |' : '| Monster | Field average | Worst matchup | Best matchup | Band |');
	lines.push(after ? '|---|---|---|---|---|---|' : '|---|---|---|---|---|');
	for (const [type, b] of Object.entries(before.levels[level]!)) {
		const a = after?.levels[level]?.[type];
		const row = a ?? b;
		const flags: string[] = [];
		if (row.average < 0.35) flags.push('below band');
		if (row.average > 0.75) flags.push('above band');
		if (row.worst[1] < 0.2) flags.push(`under 20% (${row.worst[0]})`);
		if (row.best[1] > 0.85) flags.push(`over 85% (${row.best[0]})`);
		lines.push(
			a
				? `| ${type} | ${pct(b.average)} → ${pct(a.average)} | ${delta(a.average - b.average)} | ${a.worst[0]} ${pct(a.worst[1])} | ${a.best[0]} ${pct(a.best[1])} | ${flags.join('; ') || 'in band'} |`
				: `| ${type} | ${pct(b.average)} | ${b.worst[0]} ${pct(b.worst[1])} | ${b.best[0]} ${pct(b.best[1])} | ${flags.join('; ') || 'in band'} |`,
		);
	}
	lines.push('');
}
const rates = (e: ExcitementTally): Record<string, number> => ({
	'rounds per fight': e.rounds / Math.max(1, e.fights),
	'Curse of Loki per fight': e.loki / Math.max(1, e.fights),
	'strokes of luck per fight': e.luck / Math.max(1, e.fights),
	'turnarounds from 25 behind (share of decisive fights)': e.turnaround25 / Math.max(1, e.decisive),
	'turnarounds from 50 behind (share of decisive fights)': e.turnaround50 / Math.max(1, e.decisive),
});
lines.push('## Excitement and hope', '');
const rb = rates(before.excitement);
const ra = after ? rates(after.excitement) : undefined;
lines.push(ra ? '| Measure | Before | After | Change | Guardrail |' : '| Measure | Value |', ra ? '|---|---|---|---|---|' : '|---|---|');
for (const [name, v] of Object.entries(rb)) {
	if (!ra) {
		lines.push(`| ${name} | ${v.toFixed(3)} |`);
		continue;
	}
	const change = v ? (ra[name]! - v) / v : 0;
	const guarded = name !== 'rounds per fight';
	lines.push(`| ${name} | ${v.toFixed(3)} | ${ra[name]!.toFixed(3)} | ${(100 * change).toFixed(0)}% | ${guarded && change < -0.2 ? 'DROP OVER 20%: needs the owner' : 'ok'} |`);
}
process.stdout.write(`${lines.join('\n')}\n`);
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify({ runs: dirs, summaries: runs }, null, 1)}\n`);
process.exit(0);
