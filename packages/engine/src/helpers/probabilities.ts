import { reduce } from './collection.js';

export interface ProbabilityEntry {
	probability: number;
	name: string;
	icon: string;
}

export const IMPOSSIBLE: ProbabilityEntry = { probability: 0, name: 'impossible', icon: '✪' };
export const EPIC: ProbabilityEntry = { probability: 5, name: 'epic', icon: '☆' };
export const VERY_RARE: ProbabilityEntry = { probability: 10, name: 'very rare', icon: '★' };
export const RARE: ProbabilityEntry = { probability: 15, name: 'rare', icon: '◇' };
export const UNCOMMON: ProbabilityEntry = { probability: 25, name: 'uncommon', icon: '◆' };
export const COMMON: ProbabilityEntry = { probability: 40, name: 'common', icon: '○' };
export const ABUNDANT: ProbabilityEntry = { probability: 65, name: 'abundant', icon: '•' };

const all: Record<string, ProbabilityEntry> = {
	IMPOSSIBLE,
	EPIC,
	VERY_RARE,
	RARE,
	UNCOMMON,
	COMMON,
	ABUNDANT
};

export const findProbabilityMatch = (probability: number): ProbabilityEntry =>
	reduce(
		all,
		(result: ProbabilityEntry, possibility: ProbabilityEntry) => {
			if (
				probability <= possibility.probability &&
				possibility.probability < result.probability
			) {
				return possibility;
			}

			return result;
		},
		ABUNDANT
	);
