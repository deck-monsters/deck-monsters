/**
 * Ring Events — random encounter modifiers rolled while the fight countdown is arming.
 *
 * Every effect is expressed as an override on the *contestant*, never on the monster.
 * `monster.team` and `monster.targetingStrategy` are `options`-backed and persist into the
 * room's state blob, so mutating them would permanently re-sort a player's monster (and
 * fight the Sorting Hat scroll). Contestants are wiped by `Ring.clearRing()` after every
 * fight, which makes these overrides inherently per-encounter.
 *
 * See `docs/architecture/boss-encounters.md`.
 */
import { sample, shuffle } from '../helpers/random.js';
import * as TEAMS from '../constants/teams.js';
import {
	TARGET_HIGHEST_XP_PLAYER,
	TARGET_RANDOM_PLAYER,
} from '../helpers/targeting-strategies.js';

/**
 * The Gauntlet rule (roadmap 38; `balance/variants.ts`). On in play, like `PIN_RULES`; the
 * harness switches it off for before/after.
 * - `rivalsWhenOutnumbered`: in a fight with a human in it, when bosses (ambush minions
 *   included) outnumber the humans at fight start, each boss gets a team of its own for that
 *   fight (`RIVAL_TEAM_PREFIX`, a contestant-level override like a ring event's), so the
 *   bosses may hit each other. Humans keep their real teams, teamless humans stay their own
 *   faction (the Challengers alliance is not formed), and equal numbers change nothing. A
 *   mega boss's fight, Blood Feud (already a free-for-all) and the team events (Common Cause,
 *   House War) skip it, and so does The Reckoning, whose bosses keep hunting the strongest
 *   challenger.
 *
 * Why: a lone human against the Gauntlet won 0-8% before and 25/36/60/71% at beginner/1/3/5
 * after; two humans went 1%/14% to 36%/50% at levels 1/3; an ordinary ambush went 15%/35% to
 * 59%/68% at levels 1/3. See `docs/archive/roadmap/38-gauntlet.md`.
 */
export const GAUNTLET_RULES = { rivalsWhenOutnumbered: true };

/**
 * Ring event frequency (roadmap 38). On in play; the harness switches it off for before/after.
 * When on, `selectRingEvent` picks by weight among ALL events and fires nothing if the pick is
 * ineligible. When off it picks among the eligible events only, which made a rarely-eligible
 * event as likely as its weight share of whatever happened to be eligible: the Gauntlet was
 * 100% of a lone player's countdowns and is now 30% of the rolls (7.5% of countdowns, once the
 * event chance is applied, down from 25%). See `docs/archive/roadmap/38-gauntlet.md`.
 */
export const RING_EVENT_RULES = { globalWeights: true };

export type RingEventId =
	| 'gauntlet'
	| 'blood-feud'
	| 'common-cause'
	| 'house-war'
	| 'the-reckoning';

/** The subset of `Contestant` a ring event is allowed to see and touch. */
export interface RingEventContestant {
	isBoss?: boolean;
	team?: string;
	targetingStrategy?: string;
}

export interface RingEventContext {
	contestants: RingEventContestant[];
	bossCount: number;
	playerCount: number;
}

/**
 * How combat ends for this event:
 * - `'last-contestant'` (default): fight ends when ≤1 active contestant remains.
 * - `'last-team'`: fight ends when all remaining active contestants belong to one faction.
 *   Every surviving member of that faction wins. Teamless contestants are each their own
 *   faction, so they can never trigger a last-team victory with a teammate.
 *
 * `team` on a contestant (from `apply()`) is still used only for target filtering, not
 * for victory determination in last-contestant mode. Setting `victoryMode: 'last-team'`
 * is what makes Common Cause and House War end when one side is eliminated rather than
 * when only a single monster survives.
 */
export type VictoryMode = 'last-contestant' | 'last-team';

export interface RingEventDefinition {
	id: RingEventId;
	name: string;
	/** Public banner announced during the countdown. */
	banner: string;
	weight: number;
	/** Bosses to pull into the ring before the fight starts. */
	extraBosses?: number;
	/** When true, targeting resolves with `team: false` — teams are ignored entirely. */
	freeForAll?: boolean;
	/**
	 * Victory condition override. Defaults to `'last-contestant'` when absent (standard
	 * free-for-all). Team events (Common Cause, House War) use `'last-team'`.
	 */
	victoryMode?: VictoryMode;
	eligible(context: RingEventContext): boolean;
	apply(contestants: RingEventContestant[]): void;
}

/** Team name used by Common Cause, deliberately distinct from the Sorting Hat houses. */
export const ALLIANCE_TEAM = 'The Alliance';

/**
 * The side teamless humans fight on while any boss is still fighting. Cleared the moment the
 * last boss is down, so the humans settle it among themselves (owner: "unite, then settle").
 * Also distinct from the Sorting Hat houses.
 */
export const CHALLENGERS_TEAM = 'The Challengers';

/**
 * Prefix of the one-boss teams the outnumbered rule (`GAUNTLET_RULES`) gives each boss for a
 * fight. Never shown to players: the roster snapshot and the turn line hide it.
 */
export const RIVAL_TEAM_PREFIX = 'rival:';
export const isRivalTeam = (team: string | null | undefined): boolean =>
	typeof team === 'string' && team.startsWith(RIVAL_TEAM_PREFIX);

const bosses = (contestants: RingEventContestant[]): RingEventContestant[] =>
	contestants.filter(contestant => contestant.isBoss);

const players = (contestants: RingEventContestant[]): RingEventContestant[] =>
	contestants.filter(contestant => !contestant.isBoss);

export const RING_EVENTS: RingEventDefinition[] = [
	{
		id: 'gauntlet',
		name: 'The Gauntlet',
		banner:
			'🏛️  THE GAUNTLET — the gates groan open and more bosses stalk into the ring. Survive them all.',
		weight: 30,
		extraBosses: 2,
		eligible: ({ playerCount }) => playerCount >= 1,
		apply: () => {},
	},
	{
		id: 'blood-feud',
		name: 'Blood Feud',
		banner:
			'🩸  BLOOD FEUD — old allegiances mean nothing tonight. Every monster in the ring fights for itself.',
		weight: 20,
		freeForAll: true,
		eligible: ({ contestants }) => contestants.length >= 3,
		apply: (contestants) => {
			// Bosses default to TARGET_HUMAN_PLAYER_WEAK, which skips other bosses. Override it
			// or a "free for all" would still leave the bosses politely ignoring each other.
			for (const boss of bosses(contestants)) {
				boss.targetingStrategy = TARGET_RANDOM_PLAYER;
			}
		},
	},
	{
		id: 'common-cause',
		name: 'Common Cause',
		banner:
			'🤝  COMMON CAUSE — the beastmasters call a truce. Every summoned monster stands together against the bosses.',
		weight: 20,
		/**
		 * Pure team event: fight ends when all bosses are eliminated (the Alliance wins)
		 * or all Alliance members are dead (bosses win). Every surviving Alliance member
		 * is recorded as a winner.
		 */
		victoryMode: 'last-team',
		eligible: ({ playerCount, bossCount }) => playerCount >= 2 && bossCount >= 1,
		apply: (contestants) => {
			for (const player of players(contestants)) {
				player.team = ALLIANCE_TEAM;
			}
		},
	},
	{
		id: 'house-war',
		name: 'House War',
		banner:
			'⚔️  HOUSE WAR — the beastmasters split into two rival houses. May the strongest house stand.',
		weight: 15,
		/**
		 * Pure two-house player event: fight ends when one house is eliminated. Every surviving
		 * member of the victorious house is recorded as a winner.
		 *
		 * Bosses are excluded from eligibility so this stays a two-sided war. Bosses all share
		 * one faction (`monster.team === 'Boss'`, and `userId === 'boss'` behind it), so adding
		 * them would not break the win condition — `factionOf` collapses them into a single
		 * third side — but it would turn a duel between two houses into a three-way elimination
		 * that only ends once two whole factions are wiped out. Common Cause is the
		 * boss-vs-player team event; keep House War player-only.
		 */
		victoryMode: 'last-team',
		eligible: ({ playerCount, bossCount }) => playerCount >= 3 && bossCount === 0,
		apply: (contestants) => {
			const houses = shuffle(Object.values(TEAMS) as string[]).slice(0, 2);
			players(contestants).forEach((player, index) => {
				player.team = houses[index % houses.length];
			});
		},
	},
	{
		id: 'the-reckoning',
		name: 'The Reckoning',
		banner:
			'👁️  THE RECKONING — the bosses ignore the stragglers. Tonight they hunt the strongest in the ring.',
		weight: 15,
		eligible: ({ bossCount, playerCount }) => bossCount >= 1 && playerCount >= 2,
		apply: (contestants) => {
			for (const boss of bosses(contestants)) {
				boss.targetingStrategy = TARGET_HIGHEST_XP_PLAYER;
			}
		},
	},
];

export const getRingEvent = (idOrName: string): RingEventDefinition | undefined => {
	const needle = idOrName.trim().toLowerCase();
	return RING_EVENTS.find(
		event => event.id === needle || event.name.toLowerCase() === needle
	);
};

export const buildRingEventContext = (
	contestants: RingEventContestant[]
): RingEventContext => ({
	contestants,
	bossCount: bosses(contestants).length,
	playerCount: players(contestants).length,
});

/**
 * Picks a ring event from those eligible for the current roster, weighted.
 *
 * `pick` is a number in `[0, totalWeight)` — passing it in rather than rolling internally
 * keeps selection deterministic under test. Returns `undefined` when nothing is eligible.
 */
export const selectRingEvent = (
	context: RingEventContext,
	pick: number = Math.random()
): RingEventDefinition | undefined => {
	const eligible = RING_EVENTS.filter(event => event.eligible(context));
	if (eligible.length <= 0) return undefined;

	if (RING_EVENT_RULES.globalWeights) {
		const totalAll = RING_EVENTS.reduce((total, event) => total + event.weight, 0);
		const targetAll = pick >= 0 && pick < 1 ? pick * totalAll : pick;
		let at = 0;
		for (const event of RING_EVENTS) {
			at += event.weight;
			if (targetAll < at) return event.eligible(context) ? event : undefined;
		}
		return undefined;
	}

	const totalWeight = eligible.reduce((total, event) => total + event.weight, 0);
	// Accept either an absolute weight offset or a 0–1 fraction.
	const target = pick >= 0 && pick < 1 ? pick * totalWeight : pick;

	let cursor = 0;
	for (const event of eligible) {
		cursor += event.weight;
		if (target < cursor) return event;
	}

	return eligible[eligible.length - 1] ?? sample(eligible);
};
