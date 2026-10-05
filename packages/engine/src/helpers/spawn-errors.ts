/**
 * The refusals the server's `spawnMonster` mutation throws for a problem with one answer.
 * Shared (browser-safe) so the web training wizard can send the player back to the step at
 * fault by exact match instead of guessing from substrings, and so a reworded refusal
 * changes both ends at once (roadmap 44 K4 review).
 */
export const SPAWN_ERRORS = {
	monsterNameTaken: 'That monster name is already taken.',
	characterNameTaken: 'That name is already taken in this room.',
	typeUnavailable: 'That monster type is not available.',
} as const;
