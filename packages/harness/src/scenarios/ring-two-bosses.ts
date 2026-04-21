/**
 * Minimal ring fight: two boss contestants, immediate fight(), no countdown timer.
 * Set `process.env.DECK_MONSTERS_SKIP_DELAYS = '1'` before importing the engine
 * so combat resolves quickly (see cli.ts).
 */

import '../set-env.js';
import type { Game } from '@deck-monsters/engine';
import { randomContestant } from '@deck-monsters/engine';

/**
 * Seeds the ring with two random boss contestants and runs one fight to completion.
 */
export async function runRingTwoBosses(game: Game): Promise<void> {
	const ring = game.getRing();

	ring.addMonster(randomContestant({ isBoss: true }));
	ring.addMonster(randomContestant({ isBoss: true }));

	await ring.fight();
}
