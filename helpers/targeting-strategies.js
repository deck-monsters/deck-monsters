/* eslint-disable max-len */

const sample = require('lodash.sample');

const TARGET_ALL_CONTESTANTS = 'TARGET_ALL_CONTESTANTS';
const TARGET_HIGHEST_HP_PLAYER = 'TARGET_HIGHEST_HP_PLAYER';
const TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS = 'TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS';
const TARGET_HIGHEST_XP_PLAYER = 'TARGET_HIGHEST_XP_PLAYER';
const TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS = 'TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS';
const TARGET_HUMAN_PLAYER_WEAK = 'TARGET_HUMAN_PLAYER_WEAK';
const TARGET_LOWEST_HP_PLAYER = 'TARGET_LOWEST_HP_PLAYER';
const TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS = 'TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS';
const TARGET_MAX_HP_PLAYER = 'TARGET_MAX_HP_PLAYER';
const TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS = 'TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS';
const TARGET_NEXT_PLAYER = 'TARGET_NEXT_PLAYER';
const TARGET_PLAYER_WHO_HIT_YOU_LAST = 'TARGET_PLAYER_WHO_HIT_YOU_LAST';
const TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS = 'TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS';
const TARGET_PREVIOUS_PLAYER = 'TARGET_PREVIOUS_PLAYER';
const TARGET_RANDOM_PLAYER = 'TARGET_RANDOM_PLAYER';
const TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS = 'TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS';

const descriptionMap = {
	[TARGET_ALL_CONTESTANTS]: 'Target everyone in the ring except yourself and your teammates.',
	[TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS]: "Your mother told you to target whichever monster currently has the highest hp, and that's exactly what you'll do.",
	[TARGET_HIGHEST_HP_PLAYER]: 'Target whichever opponent currently has the highest hp.',
	[TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS]: "Your mother told you to target the monster who has the highest xp, and that's exactly what you'll do.",
	[TARGET_HIGHEST_XP_PLAYER]: 'Target the opponent who has the highest xp.',
	[TARGET_HUMAN_PLAYER_WEAK]: 'Once again without emotion the humans are dead dead dead dead dead dead dead dead.',
	[TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS]: "Your mother told you to target the weakest monster in the ring, every time, and that's exactly what you'll do.",
	[TARGET_LOWEST_HP_PLAYER]: 'You target the weakest player in the ring, every time.',
	[TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS]: "Your mother told you to target whoever has the highest maximum hp in the ring even if they currently have less hp, and that's exactly what you'll do.",
	[TARGET_MAX_HP_PLAYER]: 'Target whoever has the highest maximum hp in the ring (other than yourself) even if they currently have less hp.',
	[TARGET_NEXT_PLAYER]: 'Keep your strategy simple: your opponent is always the person next to you.',
	[TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS]: "Your mother told you to target the monster who attacked you last, unless directed otherwise by a specific card, and that's exactly what you'll do.",
	[TARGET_PLAYER_WHO_HIT_YOU_LAST]: 'Target the opponent who attacked you last, unless directed otherwise by a specific card.',
	[TARGET_PREVIOUS_PLAYER]: "Your mother told you to keep your strategy simple: your opponent is always the person to your right (wait, no, your other right --No no, the other other... You know what? Just forget it... That one's fine).",
	[TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS]: "Your mother told you to target a random monster in the ring rather than following a defined order, and that's exactly what you'll do.",
	[TARGET_RANDOM_PLAYER]: 'Target a random opponent in the ring (other than yourself) rather than following a defined order'
};

function getStrategyDescription (strategy) {
	return descriptionMap[strategy] || strategy;
}

function getTarget ({ contestants = [], ignoreSelf = true, playerContestant, strategy = TARGET_NEXT_PLAYER, team }) {
	switch (strategy) {
		case TARGET_ALL_CONTESTANTS: {
			const filteredContestants = contestants.filter((contestant) => {
				if (ignoreSelf && contestant === playerContestant) return false;

				if (team && contestant.character.team === team) return false;

				return true;
			});

			if (filteredContestants.length < 1) return [...contestants];

			return filteredContestants;
		}
		case TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS: {
			return getTarget({ contestants, ignoreSelf: false, playerContestant, strategy: TARGET_HIGHEST_HP_PLAYER, team });
		}
		case TARGET_HIGHEST_HP_PLAYER: {
			const defaultTarget = getTarget({ contestants, ignoreSelf, playerContestant, team });
			const allContestants = getTarget({ contestants, ignoreSelf, playerContestant, strategy: TARGET_ALL_CONTESTANTS, team });

			return allContestants.reduce((potentialTarget, contestant) => {
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
			return getTarget({ contestants, ignoreSelf: false, playerContestant, strategy: TARGET_HIGHEST_XP_PLAYER, team });
		}
		case TARGET_HIGHEST_XP_PLAYER: {
			const defaultTarget = getTarget({ contestants, ignoreSelf, playerContestant, team });
			const allContestants = getTarget({ contestants, ignoreSelf, playerContestant, strategy: TARGET_ALL_CONTESTANTS, team });

			return allContestants.reduce((potentialTarget, contestant) => {
				// Maximize potential win bonus
				// If another monster has higher current xp, target them instead
				if (contestant.monster.xp > potentialTarget.monster.xp) {
					return contestant;
				}

				// Otherwise, continue
				return potentialTarget;
			}, defaultTarget);
		}
		case TARGET_HUMAN_PLAYER_WEAK: {
			const defaultTarget = getTarget({ contestants, ignoreSelf, playerContestant, team });
			const allContestants = getTarget({ contestants, ignoreSelf, playerContestant, strategy: TARGET_ALL_CONTESTANTS, team });

			// Are there any humans left in the room
			const potentialTargets = allContestants.filter(contestant => !contestant.isBoss);

			// No humans left or the person next to you just happens to be one? Go ahead and hit them!
			if (potentialTargets.length <= 0 || !defaultTarget.isBoss) {
				return defaultTarget;
			}

			// Found some humans? Great! Let's hit one of them, they all look alike anyway
			return sample(potentialTargets);
		}
		case TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS: {
			return getTarget({ contestants, ignoreSelf: false, playerContestant, strategy: TARGET_LOWEST_HP_PLAYER, team });
		}
		case TARGET_LOWEST_HP_PLAYER: {
			const defaultTarget = getTarget({ contestants, ignoreSelf, playerContestant, team });
			const allContestants = getTarget({ contestants, ignoreSelf, playerContestant, strategy: TARGET_ALL_CONTESTANTS, team });

			return allContestants.reduce((potentialTarget, contestant) => {
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
			return getTarget({ contestants, ignoreSelf: false, playerContestant, strategy: TARGET_MAX_HP_PLAYER, team });
		}
		case TARGET_MAX_HP_PLAYER: {
			const defaultTarget = getTarget({ contestants, ignoreSelf, playerContestant, team });
			const allContestants = getTarget({ contestants, ignoreSelf, playerContestant, strategy: TARGET_ALL_CONTESTANTS, team });

			return allContestants.reduce((potentialTarget, contestant) => {
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
			return getTarget({ contestants, ignoreSelf: false, playerContestant, strategy: TARGET_PLAYER_WHO_HIT_YOU_LAST, team });
		}
		case TARGET_PLAYER_WHO_HIT_YOU_LAST: {
			const defaultTarget = getTarget({ contestants, ignoreSelf, playerContestant, team });
			const allContestants = getTarget({ contestants, ignoreSelf, playerContestant, strategy: TARGET_ALL_CONTESTANTS, team });

			if (!playerContestant.monster.encounterModifiers.hitLog) {
				return defaultTarget;
			}

			let lastHit;

			if (ignoreSelf) {
				lastHit = playerContestant.monster.encounterModifiers.hitLog.find(hitter => hitter.assailant !== playerContestant.monster);
			} else {
				lastHit = playerContestant.monster.encounterModifiers.hitLog[0];
			}

			return allContestants.reduce((potentialTarget, contestant) => {
				if (contestant.monster.givenName === lastHit.assailant.givenName) {
					return contestant;
				}

				// Otherwise, continue
				return potentialTarget;
			}, defaultTarget);
		}
		case TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS: {
			return getTarget({ contestants, ignoreSelf: false, playerContestant, strategy: TARGET_RANDOM_PLAYER, team });
		}
		case TARGET_RANDOM_PLAYER: {
			const allContestants = getTarget({ contestants, ignoreSelf, playerContestant, strategy: TARGET_ALL_CONTESTANTS, team });

			// Pick any random target besides yourself
			return sample(allContestants);
		}
		case TARGET_PREVIOUS_PLAYER: {
			const allContestants = getTarget({ contestants, ignoreSelf: false, playerContestant, strategy: TARGET_ALL_CONTESTANTS, team });

			const currentIndex = allContestants.indexOf(playerContestant);
			let previousIndex = currentIndex - 1;

			if (previousIndex < 0) previousIndex = contestants.length - 1;

			return allContestants[previousIndex];
		}
		case TARGET_NEXT_PLAYER:
		default: {
			const allContestants = getTarget({ contestants, ignoreSelf: false, playerContestant, strategy: TARGET_ALL_CONTESTANTS, team });

			const currentIndex = allContestants.indexOf(playerContestant);
			let nextIndex = currentIndex + 1;

			if (nextIndex >= contestants.length) nextIndex = 0;

			return allContestants[nextIndex];
		}
	}
}

module.exports = {
	TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS,
	TARGET_HIGHEST_HP_PLAYER,
	TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS,
	TARGET_HIGHEST_XP_PLAYER,
	TARGET_HUMAN_PLAYER_WEAK,
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
	getStrategyDescription,
	getTarget
};
