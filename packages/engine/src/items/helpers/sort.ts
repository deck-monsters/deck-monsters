import { sort } from '../../helpers/sort.js';

export const sortItemsAlphabetically = <T extends Record<string, unknown>>(toBeSorted: T[]): T[] =>
	sort(toBeSorted, 'itemType');
