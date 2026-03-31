import { shuffle } from '../../helpers/random.js';
import isProbable from '../../helpers/is-probable.js';

import all from './all.js';

type ItemConstructor = (new (options?: any) => any) & { probability: number };

const draw = (options: Record<string, unknown> = {}, creature?: any): any | null => {
	let items = shuffle(all) as ItemConstructor[];

	if (creature) {
		items = items.filter((item: ItemConstructor) => creature.canHoldItem(item));
	}

	if (items.length <= 0) return null;

	const Item = items.find(isProbable as any);

	if (!Item) return draw(options, creature);

	return new Item(options);
};

export default draw;
export { draw };
