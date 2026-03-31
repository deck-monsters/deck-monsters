import { BoostCard } from './boost.js';
import { BARD, CLERIC } from '../constants/creature-classes.js';
import { PRICEY } from '../helpers/costs.js';

export class FelineCompanionCard extends BoostCard {
	static cardType = 'Feline Companion';
	static permittedClassesAndTypes = [BARD, CLERIC];
	static description = 'A low purr in your ears helps you focus your energy.';
	static level = 2;
	static cost = PRICEY.cost;
	static notForSale = true;
	static defaults = {
		...BoostCard.defaults,
		boostAmount: 2,
		boostedProp: 'int',
	};

	constructor({ icon = '🐈', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest });
	}
}

export default FelineCompanionCard;
