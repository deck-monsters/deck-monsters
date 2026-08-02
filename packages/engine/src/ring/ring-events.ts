/**
 * Ring Events — random encounter modifiers rolled while the fight countdown is arming.
 *
 * Every effect is expressed as an override on the *contestant*, never on the monster.
 * `monster.team` and `monster.targetingStrategy` are `options`-backed and persist into the
 * room's state blob, so mutating them would permanently re-sort a player's monster (and
 * fight the Sorting Hat scroll). Contestants are wiped by `Ring.clearRing()` after every
 * fight, which makes these overrides inherently per-encounter.
 *
 * See `docs/boss-encounters.md`.
 */
import { sample, shuffle } from '../helpers/random.js';
import * as TEAMS from '../constants/teams.js';
import {
	TARGET_HIGHEST_XP_PLAYER,
	TARGET_RANDOM_PLAYER,
} from '../helpers/targeting-strategies.js';

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
	eligible(context: RingEventContext): boolean;
	apply(contestants: RingEventContestant[]): void;
}

/** Team name used by Common Cause, deliberately distinct from the Sorting Hat houses. */
export const ALLIANCE_TEAM = 'The Alliance';

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
			'⚔️  HOUSE WAR — the ring splits into two warbands. Choose your side, or have it chosen for you.',
		weight: 15,
		eligible: ({ playerCount }) => playerCount >= 3,
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
