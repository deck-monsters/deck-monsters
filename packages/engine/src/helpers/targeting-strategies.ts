import { sample } from './random.js';

export const TARGET_ALL_CONTESTANTS = 'TARGET_ALL_CONTESTANTS';
export const TARGET_HIGHEST_HP_PLAYER = 'TARGET_HIGHEST_HP_PLAYER';
export const TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS =
	'TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS';
export const TARGET_HIGHEST_XP_PLAYER = 'TARGET_HIGHEST_XP_PLAYER';
export const TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS =
	'TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS';
export const TARGET_HUMAN_PLAYER_WEAK = 'TARGET_HUMAN_PLAYER_WEAK';
export const TARGET_LOWEST_HP_PLAYER = 'TARGET_LOWEST_HP_PLAYER';
export const TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS =
	'TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS';
export const TARGET_MAX_HP_PLAYER = 'TARGET_MAX_HP_PLAYER';
export const TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS = 'TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS';
export const TARGET_NEXT_PLAYER = 'TARGET_NEXT_PLAYER';
export const TARGET_PLAYER_WHO_HIT_YOU_LAST = 'TARGET_PLAYER_WHO_HIT_YOU_LAST';
export const TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS =
	'TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS';
export const TARGET_PREVIOUS_PLAYER = 'TARGET_PREVIOUS_PLAYER';
export const TARGET_RANDOM_PLAYER = 'TARGET_RANDOM_PLAYER';
export const TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS = 'TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS';

const descriptionMap: Record<string, string> = {
	[TARGET_ALL_CONTESTANTS]:
		'Target everyone in the ring except yourself and your teammates.',
	[TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS]:
		"Your mother told you to target whichever monster currently has the highest hp, and that's exactly what you'll do.",
	[TARGET_HIGHEST_HP_PLAYER]:
		'Target whichever opponent currently has the highest hp.',
	[TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS]:
		"Your mother told you to target the monster who has the highest xp, and that's exactly what you'll do.",
	[TARGET_HIGHEST_XP_PLAYER]: 'Target the opponent who has the highest xp.',
	[TARGET_HUMAN_PLAYER_WEAK]:
		'Once again without emotion the humans are dead dead dead dead dead dead dead dead.',
	[TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS]:
		"Your mother told you to target the weakest monster in the ring, every time, and that's exactly what you'll do.",
	[TARGET_LOWEST_HP_PLAYER]: 'You target the weakest player in the ring, every time.',
	[TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS]:
		"Your mother told you to target whoever has the highest maximum hp in the ring even if they currently have less hp, and that's exactly what you'll do.",
	[TARGET_MAX_HP_PLAYER]:
		'Target whoever has the highest maximum hp in the ring (other than yourself) even if they currently have less hp.',
	[TARGET_NEXT_PLAYER]:
		'Keep your strategy simple: your opponent is always the person next to you.',
	[TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS]:
		"Your mother told you to target the monster who attacked you last, unless directed otherwise by a specific card, and that's exactly what you'll do.",
	[TARGET_PLAYER_WHO_HIT_YOU_LAST]:
		'Target the opponent who attacked you last, unless directed otherwise by a specific card.',
	[TARGET_PREVIOUS_PLAYER]:
		"Your mother told you to keep your strategy simple: your opponent is always the person to your right (wait, no, your other right --No no, the other other... You know what? Just forget it... That one's fine).",
	[TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS]:
		"Your mother told you to target a random monster in the ring rather than following a defined order, and that's exactly what you'll do.",
	[TARGET_RANDOM_PLAYER]:
		'Target a random opponent in the ring (other than yourself) rather than following a defined order'
};

export const getStrategyDescription = (strategy: string): string =>
	descriptionMap[strategy] || strategy;

interface ContestantMonster {
	hp?: number;
	maxHp?: number;
	xp?: number;
	givenName?: string;
	team?: string;
	encounterModifiers?: {
		hitLog?: Array<{ assailant: { givenName?: string } }>;
	};
}

export interface Contestant {
	monster: ContestantMonster;
	character: { team?: string };
	isBoss?: boolean;
}

interface GetTargetOptions {
	contestants?: Contestant[];
	ignoreSelf?: boolean;
	playerContestant?: Contestant;
	playerMonster?: ContestantMonster;
	strategy?: string;
	team?: string | false;
}

export const getTarget = ({
	contestants = [],
	ignoreSelf = true,
	playerContestant,
	playerMonster,
	strategy = TARGET_NEXT_PLAYER,
	team
}: GetTargetOptions): Contestant | Contestant[] => {
	if (!playerContestant && playerMonster) {
		const foundPlayerContestant = contestants.find(
			({ monster }) => monster === playerMonster
		);

		if (foundPlayerContestant) {
			return getTarget({
				contestants,
				ignoreSelf,
				playerContestant: foundPlayerContestant,
				strategy,
				team
			});
		}
	}

	const resolvedPlayerContestant = playerContestant!;

	const playerTeam =
		team || resolvedPlayerContestant.monster.team || resolvedPlayerContestant.character.team;
	if (team === undefined && playerTeam) {
		return getTarget({
			contestants,
			ignoreSelf,
			playerContestant: resolvedPlayerContestant,
			strategy,
			team: playerTeam
		});
	}

	switch (strategy) {
		case TARGET_ALL_CONTESTANTS: {
			let found = team === false;
			const filteredContestants = contestants.filter((contestant) => {
				if (contestant === resolvedPlayerContestant) return !ignoreSelf;

				const contestantTeam =
					contestant.monster.team || contestant.character.team;
				if (team && contestantTeam === team) return false;

				found = true;
				return true;
			});

			if (!found) {
				return getTarget({
					contestants,
					ignoreSelf,
					playerContestant: resolvedPlayerContestant,
					strategy: TARGET_ALL_CONTESTANTS,
					team: false
				});
			}

			return filteredContestants;
		}
		case TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS: {
			return getTarget({
				contestants,
				ignoreSelf: false,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_HIGHEST_HP_PLAYER,
				team
			});
		}
		case TARGET_HIGHEST_HP_PLAYER: {
			const defaultTarget = getTarget({
				contestants,
				ignoreSelf,
				playerContestant: resolvedPlayerContestant,
				team
			}) as Contestant;
			const allContestants = getTarget({
				contestants,
				ignoreSelf,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_ALL_CONTESTANTS,
				team
			}) as Contestant[];

			return allContestants.reduce((potentialTarget, contestant) => {
				if ((contestant.monster.hp ?? 0) > (potentialTarget.monster.hp ?? 0)) {
					return contestant;
				}

				return potentialTarget;
			}, defaultTarget);
		}
		case TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS: {
			return getTarget({
				contestants,
				ignoreSelf: false,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_HIGHEST_XP_PLAYER,
				team
			});
		}
		case TARGET_HIGHEST_XP_PLAYER: {
			const defaultTarget = getTarget({
				contestants,
				ignoreSelf,
				playerContestant: resolvedPlayerContestant,
				team
			}) as Contestant;
			const allContestants = getTarget({
				contestants,
				ignoreSelf,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_ALL_CONTESTANTS,
				team
			}) as Contestant[];

			return allContestants.reduce((potentialTarget, contestant) => {
				if ((contestant.monster.xp ?? 0) > (potentialTarget.monster.xp ?? 0)) {
					return contestant;
				}

				return potentialTarget;
			}, defaultTarget);
		}
		case TARGET_HUMAN_PLAYER_WEAK: {
			const defaultTarget = getTarget({
				contestants,
				ignoreSelf,
				playerContestant: resolvedPlayerContestant,
				team: false
			}) as Contestant;
			const allContestants = getTarget({
				contestants,
				ignoreSelf,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_ALL_CONTESTANTS,
				team
			}) as Contestant[];

			const potentialTargets = allContestants.filter(
				contestant => !contestant.isBoss
			);

			if (potentialTargets.length <= 0 || !defaultTarget.isBoss) {
				return defaultTarget;
			}

			return sample(potentialTargets)!;
		}
		case TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS: {
			return getTarget({
				contestants,
				ignoreSelf: false,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_LOWEST_HP_PLAYER,
				team
			});
		}
		case TARGET_LOWEST_HP_PLAYER: {
			const defaultTarget = getTarget({
				contestants,
				ignoreSelf,
				playerContestant: resolvedPlayerContestant,
				team
			}) as Contestant;
			const allContestants = getTarget({
				contestants,
				ignoreSelf,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_ALL_CONTESTANTS,
				team
			}) as Contestant[];

			return allContestants.reduce((potentialTarget, contestant) => {
				if ((contestant.monster.hp ?? 0) < (potentialTarget.monster.hp ?? 0)) {
					return contestant;
				}

				return potentialTarget;
			}, defaultTarget);
		}
		case TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS: {
			return getTarget({
				contestants,
				ignoreSelf: false,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_MAX_HP_PLAYER,
				team
			});
		}
		case TARGET_MAX_HP_PLAYER: {
			const defaultTarget = getTarget({
				contestants,
				ignoreSelf,
				playerContestant: resolvedPlayerContestant,
				team
			}) as Contestant;
			const allContestants = getTarget({
				contestants,
				ignoreSelf,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_ALL_CONTESTANTS,
				team
			}) as Contestant[];

			return allContestants.reduce((potentialTarget, contestant) => {
				if ((contestant.monster.maxHp ?? 0) > (potentialTarget.monster.maxHp ?? 0)) {
					return contestant;
				}

				return potentialTarget;
			}, defaultTarget);
		}
		case TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS: {
			return getTarget({
				contestants,
				ignoreSelf: false,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_PLAYER_WHO_HIT_YOU_LAST,
				team
			});
		}
		case TARGET_PLAYER_WHO_HIT_YOU_LAST: {
			const defaultTarget = getTarget({
				contestants,
				ignoreSelf,
				playerContestant: resolvedPlayerContestant,
				team
			}) as Contestant;
			const allContestants = getTarget({
				contestants,
				ignoreSelf,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_ALL_CONTESTANTS,
				team
			}) as Contestant[];

			if (!resolvedPlayerContestant.monster.encounterModifiers?.hitLog) {
				return defaultTarget;
			}

			let lastHit: { assailant: { givenName?: string } } | undefined;

			if (ignoreSelf) {
				lastHit = resolvedPlayerContestant.monster.encounterModifiers.hitLog.find(
					hitter => hitter.assailant !== resolvedPlayerContestant.monster
				);
			} else {
				lastHit = resolvedPlayerContestant.monster.encounterModifiers.hitLog[0];
			}

			return allContestants.reduce((potentialTarget, contestant) => {
				if (contestant.monster.givenName === lastHit?.assailant.givenName) {
					return contestant;
				}

				return potentialTarget;
			}, defaultTarget);
		}
		case TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS: {
			return getTarget({
				contestants,
				ignoreSelf: false,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_RANDOM_PLAYER,
				team
			});
		}
		case TARGET_RANDOM_PLAYER: {
			const allContestants = getTarget({
				contestants,
				ignoreSelf,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_ALL_CONTESTANTS,
				team
			}) as Contestant[];

			return sample(allContestants)!;
		}
		case TARGET_PREVIOUS_PLAYER: {
			const allContestants = getTarget({
				contestants,
				ignoreSelf: false,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_ALL_CONTESTANTS,
				team
			}) as Contestant[];

			const currentIndex = allContestants.indexOf(resolvedPlayerContestant);
			let previousIndex = currentIndex - 1;

			if (previousIndex < 0) previousIndex = contestants.length - 1;

			return allContestants[previousIndex];
		}
		case TARGET_NEXT_PLAYER:
		default: {
			const allContestants = getTarget({
				contestants,
				ignoreSelf: false,
				playerContestant: resolvedPlayerContestant,
				strategy: TARGET_ALL_CONTESTANTS,
				team
			}) as Contestant[];

			const currentIndex = allContestants.indexOf(resolvedPlayerContestant);
			let nextIndex = currentIndex + 1;

			if (nextIndex >= allContestants.length) nextIndex = 0;

			return allContestants[nextIndex];
		}
	}
};
