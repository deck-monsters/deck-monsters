import { BoostCard } from './boost.js';
import { BASILISK } from '../constants/creature-types.js';
import { REASONABLE } from '../helpers/costs.js';

export class ThickSkinCard extends BoostCard {
	static cardType = 'Thick Skin';
	static permittedClassesAndTypes = [BASILISK];
	static description =
		'Grow a heavy layer of scales to deflect the blows of thine enemies.';
	static level = 2;
	static cost = REASONABLE.cost;
	static defaults = {
		...BoostCard.defaults,
		boostAmount: 2,
	};

	constructor({
		boostAmount,
		icon = '🔬',
		...rest
	}: Record<string, any> = {}) {
		super({ boostAmount, icon, ...rest });
	}
}

export default ThickSkinCard;
