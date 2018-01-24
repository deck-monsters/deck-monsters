const sample = require('lodash.sample');

const TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS = 'TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS';
const TARGET_HIGHEST_HP_PLAYER = 'TARGET_HIGHEST_HP_PLAYER';
const TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS = 'TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS';
const TARGET_HIGHEST_XP_PLAYER = 'TARGET_HIGHEST_XP_PLAYER';
const TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS = 'TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS';
const TARGET_LOWEST_HP_PLAYER = 'TARGET_LOWEST_HP_PLAYER';
const TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS = 'TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS';
const TARGET_MAX_HP_PLAYER = 'TARGET_MAX_HP_PLAYER';
const TARGET_PREVIOUS_PLAYER = 'TARGET_PREVIOUS_PLAYER';
const TARGET_NEXT_PLAYER = 'TARGET_NEXT_PLAYER';
const TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS = 'TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS';
const TARGET_PLAYER_WHO_HIT_YOU_LAST = 'TARGET_PLAYER_WHO_HIT_YOU_LAST';
const TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS = 'TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS';
const TARGET_RANDOM_PLAYER = 'TARGET_RANDOM_PLAYER';

function getTarget ({ playerContestant, contestants = [], strategy = TARGET_NEXT_PLAYER, ignoreSelf = true }) {
	switch (strategy) {
		case TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS: {
			return getTarget({ playerContestant, contestants, strategy: TARGET_HIGHEST_HP_PLAYER, ignoreSelf: false });
		}
		case TARGET_HIGHEST_HP_PLAYER: {
			const defaultTarget = getTarget({ playerContestant, contestants });

			return contestants.reduce((potentialTarget, contestant) => {
				// Skip the player
				if (ignoreSelf && contestant === playerContestant) return potentialTarget;

				// Fists of virtue
				// If another monster has higher current hp, target them instead
				if (contestant.monster.hp > potentialTarget.monster.hp) {
					return contestant;
				}

				// Otherwise, continue
				return potentialTarget;
			}, defaultTarget);
		}
		case TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS: {
			return getTarget({ playerContestant, contestants, strategy: TARGET_HIGHEST_XP_PLAYER, ignoreSelf: false });
		}
		case TARGET_HIGHEST_XP_PLAYER: {
			const defaultTarget = getTarget({ playerContestant, contestants });

			return contestants.reduce((potentialTarget, contestant) => {
				// Skip the player
				if (ignoreSelf && contestant === playerContestant) return potentialTarget;

				// Maximize potential win bonus
				// If another monster has higher current xp, target them instead
				if (contestant.monster.xp > potentialTarget.monster.xp) {
					return contestant;
				}

				// Otherwise, continue
				return potentialTarget;
			}, defaultTarget);
		}
		case TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS: {
			return getTarget({ playerContestant, contestants, strategy: TARGET_LOWEST_HP_PLAYER, ignoreSelf: false });
		}
		case TARGET_LOWEST_HP_PLAYER: {
			const defaultTarget = getTarget({ playerContestant, contestants });

			return contestants.reduce((potentialTarget, contestant) => {
				// Skip the player
				if (ignoreSelf && contestant === playerContestant) return potentialTarget;

				// Fists of villainy
				// If another monster has lower current hp, target them instead
				if (contestant.monster.hp < potentialTarget.monster.hp) {
					return contestant;
				}

				// Otherwise, continue
				return potentialTarget;
			}, defaultTarget);
		}
		case TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS: {
			return getTarget({ playerContestant, contestants, strategy: TARGET_MAX_HP_PLAYER, ignoreSelf: false });
		}
		case TARGET_MAX_HP_PLAYER: {
			const defaultTarget = getTarget({ playerContestant, contestants });

			return contestants.reduce((potentialTarget, contestant) => {
				// Skip the player
				if (ignoreSelf && contestant === playerContestant) return potentialTarget;

				// Take down the big boss
				// If another monster has higher maxHp, target them instead
				if (contestant.monster.maxHp > potentialTarget.monster.maxHp) {
					return contestant;
				}

				// Otherwise, continue
				return potentialTarget;
			}, defaultTarget);
		}
		case TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS: {
			return getTarget({ playerContestant, contestants, strategy: TARGET_PLAYER_WHO_HIT_YOU_LAST, ignoreSelf: false });
		}
		case TARGET_PLAYER_WHO_HIT_YOU_LAST: {
			const defaultTarget = getTarget({ playerContestant, contestants });

			if (!playerContestant.monster.encounterModifiers.hitLog) {
				return defaultTarget;
			}

			let lastHit;

			if (ignoreSelf) {
				lastHit = playerContestant.monster.encounterModifiers.hitLog.find(hitter => hitter.assailant !== playerContestant.monster);
			} else {
				lastHit = playerContestant.monster.encounterModifiers.hitLog[0];
			}

			return contestants.reduce((potentialTarget, contestant) => {
				if (contestant.monster.givenName === lastHit.assailant.givenName) {
					return contestant;
				}

				// Otherwise, continue
				return potentialTarget;
			}, defaultTarget);
		}
		case TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS: {
			return getTarget({ playerContestant, contestants, strategy: TARGET_RANDOM_PLAYER, ignoreSelf: false });
		}
		case TARGET_RANDOM_PLAYER: {
			let potentialTargets = contestants;
			if (ignoreSelf) {
				// Skip the player
				potentialTargets = contestants.filter(contestant => (contestant !== playerContestant));
			}

			// Pick any random target besides yourself
			return sample(potentialTargets);
		}
		case TARGET_PREVIOUS_PLAYER: {
			const currentIndex = contestants.indexOf(playerContestant);
			let previousIndex = currentIndex - 1;

			if (previousIndex < 0) previousIndex = contestants.length - 1;

			return contestants[previousIndex];
		}
		case TARGET_NEXT_PLAYER:
		default: {
			const currentIndex = contestants.indexOf(playerContestant);
			let nextIndex = currentIndex + 1;

			if (nextIndex >= contestants.length) nextIndex = 0;

			return contestants[nextIndex];
		}
	}
}

module.exports = {
	TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS,
	TARGET_HIGHEST_HP_PLAYER,
	TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS,
	TARGET_HIGHEST_XP_PLAYER,
	TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS,
	TARGET_LOWEST_HP_PLAYER,
	TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS,
	TARGET_MAX_HP_PLAYER,
	TARGET_PREVIOUS_PLAYER,
	TARGET_NEXT_PLAYER,
	TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS,
	TARGET_PLAYER_WHO_HIT_YOU_LAST,
	TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS,
	TARGET_RANDOM_PLAYER,
	getTarget
};
