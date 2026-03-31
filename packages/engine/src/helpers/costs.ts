import { reduce } from './collection.js';

export interface CostEntry {
	cost: number;
	name: string;
	icon: string;
}

export const FREE: CostEntry = { cost: 0, name: 'free', icon: '' };
export const ALMOST_NOTHING: CostEntry = { cost: 10, name: 'almost nothing', icon: '$' };
export const VERY_CHEAP: CostEntry = { cost: 20, name: 'a song', icon: '$$' };
export const CHEAP: CostEntry = { cost: 30, name: 'cheap', icon: '$$$' };
export const REASONABLE: CostEntry = { cost: 50, name: 'reasonable', icon: '$$$$' };
export const PRICEY: CostEntry = { cost: 80, name: 'pricey', icon: '$$$$$' };
export const EXPENSIVE: CostEntry = { cost: 130, name: 'expensive', icon: '$$$$$$' };

const all: Record<string, CostEntry> = {
	FREE,
	ALMOST_NOTHING,
	VERY_CHEAP,
	CHEAP,
	REASONABLE,
	PRICEY,
	EXPENSIVE
};

export const findCostMatch = (cost: number): CostEntry =>
	reduce(
		all,
		(result: CostEntry, possibility: CostEntry) => {
			if (cost <= possibility.cost && possibility.cost < result.cost) {
				return possibility;
			}

			return result;
		},
		EXPENSIVE
	);
