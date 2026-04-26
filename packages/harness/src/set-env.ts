/**
 * Import this file **first** in any harness file that loads `@deck-monsters/engine`.
 *
 * - Sets harness env flags (skip delays).
 * - Optionally replaces `Math.random` when `DECK_MONSTERS_HARNESS_RANDOM_SEED` is set
 *   (set by `cli-entry.ts` from `--seed`, or by balance scripts via `sim-env.ts`).
 *   Does **not** scan `process.argv` — avoids clashing with Mocha's `--seed`.
 */

import { mulberry32 } from './rng.js';

if (!process.env.DECK_MONSTERS_SKIP_DELAYS) {
	process.env.DECK_MONSTERS_SKIP_DELAYS = '1';
}

const envSeedRaw = process.env.DECK_MONSTERS_HARNESS_RANDOM_SEED;
const envSeed =
	envSeedRaw !== undefined && envSeedRaw !== '' && Number.isFinite(Number(envSeedRaw))
		? Math.trunc(Number(envSeedRaw))
		: undefined;

if (envSeed !== undefined) {
	Math.random = mulberry32(envSeed);
}
