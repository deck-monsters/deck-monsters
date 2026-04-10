#!/usr/bin/env node
/**
 * Local simulation CLI — no HTTP, no DB.
 *
 * Usage:
 *   pnpm --filter @deck-monsters/harness run run -- [options]
 *
 * Options:
 *   --scenario <id>   ring-two-bosses | concurrent-look-monsters
 *   --seed <n>        Optional Math.random seed (mulberry32) for reproducible fights
 *   --verbose         Print each public event on its own line with seq + type
 */

import './set-env.js';
import { createTestGame } from '@deck-monsters/engine';
import { capturePublicFeed, formatPublicFeedLines } from './public-feed.js';

function parseArgs(argv: string[]): { scenario: string; seed?: number; verbose: boolean } {
	let scenario = 'ring-two-bosses';
	let seed: number | undefined;
	let verbose = false;

	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--scenario' && argv[i + 1]) {
			scenario = argv[++i]!;
		} else if (a === '--seed' && argv[i + 1]) {
			seed = Number(argv[++i]);
			if (Number.isNaN(seed)) {
				throw new Error(`Invalid --seed: ${argv[i]}`);
			}
		} else if (a === '--verbose') {
			verbose = true;
		}
	}

	return { scenario, seed, verbose };
}

/** Deterministic replacement for Math.random when --seed is passed. */
function mulberry32(a: number): () => number {
	return () => {
		let t = (a += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

async function main(): Promise<void> {
	const { scenario, seed, verbose } = parseArgs(process.argv.slice(2));

	if (seed !== undefined) {
		const rnd = mulberry32(seed);
		Math.random = rnd;
	}

	const game = createTestGame(`harness-${scenario}`);
	const feed = capturePublicFeed(game.eventBus, `harness-cli:${scenario}`);

	try {
		switch (scenario) {
			case 'ring-two-bosses': {
				const { runRingTwoBosses } = await import('./scenarios/ring-two-bosses.js');
				await runRingTwoBosses(game);
				break;
			}
			case 'concurrent-look-monsters': {
				const { runConcurrentLookMonsters } = await import(
					'./scenarios/concurrent-look-monsters.js'
				);
				await runConcurrentLookMonsters(game);
				break;
			}
			default:
				throw new Error(`Unknown scenario: ${scenario} (try: ring-two-bosses, concurrent-look-monsters)`);
		}

		if (verbose) {
			for (const ev of feed.events) {
				process.stdout.write(`[${ev.seq}] ${ev.type} ts=${ev.timestamp}\n${ev.text}\n---\n`);
			}
		} else {
			process.stdout.write(formatPublicFeedLines(feed));
			process.stdout.write('\n');
		}

		process.stdout.write(
			`\n-- ${feed.events.length} public events, scenario=${scenario}${seed !== undefined ? ` seed=${seed}` : ''}\n`,
		);
	} finally {
		feed.unsubscribe();
		game.dispose();
	}

	// Explicit exit: some engine subsystems schedule long timers; harness runs should
	// always terminate when the scenario finishes.
	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
