/**
 * The standalone balance runner (roadmap 34, "The runner: a standalone black box").
 *
 * Needs only raw compute: no network, no model inference, no database. A plan lists work
 * units; each finished unit becomes one JSON line in `results.jsonl`, written the moment it
 * completes, so a run that dies keeps every finished unit. Rerunning the same plan into the
 * same directory skips the units already there. `maxMinutes` stops cleanly after the units
 * in flight; `range` and `shard` run a slice, so a short agent session can take a long run
 * forward in chunks and an overnight machine can take all of it.
 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { runUnit, type Plan, type Unit, type UnitResult } from './units.js';
import { finishedIds, HEARTBEAT_FILE, MANIFEST_FILE, RESULTS_FILE } from './results.js';

export { finishedIds, readResults, HEARTBEAT_FILE, MANIFEST_FILE, RESULTS_FILE } from './results.js';

export interface RunOptions {
	outDir: string;
	/** Stop dispatching new units after this many minutes. */
	maxMinutes?: number;
	/** Only units with plan index in [from, to). */
	range?: { from: number; to: number };
	/** Only units with plan index % count === index. */
	shard?: { index: number; count: number };
	/** Worker threads; 0 runs units in this thread (tests). Default: CPUs - 0, at least 1. */
	workers?: number;
	/**
	 * Resume a directory whose runs started at a different commit. Off by default: finished units
	 * are skipped, so the rest would run on different engine code and the results would mix.
	 */
	allowCommitChange?: boolean;
	/** Called after each unit (progress line). */
	onResult?: (result: UnitResult, progress: RunProgress) => void;
}

export interface RunProgress {
	done: number;
	failed: number;
	skipped: number;
	remaining: number;
	fights: number;
	elapsedMs: number;
}

export const planHash = (plan: Plan): string =>
	createHash('sha256').update(JSON.stringify(plan.units)).digest('hex').slice(0, 16);

function currentCommit(): string | undefined {
	try {
		return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
	} catch {
		return undefined;
	}
}

export async function runPlan(plan: Plan, options: RunOptions): Promise<RunProgress> {
	const { outDir } = options;
	mkdirSync(outDir, { recursive: true });

	const hash = planHash(plan);
	const manifestPath = join(outDir, MANIFEST_FILE);
	if (existsSync(manifestPath)) {
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { planHash?: string; runCommit?: string };
		if (manifest.planHash && manifest.planHash !== hash) {
			throw new Error(`${outDir} holds results for a different plan (${manifest.planHash}, this is ${hash}); use a new directory`);
		}
		// A resume on other code would append results from a different engine to the same
		// dataset, still labelled with the first commit (a Codex review of #408). Uncommitted
		// edits are not caught; run long plans from a clean checkout.
		const commit = currentCommit();
		if (!options.allowCommitChange && manifest.runCommit && commit && manifest.runCommit !== commit) {
			throw new Error(`${outDir} was started at ${manifest.runCommit.slice(0, 10)} and this checkout is ${commit.slice(0, 10)}; check out that commit, use a new directory, or pass --allow-commit-change`);
		}
	} else {
		writeFileSync(
			manifestPath,
			`${JSON.stringify({ name: plan.name, profile: plan.profile, planHash: hash, planCommit: plan.commit, runCommit: currentCommit(), units: plan.units.length, created: new Date().toISOString() }, null, 2)}\n`,
		);
	}

	const done = finishedIds(outDir);
	const queue: Unit[] = [];
	let skipped = 0;
	plan.units.forEach((unit, index) => {
		if (options.range && (index < options.range.from || index >= options.range.to)) return;
		if (options.shard && index % options.shard.count !== options.shard.index) return;
		if (done.has(unit.id)) {
			skipped += 1;
			return;
		}
		queue.push(unit);
	});

	const started = Date.now();
	const deadline = options.maxMinutes !== undefined ? started + options.maxMinutes * 60_000 : Infinity;
	const progress: RunProgress = { done: 0, failed: 0, skipped, remaining: queue.length, fights: 0, elapsedMs: 0 };
	const resultsPath = join(outDir, RESULTS_FILE);

	const record = (result: UnitResult): void => {
		appendFileSync(resultsPath, `${JSON.stringify(result)}\n`);
		if (result.error) progress.failed += 1;
		else progress.done += 1;
		progress.remaining -= 1;
		progress.fights += result.fights;
		progress.elapsedMs = Date.now() - started;
		options.onResult?.(result, progress);
	};

	const heartbeat = (): void => {
		progress.elapsedMs = Date.now() - started;
		writeFileSync(
			join(outDir, HEARTBEAT_FILE),
			`${JSON.stringify({ at: new Date().toISOString(), ...progress, fightsPerSecond: progress.fights / Math.max(1, progress.elapsedMs / 1000) })}\n`,
		);
	};
	heartbeat();
	const beat = setInterval(heartbeat, 60_000);

	try {
		const workerCount = options.workers ?? Math.max(1, cpus().length);
		if (workerCount === 0) {
			for (const unit of queue) {
				if (Date.now() > deadline) break;
				let result: UnitResult;
				try {
					result = await runUnit(unit);
				} catch (err) {
					result = { id: unit.id, fights: 0, sides: [], rotations: [], ms: 0, error: String(err) };
				}
				record(result);
			}
		} else {
			await runWithWorkers(queue, workerCount, deadline, record);
		}
	} finally {
		clearInterval(beat);
		heartbeat();
	}
	return progress;
}

function runWithWorkers(queue: Unit[], count: number, deadline: number, record: (r: UnitResult) => void): Promise<void> {
	const workerUrl = new URL('./worker.js', import.meta.url);
	let next = 0;
	if (queue.length === 0) return Promise.resolve();
	return new Promise((resolve, reject) => {
		let live = 0;
		const workers: Worker[] = [];
		const finish = (worker: Worker): void => {
			void worker.terminate();
			live -= 1;
			if (live === 0) resolve();
		};
		const feed = (worker: Worker): void => {
			if (next >= queue.length || Date.now() > deadline) {
				finish(worker);
				return;
			}
			worker.postMessage(queue[next]);
			next += 1;
		};
		for (let i = 0; i < Math.min(count, queue.length); i += 1) {
			const worker = new Worker(workerUrl);
			workers.push(worker);
			live += 1;
			worker.on('message', (result: UnitResult) => {
				record(result);
				feed(worker);
			});
			worker.on('error', err => {
				workers.forEach(w => void w.terminate());
				reject(err);
			});
			feed(worker);
		}
	});
}
