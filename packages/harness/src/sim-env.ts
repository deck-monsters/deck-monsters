/**
 * Default global PRNG seed for balance scripts (`sim:*`) so lazy engine init is
 * deterministic before each `simulate({ seed })` swaps in per-call fight RNG.
 * Import this line **before** `./set-env.js` in those scripts.
 */
if (process.env.DECK_MONSTERS_HARNESS_RANDOM_SEED === undefined) {
	process.env.DECK_MONSTERS_HARNESS_RANDOM_SEED = '1';
}
