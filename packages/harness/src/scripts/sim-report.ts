#!/usr/bin/env node
/**
 * Read a balance runner directory, finished or partial: `node dist/scripts/sim-report.js
 * <dir> [--json out.json]`. Missing units are reported, not fatal (roadmap 34).
 *
 * Pair units (`tags.kind === 'pair'`) become class curves: each monster's field average
 * (expected score, draws ½) against every other monster at its level, with a Wilson
 * interval, per deck style; plus the first mover's edge. Other units are grouped by `group`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readResults, MANIFEST_FILE } from '../balance/results.js';
import { wilson, type Interval } from '../balance/stats.js';
import type { UnitResult } from '../balance/units.js';

const dir = process.argv[2];
if (!dir) {
	process.stderr.write('Usage: sim-report <dir> [--json out.json]\n');
	process.exit(2);
}
const jsonIndex = process.argv.indexOf('--json');
const jsonOut = jsonIndex >= 0 ? process.argv[jsonIndex + 1] : undefined;

const manifestPath = join(dir, MANIFEST_FILE);
const manifest = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { units?: number; name?: string; runCommit?: string }) : {};
const all = readResults(dir);
const ok = all.filter(r => !r.error);
const failed = all.length - ok.length;
process.stdout.write(`${manifest.name ?? dir}: ${ok.length}/${manifest.units ?? '?'} units, ${failed} failed, commit ${manifest.runCommit?.slice(0, 7) ?? '?'}\n`);

const band = (i: Interval): string => (i.high < 0.35 ? ' LOW' : i.low > 0.75 ? ' HIGH' : '');
const pct = (x: number): string => `${(100 * x).toFixed(0)}`;

type Acc = { score: number; fights: number };
const pairs = ok.filter(r => r.tags?.kind === 'pair');
const output: Record<string, unknown> = {};

if (pairs.length) {
	const curves = new Map<string, Acc>();
	let firstScore = 0;
	let firstFights = 0;
	const levels = new Set<number>();
	const monsters = new Set<string>();
	const styles = new Set<string>();
	for (const r of pairs as UnitResult[]) {
		const { style, level, a, b } = r.tags as { style: string; level: number; a: string; b: string };
		levels.add(level);
		styles.add(style);
		[a, b].forEach((m, side) => {
			monsters.add(m);
			const key = `${style}|${level}|${m}`;
			const acc = curves.get(key) ?? { score: 0, fights: 0 };
			acc.score += r.sides[side]!.score * r.fights;
			acc.fights += r.fights;
			curves.set(key, acc);
		});
		for (const rot of r.rotations) {
			firstScore += rot.scores[rot.firstSide]! * rot.fights;
			firstFights += rot.fights;
		}
	}
	const sortedLevels = [...levels].sort((x, y) => x - y);
	for (const style of styles) {
		process.stdout.write(`\n${style} hands: field average (expected score %, 95% interval), seat-swapped\n`);
		process.stdout.write(`${'monster'.padEnd(14)}${sortedLevels.map(l => `L${l}`.padStart(17)).join('')}\n`);
		for (const m of [...monsters]) {
			const cells = sortedLevels.map(level => {
				const acc = curves.get(`${style}|${level}|${m}`);
				if (!acc) return '—'.padStart(17);
				const i = wilson(acc.score, acc.fights);
				output[`${style}|${level}|${m}`] = i;
				return `${pct(i.estimate)} (${pct(i.low)}-${pct(i.high)})${band(i)}`.padStart(17);
			});
			process.stdout.write(`${m.padEnd(14)}${cells.join('')}\n`);
		}
	}
	const first = wilson(firstScore, firstFights);
	output.firstMover = first;
	process.stdout.write(`\nFirst mover's expected score over all fights: ${pct(first.estimate)}% (${pct(first.low)}-${pct(first.high)})\n`);
}

const others = ok.filter(r => r.tags?.kind !== 'pair');
if (others.length) {
	const groups = new Map<string, Acc>();
	for (const r of others) {
		const key = r.group ?? r.id;
		const acc = groups.get(key) ?? { score: 0, fights: 0 };
		acc.score += (r.sides[0]?.score ?? 0) * r.fights;
		acc.fights += r.fights;
		groups.set(key, acc);
	}
	process.stdout.write('\nSide 0 expected score by group\n');
	for (const [key, acc] of groups) {
		const i = wilson(acc.score, acc.fights);
		output[key] = i;
		process.stdout.write(`${key.padEnd(40)} ${pct(i.estimate)}% (${pct(i.low)}-${pct(i.high)}), ${acc.fights} fights\n`);
	}
}

if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify(output, null, 1)}\n`);
process.exit(0);
