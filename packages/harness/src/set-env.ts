/**
 * Import this file **first** in any harness file that loads `@deck-monsters/engine`.
 *
 * - Sets harness env flags (skip delays, deterministic ring/draw).
 * - Optionally replaces `Math.random` with a seeded mulberry32 PRNG **before** the
 *   engine is imported, when `DECK_MONSTERS_HARNESS_RANDOM_SEED` is set or when
 *   `process.argv` contains `--seed <n>` (so `tsx src/cli.ts ... --seed 42` seeds
 *   lazy helper RNG the same way in every process).
 */

if (!process.env.DECK_MONSTERS_SKIP_DELAYS) {
	process.env.DECK_MONSTERS_SKIP_DELAYS = '1';
}
if (!process.env.DECK_MONSTERS_DETERMINISTIC_RING) {
	process.env.DECK_MONSTERS_DETERMINISTIC_RING = '1';
}
if (!process.env.DECK_MONSTERS_DETERMINISTIC_DRAW) {
	process.env.DECK_MONSTERS_DETERMINISTIC_DRAW = '1';
}

function readSeedFromArgv(): number | undefined {
	const argv = process.argv;
	for (let i = 0; i < argv.length - 1; i++) {
		if (argv[i] === '--seed') {
			const n = Number(argv[i + 1]);
			if (Number.isFinite(n) && !Number.isNaN(n)) {
				return Math.trunc(n);
			}
		}
	}
	return undefined;
}

const argvSeed = readSeedFromArgv();
if (argvSeed !== undefined && process.env.DECK_MONSTERS_HARNESS_RANDOM_SEED === undefined) {
	process.env.DECK_MONSTERS_HARNESS_RANDOM_SEED = String(argvSeed);
}

const envSeedRaw = process.env.DECK_MONSTERS_HARNESS_RANDOM_SEED;
const envSeed =
	envSeedRaw !== undefined && envSeedRaw !== '' && Number.isFinite(Number(envSeedRaw))
		? Math.trunc(Number(envSeedRaw))
		: undefined;

if (envSeed !== undefined) {
	const mulberry32 = (a: number): (() => number) => {
		return () => {
			let t = (a += 0x6d2b79f5);
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	};
	Math.random = mulberry32(envSeed);
}
