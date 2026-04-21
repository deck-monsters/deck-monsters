/**
 * Import this file before any `@deck-monsters/engine` import so ring combat
 * delays resolve to 0 in harness runs (see `helpers/delay-times.ts`).
 */
if (!process.env.DECK_MONSTERS_SKIP_DELAYS) {
	process.env.DECK_MONSTERS_SKIP_DELAYS = '1';
}
/** When set, `ring.addMonster` preserves contestant order (no Fisher–Yates shuffle). */
if (!process.env.DECK_MONSTERS_DETERMINISTIC_RING) {
	process.env.DECK_MONSTERS_DETERMINISTIC_RING = '1';
}
/** Stable iteration order in `draw()` so seeded simulations match across processes. */
if (!process.env.DECK_MONSTERS_DETERMINISTIC_DRAW) {
	process.env.DECK_MONSTERS_DETERMINISTIC_DRAW = '1';
}
