#!/usr/bin/env node
/**
 * Read a finished `sim-search` directory (roadmap 34 task 9, lean):
 * `node dist/scripts/sim-search-report.js <search-dir> [--json out.json]`.
 *
 * Per level: each monster's searched hand, its field average against the other searched
 * hands (the band: 35-75%), its worst and best single matchups (20-80%, none over 85%), and
 * what good picks are worth (the searched hand against its own typical starting hand). All
 * from the matrix phase, on seeds the search never used. Engine-free, so it exits at once.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readResults } from '../balance/results.js';
import { wilson } from '../balance/stats.js';

const dir = process.argv[2];
const jsonIndex = process.argv.indexOf('--json');
const jsonOut = jsonIndex >= 0 ? process.argv[jsonIndex + 1] : undefined;
if (!dir) {
	process.stderr.write('Usage: sim-search-report <search-dir> [--json out.json]\n');
	process.exit(2);
}

interface Search {
	type: string;
	level: number;
	hand: string[];
	start: string[];
	history: Array<{ round: number; step: number; move: string; gain: number; confirmed: number }>;
}
const state = JSON.parse(readFileSync(join(dir, 'search-state.json'), 'utf8')) as {
	phase: string;
	searches: Record<string, Search>;
	changedInRound: Record<string, number>;
};
const matrix = readResults(join(dir, 'matrix')).filter(r => !r.error);
const levels = [...new Set(Object.values(state.searches).map(s => s.level))].sort((a, b) => a - b);
const types = [...new Set(Object.values(state.searches).map(s => s.type))];
const pct = (x: number): string => `${(100 * x).toFixed(0)}%`;

const lines: string[] = [];
lines.push(`Search phase: ${state.phase}. Hands changed per round: ${Object.entries(state.changedInRound).map(([r, n]) => `round ${r} ${n}`).join(', ') || 'none recorded'}.`, '');
const output: Record<number, unknown> = {};
for (const level of levels) {
	// score[a][b] = a's expected score against b.
	const score = new Map<string, Map<string, { s: number; n: number }>>();
	const put = (a: string, b: string, s: number, n: number): void => {
		(score.get(a) ?? score.set(a, new Map()).get(a)!).set(b, { s, n });
	};
	for (const r of matrix.filter(x => x.tags?.kind === 'matrix' && x.tags.level === level)) {
		put(String(r.tags!.a), String(r.tags!.b), r.sides[0]!.score, r.fights);
		put(String(r.tags!.b), String(r.tags!.a), r.sides[1]!.score, r.fights);
	}
	lines.push(`## Level ${level}`, '', '| Monster | Field average | Worst matchup | Best matchup | Searched vs typical hand | Band |', '|---|---|---|---|---|---|');
	const rows: unknown[] = [];
	for (const type of types) {
		const vs = [...(score.get(type) ?? new Map<string, { s: number; n: number }>()).entries()];
		if (!vs.length) continue;
		const n = vs.reduce((a, [, v]) => a + v.n, 0);
		const avg = vs.reduce((a, [, v]) => a + v.s * v.n, 0) / n;
		const ci = wilson(avg * n, n);
		const worst = vs.reduce((a, b) => (b[1].s < a[1].s ? b : a));
		const best = vs.reduce((a, b) => (b[1].s > a[1].s ? b : a));
		const skill = matrix.find(x => x.tags?.kind === 'skill' && x.tags.level === level && x.tags.a === type);
		const flags: string[] = [];
		if (ci.high < 0.35) flags.push('below band');
		if (ci.low > 0.75) flags.push('above band');
		if (worst[1].s < 0.2) flags.push(`matchup under 20% (${worst[0]})`);
		if (best[1].s > 0.85) flags.push(`matchup over 85% (${best[0]})`);
		lines.push(`| ${type} | ${pct(avg)} (${pct(ci.low)}-${pct(ci.high)}) | ${worst[0]} ${pct(worst[1].s)} | ${best[0]} ${pct(best[1].s)} | ${skill ? pct(skill.sides[0]!.score) : '—'} | ${flags.join('; ') || 'in band'} |`);
		rows.push({ type, fieldAverage: avg, interval: ci, worst, best, skill: skill?.sides[0]!.score, flags });
	}
	lines.push('', 'Searched hands (slot 1 first), and the moves kept:', '');
	for (const type of types) {
		const s = state.searches[`${type}@L${level}`];
		if (!s) continue;
		lines.push(`- **${type}**: ${s.hand.join(', ')}${s.history.length ? ` (${s.history.length} moves kept: ${s.history.map(h => `${h.move} +${(100 * h.confirmed).toFixed(1)}`).join('; ')})` : ' (the typical hand; no move held)'}`);
	}
	lines.push('');
	output[level] = rows;
}
process.stdout.write(`${lines.join('\n')}\n`);
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify({ levels, monsters: output, searches: state.searches, changedInRound: state.changedInRound }, null, 1)}\n`);
process.exit(0);
