import { CurseCard } from './curse.js';
import { REASONABLE } from '../helpers/costs.js';

export class MolassesCard extends CurseCard {
	static cardType = 'Molasses';
	static description = "Slow down your enemies like it's 1919.";
	static cost = REASONABLE.cost;
	static defaults = {
		...CurseCard.defaults,
		cursedProp: 'dex',
	};

	constructor({ icon = '🍯', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest });
	}
}

export default MolassesCard;
