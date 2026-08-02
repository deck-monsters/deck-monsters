/**
 * Per-player boss summon quota — a rolling 24 hour window, scoped to one room.
 *
 * The ledger lives in `game.options.bossSummons` (see `Game.bossSummons`), so it is
 * room-scoped for free and rides the room's `state_blob` across restarts. These functions
 * are deliberately pure: the caller reads the ledger, decides, and writes the new one back
 * through the setter. See `docs/boss-encounters.md` for why the quota is enforced in the
 * engine command handler rather than in the tRPC router.
 */

export const BOSS_SUMMON_LIMIT = 3;
export const BOSS_SUMMON_WINDOW_MS = 24 * 60 * 60 * 1000;

/** userId -> epoch-ms timestamps of that player's summons in this room. */
export type BossSummonLedger = Record<string, number[]>;

export interface SummonAllowance {
	allowed: boolean;
	used: number;
	remaining: number;
	/** Epoch ms at which the next charge frees up, or null when a charge is available now. */
	nextAvailableAt: number | null;
}

const timestampsWithinWindow = (timestamps: unknown, now: number): number[] => {
	if (!Array.isArray(timestamps)) return [];

	const cutoff = now - BOSS_SUMMON_WINDOW_MS;

	return timestamps
		.map(timestamp => Number(timestamp))
		.filter(timestamp => Number.isFinite(timestamp) && timestamp > cutoff)
		.sort((a, b) => a - b);
};

export const summonAllowance = (
	ledger: BossSummonLedger | undefined,
	userId: string,
	now: number = Date.now()
): SummonAllowance => {
	const recent = timestampsWithinWindow(ledger?.[userId], now);
	const used = recent.length;
	const remaining = Math.max(0, BOSS_SUMMON_LIMIT - used);

	if (remaining > 0) {
		return { allowed: true, used, remaining, nextAvailableAt: null };
	}

	// Sorted ascending, so the oldest summon still inside the window is the one whose
	// expiry hands the player their next charge.
	const oldest = recent[recent.length - BOSS_SUMMON_LIMIT];

	return {
		allowed: false,
		used,
		remaining: 0,
		nextAvailableAt: oldest + BOSS_SUMMON_WINDOW_MS,
	};
};

/**
 * Returns a new ledger with `userId`'s summon recorded. Expired timestamps are pruned for
 * every player while rebuilding, which is the only place pruning happens — the `Game`
 * getter stays a pure read so it can never emit `stateChange` from inside another
 * broadcast (see `docs/engine-concurrency-and-timing.md` §7).
 */
export const recordSummon = (
	ledger: BossSummonLedger | undefined,
	userId: string,
	now: number = Date.now()
): BossSummonLedger => {
	const next: BossSummonLedger = {};

	for (const [existingUserId, timestamps] of Object.entries(ledger ?? {})) {
		const recent = timestampsWithinWindow(timestamps, now);
		if (recent.length > 0) next[existingUserId] = recent;
	}

	next[userId] = [...(next[userId] ?? []), now];

	return next;
};
