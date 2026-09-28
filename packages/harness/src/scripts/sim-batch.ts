#!/usr/bin/env node
/**
 * The standalone balance runner (roadmap 34): `node dist/scripts/sim-batch.js <plan.json>
 * --out <dir> [--max-minutes N] [--units a..b] [--shard i/n] [--workers k]`.
 *
 * No network, no inference, no database: raw compute only. Results append to
 * `<dir>/results.jsonl` one line per finished unit; rerunning skips finished units, so a
 * run can be stopped and continued anywhere. See docs/reference/simulation-harness.md.
 */
import '../sim-env.js';
import '../set-env.js';
import { readFileSync } from 'node:fs';
import { runPlan, type RunOptions } from '../balance/runner.js';
import type { Plan } from '../balance/units.js';

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(name);
	return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
	const planPath = process.argv[2];
	const outDir = arg('--out');
	if (!planPath || planPath.startsWith('--') || !outDir) {
		process.stderr.write('Usage: sim-batch <plan.json> --out <dir> [--max-minutes N] [--units a..b] [--shard i/n] [--workers k]\n');
		process.exit(2);
	}
	const plan = JSON.parse(readFileSync(planPath, 'utf8')) as Plan;
	const options: RunOptions = { outDir };
	const minutes = arg('--max-minutes');
	if (minutes) options.maxMinutes = Number(minutes);
	const units = arg('--units');
	if (units) {
		const [from, to] = units.split('..').map(Number);
		options.range = { from: from ?? 0, to: to ?? plan.units.length };
	}
	const shard = arg('--shard');
	if (shard) {
		const [index, count] = shard.split('/').map(Number);
		options.shard = { index: index ?? 0, count: count ?? 1 };
	}
	const workers = arg('--workers');
	if (workers !== undefined) options.workers = Number(workers);

	let lastLog = 0;
	options.onResult = (result, p) => {
		if (result.error) process.stderr.write(`unit ${result.id} failed: ${result.error.split('\n')[0]}\n`);
		if (Date.now() - lastLog > 10_000 || p.remaining === 0) {
			lastLog = Date.now();
			const fps = p.fights / Math.max(1, p.elapsedMs / 1000);
			process.stdout.write(`${p.done} done, ${p.failed} failed, ${p.remaining} left, ${fps.toFixed(1)} fights/s\n`);
		}
	};

	const progress = await runPlan(plan, options);
	const fps = progress.fights / Math.max(1, progress.elapsedMs / 1000);
	process.stdout.write(
		`Finished: ${progress.done} units run, ${progress.skipped} already done, ${progress.failed} failed, ${progress.remaining} left; ${progress.fights} fights in ${(progress.elapsedMs / 1000).toFixed(0)}s (${fps.toFixed(1)} fights/s)\n`,
	);
	process.exit(progress.failed > 0 ? 1 : 0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
