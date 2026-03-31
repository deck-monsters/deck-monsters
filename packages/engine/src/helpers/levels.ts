const STARTING_LEVEL = 0;

export const getLevel = (
	xp = 0,
	prevPrevThreshold = 0,
	prevThreshold = 50,
	level = STARTING_LEVEL
): number => {
	const threshold = prevPrevThreshold + prevThreshold;

	if (xp < threshold) {
		return level;
	}

	return getLevel(xp, prevThreshold, threshold, level + 1);
};

export interface LevelDescription {
	description: string;
	difference: number | undefined;
	opponentLevel: number | undefined;
	playerLevel: number | undefined;
}

export const describeLevels = (...levels: number[]): LevelDescription => {
	let description: string;
	let difference: number | undefined;
	let opponentLevel: number | undefined;
	let playerLevel: number | undefined;

	if (levels.length === 1) {
		playerLevel = levels[0];
		description = playerLevel ? `level ${playerLevel}` : 'beginner';
	} else if (levels.length === 2) {
		playerLevel = levels[0];
		opponentLevel = levels[1];

		difference = playerLevel - opponentLevel;

		if (difference === 0) {
			description = 'same level';
		} else {
			const absdiff = Math.abs(difference);
			const levelstr = absdiff === 1 ? 'level' : 'levels';

			description = `${absdiff} ${levelstr}`;
			if (difference > 0) {
				description = `${description} lower`;
			} else {
				description = `${description} higher`;
			}
		}
	} else {
		const levelsCopy = [...levels];
		playerLevel = levelsCopy.shift()!;
		opponentLevel = Math.round(
			levelsCopy.reduce((total, lvl) => total + lvl, 0) / levelsCopy.length
		);
		difference = playerLevel - opponentLevel;

		description = `average level of ${opponentLevel || 'beginner'}`;
	}

	return {
		description,
		difference,
		opponentLevel,
		playerLevel
	};
};
