/**
 * Import this file before any `@deck-monsters/engine` import so ring combat
 * delays resolve to 0 in harness runs (see `helpers/delay-times.ts`).
 */
if (!process.env.DECK_MONSTERS_SKIP_DELAYS) {
	process.env.DECK_MONSTERS_SKIP_DELAYS = '1';
}
