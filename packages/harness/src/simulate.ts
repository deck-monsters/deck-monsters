/**
 * Programmatic N-fight simulation for balance / mechanics validation.
 * `./set-env.js` must load before the engine (env PRNG seeding for lazy helpers).
 */

import './set-env.js';
import type { Game, GameEvent } from '@deck-monsters/engine';
import {
	allMonsters,
	createTestGame,
	drawCard,
	EARLY_COIN_BONUS_TIERS,
	engineReady,
	getCardClassByTypeName,
	getInitialDeck,
	getUtcDay,
	getXpCapForLevel,
	randomContestant,
	RING_EVENT_CHANCE_PERCENT,
	MAX_CARD_COPIES_IN_HAND,
	buildRingEventContext,
	selectRingEvent,
	type Contestant,
} from '@deck-monsters/engine';
import { mulberry32 } from './rng.js';
import { makeCard } from './balance/synthetic-cards.js';
import { applyReferenceChassis } from './balance/reference.js';
import { LIKELY_DECKS } from './likely-decks.js';

/**
 * Past this many completed battles, `constants/progression.ts`'s `earlyCoinBonus` is
 * always 0 — see its `EARLY_COIN_BONUS_TIERS` docblock. `simulate()` pins every fresh
 * contestant's `character.battles.total` here (see the loop below) so `coinsByOutcome`
 * reads the steady-state payout `awardFightCoins` converges to, not the early-game bonus a
 * `randomCharacter()`-rolled `battles.total` (0-180, uniformly random when no `statSeed` is
 * given) would trip on some unpredictable fraction of fights.
 */
const STEADY_STATE_BATTLES_TOTAL = Math.max(...EARLY_COIN_BONUS_TIERS.map(t => t.untilFightsPlayed));

/** A ring event that only switches the fight to last-team victory; see `SimMonsterSpec.team`. */
const HARNESS_TEAM_EVENT = {
	id: 'harness-teams',
	name: 'Harness teams',
	banner: '',
	weight: 0,
	victoryMode: 'last-team',
	eligible: () => true,
	apply: () => undefined,
};

/** Monotonic id so concurrent `simulate()` calls never share eventBus subscriber keys. */
let harnessSimRunSeq = 0;

/**
 * Every monster the harness can field, by engine class name ("WeepingAngel"), derived from
 * the engine's `allMonsters`. The harness used to list the monsters by hand in five places,
 * and a new monster that missed one was silently left out of that report (a PR #397 review
 * caught `sim-unicorn` skipping one). `harness.test.ts` checks this still matches.
 */
export const SIM_MONSTER_TYPES: readonly string[] = allMonsters.map(
	M => (M as unknown as { name: string }).name,
);

/** A name from `SIM_MONSTER_TYPES`. */
export type SimMonsterType = string;

export interface SimMonsterSpec {
	type: SimMonsterType;
	level: number;
	/** Card type names matching engine static `cardType` (e.g. "Hit", "Heal"). */
	deck?: string[];
	/** Varies boss `randomCharacter` battle record for stat diversity. */
	statSeed?: number;
	/**
	 * Optional faction. When any spec sets one, the fight runs under a harness-only
	 * `last-team` victory mode (the same mode Common Cause and House War use), so allies
	 * stop when only one team is standing instead of turning on each other.
	 */
	team?: string;
	/**
	 * What kind of contestant this is. Omitted: the harness's classic sim contestant (built
	 * like a boss for its deck, but with its own faction and default targeting). `human`: a
	 * player, with a starting deck (`getInitialDeck`) and a few fills per level, equipped at
	 * random, its own faction, and default targeting. `boss`: a real boss, exactly as the ring
	 * spawns one: the Boss team, a boss deck, and a boss temperament (a targeting strategy from
	 * the engine's boss personalities).
	 * Bosses are only realistic beside at least one human.
	 */
	role?: 'human' | 'boss';
	/**
	 * How a `human` builds its hand. `random` (the default) equips legal cards at random
	 * from a starting deck plus fills; `likely` prefers its monster's signature cards and
	 * the handbook's example builds (`likely-decks.ts`), what a player who knows the monster
	 * equips. Ignored for other roles and when `deck` is given.
	 */
	deckStyle?: 'random' | 'likely';
	/**
	 * `reference` builds the balance methodology's reference chassis (`balance/reference.ts`):
	 * median stats of the real monsters, no creature type. `type` still picks the class the
	 * engine instantiates; the chassis overrides its stats. Roadmap 34.
	 */
	chassis?: 'reference';
}

export interface SimConfig {
	monsters: SimMonsterSpec[];
	fights: number;
	seed?: number;
	/** Passed to createTestGame as roomId prefix. */
	roomId?: string;
	/** Called with each fight's contestants once they are built, before the fight (tests). */
	onContestants?: (contestants: Contestant[]) => void;
	/**
	 * Roll the ring's own events before each fight, at the ring's own chance
	 * (`RING_EVENT_CHANCE_PERCENT`), from the events eligible for that roster. Off by default:
	 * every earlier report ran without them. A Gauntlet's extra bosses are not sim slots; their
	 * wins count under `EXTRA_BOSS_LABEL`. Ignored when any spec sets a team.
	 */
	ringEvents?: boolean;
	/**
	 * Record per-fight excitement (roadmap 35 task 1; 34's Layer 6, reduced): rounds, Curse
	 * of Loki and stroke-of-luck rolls, and how far behind the eventual winner fell. Off by
	 * default; it reads the public `announce` events, so it costs a little.
	 */
	trackExcitement?: boolean;
	/**
	 * Called once per fight, in fight order, as the ring resolves it, with the winning labels
	 * (empty for a draw). The runner's per-fight probes use it to close each fight
	 * (`balance/probes.ts`).
	 */
	onFightResolved?: (winners: string[]) => void;
}

/**
 * One fight's excitement record. `winnerLowestLead` is the winner's worst HP position during
 * the fight: its HP fraction minus the best opponent's, at its lowest (−1 to 1). A winner that
 * fell to −0.5 came back from half its health behind: the "please get a Loki" turnaround.
 * Absent on a draw.
 */
export interface FightExcitement {
	rounds: number;
	loki: number;
	luck: number;
	winnerLowestLead?: number;
}

/** The win label for a boss a ring event added (the Gauntlet's extras). */
export const EXTRA_BOSS_LABEL = 'Extra boss';

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
	/**
	 * The labels that won each fight, in fight order (empty for a draw). A team win names
	 * every surviving member, so a side's win rate is the share of fights naming any of its
	 * members; summing or taking the best of `winRates` cannot give that (a Codex review of
	 * PR #403).
	 */
	winnersByFight: string[][];
	/** Ring events rolled, by name, when `SimConfig.ringEvents` is on. */
	ringEvents: Record<string, number>;
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
	/** Per fight, in order, when `trackExcitement` is set. */
	excitement?: FightExcitement[];
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

const normalizeMonsterName = (raw: string): string => raw.trim().toLowerCase().replace(/[\s_-]+/g, '');

/**
 * Accepts a class name or a creature type in any case, with or without spaces or dashes
 * ("weeping angel", "Weeping-Angel", "WeepingAngel").
 */
export function parseMonsterType(raw: string): SimMonsterType {
	const key = normalizeMonsterName(raw);
	const found = SIM_MONSTER_TYPES.find(type => normalizeMonsterName(type) === key);
	if (found) return found;
	throw new Error(`Unknown monster type: "${raw}" (expected one of: ${SIM_MONSTER_TYPES.join(', ')})`);
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
		contestant.monster.cards = deckNames.map(n => makeCard(n) as InstanceType<CardCtor>);
	} else {
		contestant.monster.cards = withoutHarnessExcludedCards(contestant.monster);
	}

	return contestant;
}

/** Fisher-Yates on `Math.random`, which `simulate()` seeds. */
function shuffled<T>(items: T[]): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j]!, out[i]!];
	}
	return out;
}

/** Random cards a human has picked up beyond the starting deck, per level. */
const HUMAN_EXTRA_CARDS_PER_LEVEL = 2;

/**
 * A player's contestant: the starting deck every new character gets, plus a couple of cards
 * per level (drops and shop buys), with nine legal cards equipped at random. Players build
 * their hands, so this is still a floor for how well a human plays, not a model of it; Flee
 * stays out, as it does for every harness deck.
 */
function buildHuman(
	spec: SimMonsterType,
	level: number,
	deckNames: string[] | undefined,
	deckStyle: 'random' | 'likely' = 'random',
): Contestant {
	const MonsterClass = monsterClassFor(spec);
	const contestant = randomContestant({ isBoss: false, Monsters: [MonsterClass], xp: getXpCapForLevel(level) });
	const { monster, character } = contestant as unknown as {
		monster: HarnessMonster & { cardSlots: number };
		character: unknown;
	};
	type CardCtor = new () => { cardType?: string };

	if (deckNames?.length) {
		monster.cards = deckNames.map(n => makeCard(n) as InstanceType<CardCtor>);
		return contestant;
	}

	const eligible = {
		level: monster.level,
		canHoldCard: (Card: { cardType?: string }) =>
			!HARNESS_EXCLUDED_CARD_TYPES.includes(Card.cardType ?? '') && monster.canHoldCard(Card),
	};
	const pool = [
		...(getInitialDeck({}, character) as Array<{ cardType?: string }>),
		...Array.from({ length: level * HUMAN_EXTRA_CARDS_PER_LEVEL }, () => drawCard({}, eligible)),
	].filter(card => !HARNESS_EXCLUDED_CARD_TYPES.includes(card.cardType ?? '') && monster.canHoldCard(card));
	// A likely deck takes the preferred cards the monster can hold at its level, in order,
	// then fills the rest of its slots from the random pool.
	const preferred: Array<{ cardType?: string }> = [];
	if (deckStyle === 'likely') {
		for (const name of LIKELY_DECKS[spec] ?? []) {
			if (preferred.length >= monster.cardSlots) break;
			const card = new (getCardClassByTypeName(name) as CardCtor)();
			if (monster.canHoldCard(card)) preferred.push(card);
		}
	}
	// A hand obeys the copy limit a player's equip does (MAX_CARD_COPIES_IN_HAND): a likely
	// deck's preferred Hit on top of the starting deck's copies gave five, a hand no player
	// could equip (a Codex review of PR #405).
	const counts = new Map<string, number>();
	const fits = (card: { cardType?: string }): boolean => (counts.get(card.cardType ?? '') ?? 0) < MAX_CARD_COPIES_IN_HAND;
	const take = (card: { cardType?: string }): void => {
		counts.set(card.cardType ?? '', (counts.get(card.cardType ?? '') ?? 0) + 1);
		hand.push(card);
	};
	const hand: Array<{ cardType?: string }> = [];
	for (const card of [...preferred, ...shuffled(pool)]) {
		if (hand.length >= monster.cardSlots) break;
		if (fits(card)) take(card);
	}
	for (let tries = 0; hand.length < monster.cardSlots && tries < 200; tries += 1) {
		const card = drawCard({}, eligible);
		if (card && fits(card)) take(card);
	}
	monster.cards = hand;
	return contestant;
}

/**
 * Card types a random harness deck never keeps. Flee is a special-purpose escape: a player
 * holds it for a bad matchup, not as a routine deck slot. In a simulation it only turns
 * fights into draws, which hides the matchup the run is trying to measure. An explicit
 * `SimMonsterSpec.deck` is left exactly as given.
 */
export const HARNESS_EXCLUDED_CARD_TYPES: readonly string[] = ['Flee'];

type HarnessMonster = {
	level: number;
	cards: Array<{ cardType?: string }>;
	canHoldCard(card: unknown): boolean;
};

/** The monster's random deck with each excluded card swapped for a fresh legal draw. */
export function withoutHarnessExcludedCards(monster: HarnessMonster): HarnessMonster['cards'] {
	const eligible = {
		level: monster.level,
		canHoldCard: (Card: { cardType?: string }) =>
			!HARNESS_EXCLUDED_CARD_TYPES.includes(Card.cardType ?? '') && monster.canHoldCard(Card),
	};
	return monster.cards.map(card =>
		HARNESS_EXCLUDED_CARD_TYPES.includes(card.cardType ?? '') ? drawCard({}, eligible) : card,
	);
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
	extraBosses = false,
): string[] {
	const winners: string[] = [];
	const parts = p.participants ?? [];
	for (const part of parts) {
		if (part.outcome !== 'win') continue;
		const label =
			stableIdToLabel.get(part.monsterId) ??
			(winCounts.has(part.monsterName) ? part.monsterName : undefined) ??
			// A boss a ring event added (the Gauntlet) is no sim slot.
			(extraBosses ? EXTRA_BOSS_LABEL : undefined);
		if (!label) {
			throw new Error(
				`simulate: could not map winner stableId=${part.monsterId} name=${part.monsterName} to a sim slot`,
			);
		}
		winCounts.set(label, (winCounts.get(label) ?? 0) + 1);
		winners.push(label);
	}
	return winners;
}

/** Share of fights (0-100) that any of `labels` won: a side's win rate. */
export function sideWinRate(res: Pick<SimResult, 'winnersByFight' | 'fights'>, labels: string[]): number {
	// Over `fights`, as `winRates` are, so the two stay comparable.
	const { fights } = res;
	if (fights === 0) return 0;
	const side = new Set(labels);
	const won = res.winnersByFight.filter(winners => winners.some(label => side.has(label))).length;
	return (won / fights) * 100;
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
	// Draws stay shuffled. The engine's deterministic-draw mode sorts the card pool
	// alphabetically and keeps the first card that passes its rarity roll, so early-alphabet
	// cards crowd out the rest: harness Weeping Angels carried about 6 Blast/Blast II in 9
	// slots instead of about 1.2, and "Clerics win 95%" was that bias, not Blast. The seeded
	// `Math.random` below already makes a shuffled draw reproducible.
	delete process.env.DECK_MONSTERS_DETERMINISTIC_DRAW;

	await engineReady;

	const prevRandom = Math.random;
	if (seed !== undefined) {
		Math.random = mulberry32(seed);
	}

	const hasTeams = monsters.some(m => m.team);
	const rollEvents = !!config.ringEvents && !hasTeams;
	const eventPick = mulberry32((seed ?? 1) * 104729 + 17);
	const ringEventCounts: Record<string, number> = {};
	const names = monsters.map((_, i) => `Sim ${i + 1}`);
	const winCounts = new Map<string, number>();
	const winnersByFight: string[][] = [];
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
				// One entry per fight, so entries line up with fight order (a Codex review of #403).
				winnersByFight.push([]);
				config.onFightResolved?.([]);
				return;
			}
			winnersByFight.push(pushWinCounts(winCounts, stableIdToLabel, p, rollEvents));
			config.onFightResolved?.(winnersByFight[winnersByFight.length - 1]!);
		},
	});

	// Excitement: HP fractions by monster name (the sim labels) and the lowest lead each side
	// reached in the current fight. Reset when a fight resolves.
	const excitement: FightExcitement[] = [];
	let hpFrac = new Map<string, number>();
	let lowestLead = new Map<string, number>();
	let loki = 0;
	let luck = 0;
	const unsubExcitement = config.trackExcitement
		? game.eventBus.subscribe(`sim-excitement:${subscriberRunId}:${roomId}`, {
				deliver(ev: GameEvent) {
					if (ev.type === 'ring.fightResolved') {
						const p = ev.payload as FightResolvedPayload;
						const winners = winnersByFight[winnersByFight.length - 1] ?? [];
						const winner = winners.find(w => lowestLead.has(w));
						excitement.push({
							rounds: typeof p.rounds === 'number' ? p.rounds : 0,
							loki,
							luck,
							...(winner ? { winnerLowestLead: lowestLead.get(winner)! } : {}),
						});
						hpFrac = new Map();
						lowestLead = new Map();
						loki = 0;
						luck = 0;
						return;
					}
					if (ev.type !== 'announce') return;
					const payload = ev.payload as { roll?: { strokeOfLuck?: boolean; curseOfLoki?: boolean }; combat?: { kind?: string; target?: { name?: string }; hp?: number; maxHp?: number } };
					if (payload.roll?.curseOfLoki) loki += 1;
					if (payload.roll?.strokeOfLuck) luck += 1;
					const combat = payload.combat;
					if ((combat?.kind === 'hit' || combat?.kind === 'heal') && combat.target?.name && combat.maxHp) {
						hpFrac.set(combat.target.name, Math.max(0, (combat.hp ?? 0) / combat.maxHp));
						for (const name of names) {
							const mine = hpFrac.get(name) ?? 1;
							const best = Math.max(...names.filter(n => n !== name).map(n => hpFrac.get(n) ?? 1));
							lowestLead.set(name, Math.min(lowestLead.get(name) ?? 0, mine - best));
						}
					}
				},
			})
		: undefined;

	const unsubDrop = game.eventBus.subscribe(`sim-drop:${subscriberRunId}:${roomId}`, {
		deliver(ev: GameEvent) {
			if (ev.type === 'ring.cardDrop' && ev.scope === 'public') cardDrops += 1;
		},
	});

	try {
		for (let f = 0; f < fights; f++) {
			ring.clearRing();

			const contestants = monsters.map((m, i) => {
				const type = parseMonsterType(m.type);
				const c =
					m.role === 'human'
						? buildHuman(type, m.level, m.deck, m.deckStyle)
						: buildContestant(type, m.level, m.deck, m.statSeed, f);
				if (m.chassis === 'reference') applyReferenceChassis(c.monster as unknown as Parameters<typeof applyReferenceChassis>[0]);
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
				// Classic harness contestants are built as bosses, and `randomContestant` puts every boss on the
				// shared boss team, which the ring treats as one faction. Give each contestant
				// its spec's team, or a faction of its own, on both the character and the monster
				// (the monster's team wins in `factionOf`). Otherwise teamless contestants in a
				// team fight never fight each other and all get credited a win, and ally checks
				// such as the Unconquerable Horn's rally treat every harness contestant as a teammate.
				// A real boss keeps what the ring gives it: the Boss team and boss targeting.
				if (m.role !== 'boss') {
					// A human with no team stays teamless, as a player's monster is, so the ring's
					// own rules (humans unite against bosses) apply to it. Classic sim contestants
					// were built as bosses and need a faction of their own.
					const faction = m.team ?? (m.role === 'human' ? undefined : `solo:${names[i]!}`);
					c.character.team = faction;
					c.monster.team = faction;
					// `randomContestant` gives every boss a boss targeting strategy. With no human
					// in a harness ring, that strategy falls back to a target chosen with teams
					// ignored, so team fights measured friendly fire. The default (next player)
					// is team-aware, and with one faction per teamless contestant it behaves the
					// same in a free-for-all.
					c.monster.targetingStrategy = undefined;
				}
				c.character.lastDailyFightCoinDay = getUtcDay();
				c.character.battles = { total: STEADY_STATE_BATTLES_TOTAL, wins: 0, losses: 0 };
				stableIdToLabel.set(c.monster.stableId as string, label);
				return c;
			});

			config.onContestants?.(contestants);

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

			// Snapshot before the fight mutates these in place, so the after-read below is a
			// real diff of what the engine credited (see `SimResult.coinsByOutcome` docblock)
			// rather than a recomputation from the coins/XP constants.
			const coinsBefore = contestants.map(c => c.character.coins as number);
			const monsterXpBefore = contestants.map(c => c.monster.xp as number);

			if (hasTeams) {
				// Set after `addMonster`, which can re-roll a ring event, and before the fight
				// starts. `clearRing()` at the top of the next iteration removes it again.
				(ring as unknown as { ringEvent: unknown }).ringEvent = HARNESS_TEAM_EVENT;
			} else if (rollEvents && eventPick() * 100 < RING_EVENT_CHANCE_PERCENT) {
				// The ring's own roll is off under the determinism switch this run sets, so roll
				// here, from its own eligible list, with a seeded pick. `activateRingEvent` spawns
				// a Gauntlet's extra bosses as the ring would.
				const event = selectRingEvent(buildRingEventContext(ring.contestants), eventPick());
				if (event) {
					ring.activateRingEvent(event);
					ringEventCounts[event.name] = (ringEventCounts[event.name] ?? 0) + 1;
				}
			}
			// After any ring event, and over the ring's roster rather than the configured monsters:
			// a Gauntlet's extra bosses join at activation, and their hits were missing from
			// `avgDamagePerCard` (a Codex review of PR #405).
			const removeHitListeners = installHitDamageCapture(ring.contestants as unknown as Contestant[], damageSums);

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
		unsubExcitement?.();
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
		winnersByFight,
		ringEvents: ringEventCounts,
		drawRate: fights > 0 ? (draws / fights) * 100 : 0,
		avgRounds: fights > 0 ? roundSum / fights : 0,
		avgDamagePerCard: aggregateDamagePerCard(damageSums),
		cardDropRate: fights > 0 ? cardDrops / fights : 0,
		coinsByOutcome,
		xpPerMonster: summarizeSamples(xpSamples),
		cancelledFights,
		...(config.trackExcitement ? { excitement } : {}),
	};
}

export function simMonsterLineup(monsters: SimMonsterSpec[]): string {
	return monsters.map(m => `${parseMonsterType(m.type)}:${m.level}`).join(',');
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
	playerType?: SimMonsterType;
	opponentType?: SimMonsterType;
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
	// Draws stay shuffled. The engine's deterministic-draw mode sorts the card pool
	// alphabetically and keeps the first card that passes its rarity roll, so early-alphabet
	// cards crowd out the rest: harness Weeping Angels carried about 6 Blast/Blast II in 9
	// slots instead of about 1.2, and "Clerics win 95%" was that bias, not Blast. The seeded
	// `Math.random` below already makes a shuffled draw reproducible.
	delete process.env.DECK_MONSTERS_DETERMINISTIC_DRAW;

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
