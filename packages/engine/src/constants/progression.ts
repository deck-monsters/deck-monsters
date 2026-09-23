/**
 * Early-game progression front-loading.
 *
 * Player feedback (Sept 2026): levelling, coin income and interesting card drops all
 * feel slow, "especially for early stage beginner monsters". The mid/late curve is
 * intentionally a slow burn (see docs/archive/roadmap/11-progression-and-economy-2026-09.md) and stays
 * that way — this file only steepens the FIRST few levels/fights and converges back to
 * the existing curve by around level 5-6, so the overall economy is not blanket-buffed.
 *
 * Every knob here is deliberately centralized in one file so the "front-loaded, then
 * converge" shape is tunable in one place instead of scattered magic numbers across
 * levels.ts, coins.ts and the card-draw helpers.
 *
 * See docs/archive/roadmap/11-progression-and-economy-2026-09.md ("Early progression
 * front-loading") for the before/after numbers this was tuned against.
 */

/**
 * XP threshold discount, applied to the cumulative XP needed to reach a given level.
 *
 * The raw curve (see helpers/levels.ts `rawLevelThreshold`) grows Fibonacci-style:
 * 50, 100, 150, 250, 400, 650, 1050, ... A level-1 monster needed ~50 XP (roughly 4
 * average wins) just to reach level 1, and the gap widens every level after that.
 *
 * `earlyXpDiscount(level)` returns a 0-1 multiplier applied to the raw cumulative
 * threshold for the level being reached. It starts at `EARLY_XP_DISCOUNT_FLOOR` for
 * level 1 and climbs by `EARLY_XP_DISCOUNT_STEP` per level until it hits 1.0 (full
 * price) at `EARLY_XP_DISCOUNT_CONVERGE_LEVEL` — from there on the curve is completely
 * unchanged, so mid/late-game pacing (and the "slow burn is fine overall" feedback) is
 * preserved.
 */
export const EARLY_XP_DISCOUNT_FLOOR = 0.45;
export const EARLY_XP_DISCOUNT_STEP = 0.1;
export const EARLY_XP_DISCOUNT_CONVERGE_LEVEL = 6;

export const earlyXpDiscount = (level: number): number =>
	Math.min(1, EARLY_XP_DISCOUNT_FLOOR + EARLY_XP_DISCOUNT_STEP * Math.max(0, level));

/**
 * Extra coins added on top of the normal win/loss/daily payout for a character's first
 * few completed fights (tracked via `character.battles.total`, the same counter that
 * already drives win/loss stats — see creatures/base.ts `addWin`/`addLoss`/`addDraw`).
 *
 * Why this exists: the Sept 18 2026 economy audit (docs/archive/roadmap/
 * 11-progression-and-economy-2026-09.md) fixed the zero-progress draw bug and added a once-daily 5-coin bonus,
 * which gets a new player to the cheapest marked-up shop listing (12-18 coins, see
 * constants/coins.ts) in "at most one additional win or three additional consolation
 * outcomes" per that audit. That is fine for a player who wins early, but a player who
 * is losing every fight (very plausible for a brand-new, low-level monster sharing a
 * ring with higher-level ones) still needed several fights. This tapering bonus
 * guarantees a first purchase within a small handful of fights even in the
 * all-losses case, without inflating the steady-state economy the audit just balanced:
 * it is zero by fight 10, and roughly 5x smaller in total than a second permanent rate
 * increase would be for a player who keeps playing past their first purchase.
 */
export const EARLY_COIN_BONUS_TIERS: ReadonlyArray<{ untilFightsPlayed: number; bonus: number }> = [
	{ untilFightsPlayed: 5, bonus: 3 },
	{ untilFightsPlayed: 10, bonus: 1 },
];

export const earlyCoinBonus = (battlesPlayedBeforeThisFight: number): number => {
	const tier = EARLY_COIN_BONUS_TIERS.find(
		({ untilFightsPlayed }) => battlesPlayedBeforeThisFight < untilFightsPlayed
	);
	return tier?.bonus ?? 0;
};

/**
 * Card-drop rarity boost for low-level monsters.
 *
 * `cards/helpers/draw.ts` already gates which cards a monster is even eligible for
 * (`canHoldCard`, level <= monster.level) — that gate is the level-progression design
 * and this deliberately does NOT touch it. Within the pool a monster already qualifies
 * for, each card's `.probability` (its rarity roll, see helpers/probabilities.ts) is
 * multiplied by this boost before the draw check, so a level-0 monster is more likely
 * to walk away with the rarer/more interesting card *of the ones it's already allowed
 * to hold* — giving a taste of "the good stuff" earlier without letting a beginner
 * monster hold anything above its level. The boost fades to 1x (no change) by
 * `EARLY_DROP_BOOST_CONVERGE_LEVEL`, matching the XP/coin convergence point above.
 */
export const EARLY_DROP_BOOST_MAX = 3;
export const EARLY_DROP_BOOST_CONVERGE_LEVEL = 5;
// Chosen so the boost lands exactly at 1x (no change) on EARLY_DROP_BOOST_CONVERGE_LEVEL,
// rather than converging a level early/late by rounding.
export const EARLY_DROP_BOOST_STEP_PER_LEVEL =
	(EARLY_DROP_BOOST_MAX - 1) / EARLY_DROP_BOOST_CONVERGE_LEVEL;

export const earlyDropBoost = (level: number): number =>
	Math.max(1, EARLY_DROP_BOOST_MAX - EARLY_DROP_BOOST_STEP_PER_LEVEL * Math.max(0, level));
