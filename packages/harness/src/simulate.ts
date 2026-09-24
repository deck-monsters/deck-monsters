/**
 * Programmatic N-fight simulation for balance / mechanics validation.
 * `./set-env.js` must load before the engine (env PRNG seeding for lazy helpers).
 */

import './set-env.js';
import type { Game, GameEvent } from '@deck-monsters/engine';
import {
	allMonsters,
	createTestGame,
	EARLY_COIN_BONUS_TIERS,
	engineReady,
	getCardClassByTypeName,
	getUtcDay,
	getXpCapForLevel,
	randomContestant,
	type Contestant,
} from '@deck-monsters/engine';
import { mulberry32 } from './rng.js';

/**
 * Past this many completed battles, `constants/progression.ts`'s `earlyCoinBonus` is
 * always 0 — see its `EARLY_COIN_BONUS_TIERS` docblock. `simulate()` pins every fresh
 * contestant's `character.battles.total` here (see the loop below) so `coinsByOutcome`
 * reads the steady-state payout `awardFightCoins` converges to, not the early-game bonus a
 * `randomCharacter()`-rolled `battles.total` (0-180, uniformly random when no `statSeed` is
 * given) would trip on some unpredictable fraction of fights.
 */
const STEADY_STATE_BATTLES_TOTAL = Math.max(...EARLY_COIN_BONUS_TIERS.map(t => t.untilFightsPlayed));

/** Monotonic id so concurrent `simulate()` calls never share eventBus subscriber keys. */
let harnessSimRunSeq = 0;

export type SimMonsterType = 'Basilisk' | 'Gladiator' | 'Jinn' | 'Minotaur' | 'WeepingAngel';

export interface SimMonsterSpec {
	type: SimMonsterType | string;
	level: number;
	/** Card type names matching engine static `cardType` (e.g. "Hit", "Heal"). */
	deck?: string[];
	/** Varies boss `randomCharacter` battle record for stat diversity. */
	statSeed?: number;
}

export interface SimConfig {
	monsters: SimMonsterSpec[];
	fights: number;
	seed?: number;
	/** Passed to createTestGame as roomId prefix. */
	roomId?: string;
}

/** Per-contestant fight outcome, matching `ring/index.ts`'s private `participantOutcome()`
 * (not exported). The harness reads this straight off `ring.fightResolved`'s `participants[]`
 * — the engine's own authoritative computation — rather than re-deriving it locally; see the
 * comment above `lastParticipants` in `simulate()` for why a locally-held `Contestant`
 * object's own `won`/`lost`/`fled` flags are the wrong thing to read here. */
export type FightOutcomeLabel = 'win' | 'loss' | 'draw' | 'fled' | 'permaDeath';

export interface EconomyStats {
	count: number;
	mean: number;
	p50: number;
	p90: number;
	min: number;
	max: number;
}

export interface SimResult {
	fights: number;
	winRates: Record<string, number>;
	drawRate: number;
	avgRounds: number;
	avgDamagePerCard: Record<string, number>;
	cardDropRate: number;
	/**
	 * **Steady-state** coins credited to `contestant.character.coins` per fight, bucketed by
	 * that contestant's own outcome and read as a before/after diff around `ring.fight()` —
	 * not recomputed from `constants/coins.ts` — so a payout bug (wrong bonus, double
	 * award, missing daily cap) shows up as a distribution anomaly here instead of only
	 * being caught by unit tests that assert the constants were read correctly.
	 * A bucket is absent (rather than a zero-filled stat) when no contestant produced
	 * that outcome in the run.
	 *
	 * "Steady-state" means every fresh per-fight contestant here is pinned past the
	 * once-daily and early-battle-count coin bonuses (`STEADY_STATE_BATTLES_TOTAL`) before it
	 * fights, so this is the payout `awardFightCoins` converges to for an established
	 * character, not what a brand-new player sees on their first handful of fights — for
	 * that, bonuses and all, use `simulateNewPlayerProgression()` instead.
	 */
	coinsByOutcome: Partial<Record<FightOutcomeLabel, EconomyStats>>;
	/**
	 * `monster.xp` gained per contestant per fight, pooled across all outcomes and read
	 * the same before/after way as `coinsByOutcome` — this is the ring's per-monster
	 * combat XP (`Ring.awardMonsterXP` / `calculateXP`), which is distinct from the
	 * player-character XP in `handleWinner`/`handleLoser` et al.
	 */
	xpPerMonster: EconomyStats;
	/**
	 * Count of fights `ring.fight()` cancelled internally (an unexpected error mid-fight —
	 * see `ring/index.ts`'s `.catch` on `doAction()`) rather than resolving normally. These
	 * fights contribute no sample to `coinsByOutcome`/`xpPerMonster` (there is no
	 * per-contestant reward data to diff) but are still counted here rather than silently
	 * dropped, so a run with a nonzero count is visibly incomplete instead of quietly
	 * under-sampled.
	 */
	cancelledFights: number;
}

/** Mean/median/p90/min/max over a sample set. Empty input reads as all-zero with count 0
 * rather than throwing — an outcome bucket a run never produced (e.g. no draws in a
 * lopsided matchup) is a legitimate, silent result, not an error. */
function summarizeSamples(samples: number[]): EconomyStats {
	if (samples.length === 0) {
		return { count: 0, mean: 0, p50: 0, p90: 0, min: 0, max: 0 };
	}
	const sorted = [...samples].sort((a, b) => a - b);
	const sum = sorted.reduce((total, n) => total + n, 0);
	const percentile = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
	return {
		count: sorted.length,
		mean: sum / sorted.length,
		p50: percentile(0.5),
		p90: percentile(0.9),
		min: sorted[0]!,
		max: sorted[sorted.length - 1]!,
	};
}

interface FightResolvedPayload {
	rounds?: number;
	outcome?: string;
	participants?: Array<{
		monsterId: string;
		monsterName: string;
		outcome: FightOutcomeLabel;
		ownerUserId?: string;
	}>;
}

const MONSTER_TYPES: Record<string, SimMonsterType> = {
	basilisk: 'Basilisk',
	gladiator: 'Gladiator',
	jinn: 'Jinn',
	minotaur: 'Minotaur',
	weepingangel: 'WeepingAngel',
	'weeping angel': 'WeepingAngel',
};

export function parseMonsterType(raw: string): SimMonsterType {
	const key = raw.trim().toLowerCase().replace(/\s+/g, '');
	const mapped = MONSTER_TYPES[key];
	if (mapped) return mapped;
	const pascal = raw
		.trim()
		.replace(/(?:^|\s|-)(\w)/g, (_, c: string) => c.toUpperCase())
		.replace(/\s|-/g, '');
	const allowed: SimMonsterType[] = ['Basilisk', 'Gladiator', 'Jinn', 'Minotaur', 'WeepingAngel'];
	if ((allowed as string[]).includes(pascal)) return pascal as SimMonsterType;
	throw new Error(`Unknown monster type: "${raw}" (expected one of: ${allowed.join(', ')})`);
}

function monsterClassFor(spec: SimMonsterType): new (options?: Record<string, unknown>) => unknown {
	const Found = allMonsters.find(M => (M as unknown as { name: string }).name === spec);
	if (!Found) throw new Error(`Monster class not found: ${spec}`);
	return Found as new (options?: Record<string, unknown>) => unknown;
}

function buildContestant(
	spec: SimMonsterType,
	level: number,
	deckNames: string[] | undefined,
	statSeed: number | undefined,
	fightIndex: number,
): Contestant {
	const MonsterClass = monsterClassFor(spec);
	const xp = getXpCapForLevel(level);
	const seedPart = statSeed !== undefined ? statSeed + fightIndex : undefined;
	const battles =
		seedPart !== undefined
			? { total: 40, wins: Math.abs(seedPart) % 41, losses: 0 }
			: undefined;
	if (battles) battles.losses = battles.total - battles.wins;

	const contestant = randomContestant({
		isBoss: true,
		Monsters: [MonsterClass],
		xp,
		...(battles ? { battles } : {}),
	});

	if (deckNames?.length) {
		type CardCtor = new () => { cardType?: string; name?: string; play?: (...args: unknown[]) => unknown };
		contestant.monster.cards = deckNames.map(n => new (getCardClassByTypeName(n) as CardCtor)());
	}

	return contestant;
}

function installHitDamageCapture(
	contestants: Contestant[],
	sums: Map<string, { total: number; count: number }>,
): () => void {
	type HitMonster = {
		on(event: string, fn: (...args: unknown[]) => void): (...args: unknown[]) => void;
		off(event: string, fn: (...args: unknown[]) => void): void;
	};
	const listeners: Array<{ monster: HitMonster; bound: (...args: unknown[]) => void }> = [];

	for (const { monster } of contestants) {
		const m = monster as HitMonster;
		const bound = m.on('hit', (...args: unknown[]) => {
			const ev = args[2] as { card?: { cardType?: string; name?: string }; damage?: number };
			const dmg = typeof ev?.damage === 'number' ? ev.damage : 0;
			if (dmg <= 0) return;
			const card = ev?.card;
			const key = (card?.cardType || card?.name || 'unknown') as string;
			const cur = sums.get(key) ?? { total: 0, count: 0 };
			cur.total += dmg;
			cur.count += 1;
			sums.set(key, cur);
		});
		listeners.push({ monster: m, bound });
	}

	return () => {
		for (const { monster: mon, bound } of listeners) {
			mon.off('hit', bound);
		}
	};
}

function aggregateDamagePerCard(sums: Map<string, { total: number; count: number }>): Record<string, number> {
	const out: Record<string, number> = {};
	for (const [name, { total, count }] of sums) {
		out[name] = count > 0 ? total / count : 0;
	}
	return out;
}

function pushWinCounts(
	winCounts: Map<string, number>,
	stableIdToLabel: Map<string, string>,
	p: FightResolvedPayload,
): void {
	const parts = p.participants ?? [];
	for (const part of parts) {
		if (part.outcome !== 'win') continue;
		const label =
			stableIdToLabel.get(part.monsterId) ??
			(winCounts.has(part.monsterName) ? part.monsterName : undefined);
		if (!label) {
			throw new Error(
				`simulate: could not map winner stableId=${part.monsterId} name=${part.monsterName} to a sim slot`,
			);
		}
		winCounts.set(label, (winCounts.get(label) ?? 0) + 1);
	}
}

/**
 * Run `config.fights` ring encounters with the given monster lineup (2+ monsters).
 * Reuses one `Game` for the whole batch (fast) while registering each fight's characters
 * on `game.characters` so global listeners stay room-scoped.
 */
export async function simulate(config: SimConfig): Promise<SimResult> {
	const { monsters, fights, seed, roomId = 'harness-sim' } = config;
	const subscriberRunId = ++harnessSimRunSeq;
	if (monsters.length < 2) {
		throw new Error('simulate() requires at least 2 monsters');
	}
	if (fights < 1 || !Number.isFinite(fights)) {
		throw new Error('simulate() requires fights >= 1');
	}

	const prevRing = process.env.DECK_MONSTERS_DETERMINISTIC_RING;
	const prevDraw = process.env.DECK_MONSTERS_DETERMINISTIC_DRAW;
	process.env.DECK_MONSTERS_DETERMINISTIC_RING = '1';
	process.env.DECK_MONSTERS_DETERMINISTIC_DRAW = '1';

	await engineReady;

	const prevRandom = Math.random;
	if (seed !== undefined) {
		Math.random = mulberry32(seed);
	}

	const names = monsters.map((_, i) => `Sim ${i + 1}`);
	const winCounts = new Map<string, number>();
	for (const n of names) winCounts.set(n, 0);
	let draws = 0;
	let roundSum = 0;
	let cardDrops = 0;
	const damageSums = new Map<string, { total: number; count: number }>();
	const coinSamplesByOutcome: Partial<Record<FightOutcomeLabel, number[]>> = {};
	const xpSamples: number[] = [];
	let cancelledFights = 0;

	const game: Game = createTestGame(`${roomId}-batch`, { characters: {} });
	const ring = game.getRing();

	const charMap = game as unknown as { characters: Record<string, unknown> };
	const stableIdToLabel = new Map<string, string>();

	// `ring.addMonster()` copies the `{monster, character, userId, isBoss}` fields into its
	// OWN internal `Contestant` object rather than keeping the one this function builds — so
	// `won`/`lost`/`fled`, set in place on *that* copy by `Ring.fightConcludes()`, never reach
	// the `contestants` array below. `monster.dead`/`.destroyed` still work (the monster
	// object itself is shared by reference), but a coins/XP bucketing keyed on `c.won`/`c.fled`
	// silently produced zero 'win' and 'fled' samples every run — caught only because
	// `res.winRates` (computed from this same event, correctly) disagreed with it. Read the
	// outcome from `ring.fightResolved`'s `participants`, the engine's own authoritative
	// computation, instead of trying to observe flags on an object the ring has replaced.
	let lastParticipants: NonNullable<FightResolvedPayload['participants']> = [];

	const unsubFight = game.eventBus.subscribe(`sim-fight:${subscriberRunId}:${roomId}`, {
		deliver(ev: GameEvent) {
			if (ev.type !== 'ring.fightResolved') return;
			const p = ev.payload as FightResolvedPayload;
			const rounds = typeof p.rounds === 'number' ? p.rounds : 0;
			roundSum += rounds;
			lastParticipants = p.participants ?? [];
			if (p.outcome === 'draw') {
				draws += 1;
				return;
			}
			pushWinCounts(winCounts, stableIdToLabel, p);
		},
	});

	const unsubDrop = game.eventBus.subscribe(`sim-drop:${subscriberRunId}:${roomId}`, {
		deliver(ev: GameEvent) {
			if (ev.type === 'ring.cardDrop' && ev.scope === 'public') cardDrops += 1;
		},
	});

	try {
		for (let f = 0; f < fights; f++) {
			ring.clearRing();

			const contestants = monsters.map((m, i) => {
				const type = typeof m.type === 'string' ? parseMonsterType(m.type) : (m.type as SimMonsterType);
				const c = buildContestant(type, m.level, m.deck, m.statSeed, f);
				const label = names[i]!;
				c.monster.setOptions({
					name: label,
					stableId: `harness-sim-${roomId}-${f}-m${i}`,
				});
				// Pin past the once-daily and early-battle-count coin bonuses (see
				// `STEADY_STATE_BATTLES_TOTAL`'s docblock) so `coinsByOutcome` reads the payout
				// `awardFightCoins` converges to, not a bonus a freshly-`randomCharacter()`-built
				// contestant would trip unpredictably. `character.battles` here is a distinct
				// object from `monster.battles` (only shared at construction when `statSeed` seeds
				// both) — resetting it doesn't touch the monster's own combat-stat-diversity record.
				c.character.lastDailyFightCoinDay = getUtcDay();
				c.character.battles = { total: STEADY_STATE_BATTLES_TOTAL, wins: 0, losses: 0 };
				stableIdToLabel.set(c.monster.stableId as string, label);
				return c;
			});

			const simUserIds: string[] = [];
			for (let i = 0; i < contestants.length; i++) {
				const uid = `sim-${subscriberRunId}-${f}-${i}`;
				simUserIds.push(uid);
				const c = contestants[i]!;
				c.userId = uid;
				charMap.characters[uid] = c.character;
			}

			for (const c of contestants) {
				ring.addMonster({
					monster: c.monster,
					character: c.character,
					userId: c.userId,
					isBoss: c.isBoss,
				});
			}

			const removeHitListeners = installHitDamageCapture(contestants, damageSums);
			// Snapshot before the fight mutates these in place, so the after-read below is a
			// real diff of what the engine credited (see `SimResult.coinsByOutcome` docblock)
			// rather than a recomputation from the coins/XP constants.
			const coinsBefore = contestants.map(c => c.character.coins as number);
			const monsterXpBefore = contestants.map(c => c.monster.xp as number);

			try {
				await ring.fight();

				// `ring.fight()` swallows an unexpected internal error rather than rejecting: its
				// own catch (ring/index.ts) publishes `ring.fightResolved` with
				// `outcome: 'cancelled', participants: []` and clears the ring, so `await` above
				// resolves normally with no per-contestant reward data for this fight. A normal
				// fight (win/loss/draw/fled/permaDeath) always lists every contestant in
				// `participants`, so an empty array unambiguously means "cancelled" here — treat
				// it as a fight this run couldn't measure, not a bug in the bucketing below, and
				// don't let one cancelled fight crash the whole batch the way the pre-existing
				// win/round/card-drop counters (which silently no-op on an empty `participants`)
				// already tolerate it.
				if (lastParticipants.length === 0) {
					cancelledFights += 1;
					console.warn(
						`simulate: fight ${f} was cancelled by the engine (see the 'ring.fight' error log) — skipping its economy sample`,
					);
				} else {
					for (let i = 0; i < contestants.length; i++) {
						const c = contestants[i]!;
						const coinsGained = (c.character.coins as number) - (coinsBefore[i] ?? 0);
						const xpGained = (c.monster.xp as number) - (monsterXpBefore[i] ?? 0);
						const participant = lastParticipants.find(pp => pp.monsterId === c.monster.stableId);
						if (!participant) {
							throw new Error(
								`simulate: no ring.fightResolved participant for stableId=${c.monster.stableId} — cannot bucket coins/XP by outcome`,
							);
						}
						(coinSamplesByOutcome[participant.outcome] ??= []).push(coinsGained);
						xpSamples.push(xpGained);
					}
				}
			} finally {
				removeHitListeners();
				for (const c of contestants) {
					stableIdToLabel.delete(c.monster.stableId as string);
				}
				for (const uid of simUserIds) {
					delete charMap.characters[uid];
				}
			}
		}
	} finally {
		// `ring.clearRing()` is what disposes a fight's *transient* (harness/boss) contestants'
		// timers (passive healing, respawn) — see `disposeTransientContestant()`. The loop above
		// only calls it at the START of the next fight, so the last fight's contestants are
		// still holding live timers when the loop exits; `game.dispose()` doesn't reach them
		// either, since they were already dropped from `charMap.characters` in each fight's own
		// finally block. Without this, a harness run's dangling monster timers keep the Node
		// process alive after every `sim:*` script's real work is done (observed: `sim:cardpower`
		// and `sim:economy` both hung past their printed output until killed).
		ring.clearRing();
		unsubFight();
		unsubDrop();
		game.dispose();
		Math.random = prevRandom;
		if (prevRing === undefined) {
			delete process.env.DECK_MONSTERS_DETERMINISTIC_RING;
		} else {
			process.env.DECK_MONSTERS_DETERMINISTIC_RING = prevRing;
		}
		if (prevDraw === undefined) {
			delete process.env.DECK_MONSTERS_DETERMINISTIC_DRAW;
		} else {
			process.env.DECK_MONSTERS_DETERMINISTIC_DRAW = prevDraw;
		}
	}

	const winRates: Record<string, number> = {};
	for (const n of names) {
		winRates[n] = fights > 0 ? ((winCounts.get(n) ?? 0) / fights) * 100 : 0;
	}

	const coinsByOutcome: Partial<Record<FightOutcomeLabel, EconomyStats>> = {};
	for (const [label, samples] of Object.entries(coinSamplesByOutcome) as Array<
		[FightOutcomeLabel, number[]]
	>) {
		coinsByOutcome[label] = summarizeSamples(samples);
	}

	return {
		fights,
		winRates,
		drawRate: fights > 0 ? (draws / fights) * 100 : 0,
		avgRounds: fights > 0 ? roundSum / fights : 0,
		avgDamagePerCard: aggregateDamagePerCard(damageSums),
		cardDropRate: fights > 0 ? cardDrops / fights : 0,
		coinsByOutcome,
		xpPerMonster: summarizeSamples(xpSamples),
		cancelledFights,
	};
}

export function simMonsterLineup(monsters: SimMonsterSpec[]): string {
	return monsters.map(m => `${parseMonsterType(String(m.type))}:${m.level}`).join(',');
}

export function parseMonstersArg(arg: string): SimMonsterSpec[] {
	return arg.split(',').map(part => {
		const [typeRaw, levelRaw] = part.split(':').map(s => s.trim());
		if (!typeRaw || levelRaw === undefined || levelRaw === '') {
			throw new Error(`Invalid monster entry "${part}" (expected Type:level)`);
		}
		const level = Number(levelRaw);
		if (!Number.isFinite(level) || level < 0) throw new Error(`Invalid level in "${part}"`);
		return { type: parseMonsterType(typeRaw), level: Math.floor(level) };
	});
}

// ---------------------------------------------------------------------------
// New-player progression scenario
// ---------------------------------------------------------------------------

export interface NewPlayerScenarioConfig {
	playerType?: SimMonsterType | string;
	opponentType?: SimMonsterType | string;
	/** Fixed level for the disposable opponent each fight (default 1: a fresh player's
	 * likely early matchup). The opponent never persists or levels between fights. */
	opponentLevel?: number;
	/** Fight counts at which to record a snapshot. Default [1, 5, 20] per roadmap 11's
	 * "Economy telemetry" item. */
	checkpoints?: number[];
	seed?: number;
	roomId?: string;
}

export interface NewPlayerCheckpoint {
	afterFights: number;
	/** Cumulative `character.coins`. */
	coins: number;
	/** Cumulative `character.xp` (the player-progression XP `handleWinner`/`handleLoser`/
	 * etc. award — see `game.ts`), not the monster's combat XP. */
	characterXp: number;
	/** Cumulative `monster.xp` gained across all fights so far (the ring's per-monster
	 * combat XP — see `Ring.awardMonsterXP`), summed as a delta each fight since the
	 * disposable per-fight monster object itself doesn't persist. */
	monsterXpGained: number;
	wins: number;
	losses: number;
	/** Fights so far that `ring.fight()` cancelled internally (no participants, no rewards).
	 * `afterFights` counts attempts, so a non-zero value means fewer rewarded fights. */
	cancelledFights: number;
}

/**
 * Simulates one persistent player's first `max(checkpoints)` fights against a fixed-level
 * disposable opponent, snapshotting cumulative coins/XP at each checkpoint. This is the
 * "new player" scenario from roadmap 11's Economy telemetry item: coins and XP after 1, 5,
 * and 20 fights for a fresh character.
 *
 * The player's `character` (wallet, XP, win/loss record, daily-bonus tracking) persists
 * across fights so the early-game bonuses in `game.ts`'s `awardFightCoins` — the once-daily
 * fight bonus and the `earlyCoinBonus` taper keyed on cumulative battle count — behave the
 * same way they do for a real player across a session, rather than re-triggering on every
 * fight the way a brand-new character would. The player's *monster* is rebuilt fresh each
 * fight instead of reused: reusing the same monster object across fights would require
 * simulating revival/passive-healing between bouts (real-time timers this harness
 * deliberately skips — see `set-env.ts`), which is unrelated to what this scenario measures.
 * `monsterXpGained` is therefore tracked as a running sum of each fight's delta rather than
 * a single before/after read.
 */
export async function simulateNewPlayerProgression(
	config: NewPlayerScenarioConfig = {},
): Promise<NewPlayerCheckpoint[]> {
	const {
		playerType = 'Gladiator',
		opponentType = 'Basilisk',
		opponentLevel = 1,
		checkpoints = [1, 5, 20],
		seed,
		roomId = 'harness-new-player',
	} = config;

	if (checkpoints.length === 0) {
		throw new Error('simulateNewPlayerProgression() requires at least one checkpoint');
	}
	// `maxFights` bounds the fight loop, so a non-integer checkpoint would never be recorded,
	// NaN would return nothing, and Infinity would never terminate.
	const badCheckpoint = checkpoints.find(c => !Number.isInteger(c) || c < 1);
	if (badCheckpoint !== undefined) {
		throw new Error(
			`simulateNewPlayerProgression() checkpoints must be positive integers; got ${badCheckpoint}`,
		);
	}
	const maxFights = Math.max(...checkpoints);
	const checkpointSet = new Set(checkpoints);
	const subscriberRunId = ++harnessSimRunSeq;

	const prevRing = process.env.DECK_MONSTERS_DETERMINISTIC_RING;
	const prevDraw = process.env.DECK_MONSTERS_DETERMINISTIC_DRAW;
	const prevRandom = Math.random;
	process.env.DECK_MONSTERS_DETERMINISTIC_RING = '1';
	process.env.DECK_MONSTERS_DETERMINISTIC_DRAW = '1';

	// `game`/`unsubFight` are populated inside the `try` below and guarded with `?.` in
	// `finally` — everything fallible (including `parseMonsterType`, which used to run
	// *after* the globals above were installed but before this `try`) must stay inside the
	// restoration path. An invalid `playerType`/`opponentType` used to throw past the
	// `try`/`finally` entirely, leaving `Math.random` and the deterministic-ring/draw env
	// vars permanently overridden for the rest of the process — every simulation run after
	// it silently used the wrong PRNG. See `simulate()` above, which never had this bug
	// because its own `parseMonsterType` call already lived inside its `try`.
	let game: Game | undefined;
	let unsubFight: (() => void) | undefined;
	const checkpointResults: NewPlayerCheckpoint[] = [];

	try {
		await engineReady;

		if (seed !== undefined) {
			Math.random = mulberry32(seed);
		}

		const playerTypeParsed = typeof playerType === 'string' ? parseMonsterType(playerType) : playerType;
		const opponentTypeParsed =
			typeof opponentType === 'string' ? parseMonsterType(opponentType) : opponentType;

		game = createTestGame(`${roomId}-batch`, { characters: {} });
		const ring = game.getRing();
		const charMap = game as unknown as { characters: Record<string, unknown> };

		// Read the player's outcome from the engine's own `ring.fightResolved` computation
		// rather than the `player` Contestant object's `won`/`lost`/`fled` flags: `Ring.addMonster()`
		// copies the fields it's given into its own internal Contestant, so those flags — set on
		// the ring's copy by `Ring.fightConcludes()` — never reach the object this function holds.
		// See the matching comment in `simulate()`, where the same bug was caught by a real result
		// mismatch (`res.winRates` disagreeing with a coins-by-outcome breakdown keyed on `c.won`).
		let lastParticipants: NonNullable<FightResolvedPayload['participants']> = [];
		unsubFight = game.eventBus.subscribe(`sim-newplayer-fight:${subscriberRunId}:${roomId}`, {
			deliver(ev: GameEvent) {
				if (ev.type !== 'ring.fightResolved') return;
				lastParticipants = (ev.payload as FightResolvedPayload).participants ?? [];
			},
		});

		// Persistent economy state, threaded onto a fresh disposable character object each
		// fight (see docblock above for why the character can't simply be reused as-is).
		let coins = 0;
		let characterXp = 0;
		let battles = { total: 0, wins: 0, losses: 0 };
		let lastDailyFightCoinDay: string | undefined;
		let monsterXpGained = 0;
		let wins = 0;
		let losses = 0;
		let cancelledFights = 0;

		for (let f = 0; f < maxFights; f++) {
			ring.clearRing();

			const player = buildContestant(playerTypeParsed, 1, undefined, undefined, f);
			player.character.coins = coins;
			player.character.xp = characterXp;
			player.character.battles = { ...battles };
			if (lastDailyFightCoinDay !== undefined) {
				player.character.lastDailyFightCoinDay = lastDailyFightCoinDay;
			}
			player.monster.setOptions({ name: 'New Player', stableId: `harness-newplayer-${roomId}-${f}` });
			player.userId = `newplayer-${subscriberRunId}`;
			charMap.characters[player.userId] = player.character;

			const opponent = buildContestant(opponentTypeParsed, opponentLevel, undefined, undefined, f);
			opponent.monster.setOptions({
				name: 'Opponent',
				stableId: `harness-newplayer-${roomId}-opp-${f}`,
			});
			opponent.userId = `newplayer-opp-${subscriberRunId}-${f}`;
			charMap.characters[opponent.userId] = opponent.character;

			ring.addMonster({
				monster: player.monster,
				character: player.character,
				userId: player.userId,
				isBoss: player.isBoss,
			});
			ring.addMonster({
				monster: opponent.monster,
				character: opponent.character,
				userId: opponent.userId,
				isBoss: opponent.isBoss,
			});

			const monsterXpBefore = player.monster.xp as number;

			try {
				await ring.fight();

				monsterXpGained += (player.monster.xp as number) - monsterXpBefore;
				// See `simulate()`'s matching comment: an empty `participants` array means
				// `ring.fight()` cancelled this fight internally rather than resolving it — there
				// is no win/loss to attribute, so leave the running counts as they were rather
				// than crashing the whole progression run over one cancelled fight.
				if (lastParticipants.length > 0) {
					const playerParticipant = lastParticipants.find(pp => pp.monsterId === player.monster.stableId);
					if (!playerParticipant) {
						throw new Error(
							`simulateNewPlayerProgression: no ring.fightResolved participant for stableId=${player.monster.stableId}`,
						);
					}
					if (playerParticipant.outcome === 'win') wins += 1;
					else if (playerParticipant.outcome === 'loss' || playerParticipant.outcome === 'permaDeath') losses += 1;
				} else {
					cancelledFights += 1;
				}

				coins = player.character.coins as number;
				characterXp = player.character.xp as number;
				battles = player.character.battles as { total: number; wins: number; losses: number };
				lastDailyFightCoinDay = player.character.lastDailyFightCoinDay as string | undefined;
			} finally {
				delete charMap.characters[player.userId];
				delete charMap.characters[opponent.userId];
			}

			const fightsCompleted = f + 1;
			if (checkpointSet.has(fightsCompleted)) {
				checkpointResults.push({
					afterFights: fightsCompleted,
					coins,
					characterXp,
					monsterXpGained,
					wins,
					losses,
					cancelledFights,
				});
			}
		}
	} finally {
		// See the matching comment in `simulate()`'s finally block: the last fight's
		// transient contestants otherwise keep live timers past the end of the run.
		// `game`/`unsubFight` may still be unset if setup itself threw (e.g. an invalid
		// `playerType`/`opponentType`) before either was created — guard both.
		game?.getRing().clearRing();
		unsubFight?.();
		game?.dispose();
		Math.random = prevRandom;
		if (prevRing === undefined) {
			delete process.env.DECK_MONSTERS_DETERMINISTIC_RING;
		} else {
			process.env.DECK_MONSTERS_DETERMINISTIC_RING = prevRing;
		}
		if (prevDraw === undefined) {
			delete process.env.DECK_MONSTERS_DETERMINISTIC_DRAW;
		} else {
			process.env.DECK_MONSTERS_DETERMINISTIC_DRAW = prevDraw;
		}
	}

	return checkpointResults;
}
