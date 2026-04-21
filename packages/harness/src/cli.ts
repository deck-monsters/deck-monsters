#!/usr/bin/env node
/**
 * Local simulation CLI — no HTTP, no DB.
 *
 * Usage:
 *   pnpm --filter @deck-monsters/harness run run -- [options]
 *   pnpm --filter @deck-monsters/harness simulate -- [options]
 *
 * Scenario mode:
 *   --scenario <id>   ring-two-bosses | concurrent-look-monsters
 *   --seed <n>        Optional Math.random seed (mulberry32) for reproducible fights
 *   --verbose         Print each public event on its own line with seq + type
 *
 * Batch simulation:
 *   --monsters "Basilisk:5,Gladiator:5"
 *   --fights <n>
 *   --seed <n>        Optional reproducible seed
 *   --output json     Print only JSON result to stdout
 *   --verbose         Also print human-readable summary to stderr (json mode)
 */

import './set-env.js';
import { createTestGame } from '@deck-monsters/engine';
import { capturePublicFeed, formatPublicFeedLines } from './public-feed.js';
import { parseMonstersArg, simulate } from './simulate.js';

function parseScenarioArgs(argv: string[]): { scenario: string; seed?: number; verbose: boolean } {
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

interface SimulateCliArgs {
	monsters: string;
	fights: number;
	seed?: number;
	output: 'json' | 'text';
	verbose: boolean;
}

function parseSimulateArgs(argv: string[]): SimulateCliArgs {
	let monsters = '';
	let fights = 1;
	let seed: number | undefined;
	let output: 'json' | 'text' = 'text';
	let verbose = false;

	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--monsters' && argv[i + 1]) {
			monsters = argv[++i]!;
		} else if (a === '--fights' && argv[i + 1]) {
			fights = Number(argv[++i]);
			if (!Number.isFinite(fights) || fights < 1) {
				throw new Error(`Invalid --fights: ${argv[i]}`);
			}
		} else if (a === '--seed' && argv[i + 1]) {
			seed = Number(argv[++i]);
			if (Number.isNaN(seed)) {
				throw new Error(`Invalid --seed: ${argv[i]}`);
			}
		} else if (a === '--output' && argv[i + 1]) {
			const o = argv[++i]!;
			if (o !== 'json' && o !== 'text') {
				throw new Error(`Invalid --output: ${o} (use json or text)`);
			}
			output = o;
		} else if (a === '--verbose') {
			verbose = true;
		}
	}

	if (!monsters) {
		throw new Error('simulate mode requires --monsters "Type:level,Type:level,..."');
	}

	return { monsters, fights, seed, output, verbose };
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

async function runScenarioMode(argv: string[]): Promise<void> {
	const { scenario, seed, verbose } = parseScenarioArgs(argv);

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
}

async function runSimulateMode(argv: string[]): Promise<void> {
	const { monsters, fights, seed, output, verbose } = parseSimulateArgs(argv);
	const specs = parseMonstersArg(monsters);

	const result = await simulate({
		monsters: specs,
		fights,
		seed,
		roomId: 'harness-cli-sim',
	});

	if (output === 'json') {
		process.stdout.write(`${JSON.stringify(result)}\n`);
		if (verbose) {
			process.stderr.write(
				`winRates: ${JSON.stringify(result.winRates)} draw ${result.drawRate.toFixed(2)}% avgRounds ${result.avgRounds.toFixed(2)}\n`,
			);
		}
	} else {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	}
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const isSimulate = argv[0] === 'simulate';
	const rest = isSimulate ? argv.slice(1) : argv;

	if (isSimulate) {
		await runSimulateMode(rest);
	} else {
		await runScenarioMode(rest);
	}

	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
