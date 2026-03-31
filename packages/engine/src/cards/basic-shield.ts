import { BoostCard } from './boost.js';
import { BARD, FIGHTER } from '../constants/creature-classes.js';
import { REASONABLE } from '../helpers/costs.js';

export class BasicShieldCard extends BoostCard {
	static cardType = 'Basic Shield';
	static permittedClassesAndTypes = [BARD, FIGHTER];
	static description = 'Equip yourself for the battle ahead.';
	static level = 2;
	static cost = REASONABLE.cost;
	static defaults = {
		...BoostCard.defaults,
		boostAmount: 2,
	};

	constructor({ icon = '🛡', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest });
	}
}

export default BasicShieldCard;
