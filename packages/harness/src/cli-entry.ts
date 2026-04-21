#!/usr/bin/env node
/**
 * CLI bootstrap: apply `--seed` to env before `set-env` / engine load (see PR review).
 * Delegates to `cli-main.ts` for implementation.
 */

function readSeedFromArgv(args: string[]): number | undefined {
	for (let i = 0; i < args.length - 1; i++) {
		if (args[i] === '--seed') {
			const n = Number(args[i + 1]);
			if (Number.isFinite(n) && !Number.isNaN(n)) {
				return Math.trunc(n);
			}
		}
	}
	return undefined;
}

const argv = process.argv.slice(2);
const isSimulate = argv[0] === 'simulate';
const argsForSeed = isSimulate ? argv.slice(1) : argv;
const seed = readSeedFromArgv(argsForSeed);
if (seed !== undefined && process.env.DECK_MONSTERS_HARNESS_RANDOM_SEED === undefined) {
	process.env.DECK_MONSTERS_HARNESS_RANDOM_SEED = String(seed);
}

await import('./cli-main.js');
