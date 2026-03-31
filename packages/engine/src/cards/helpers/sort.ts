import { sort } from '../../helpers/sort.js';

export const sortCardsAlphabetically = <T extends Record<string, unknown>>(
	toBeSorted: T[]
): T[] => sort(toBeSorted, 'cardType');
