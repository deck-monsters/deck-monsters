import { CoilCard } from './coil.js';
import { VERY_RARE } from '../helpers/probabilities.js';
import { PRICEY } from '../helpers/costs.js';

export class ConstrictCard extends CoilCard {
	static cardType = 'Constrict';
	static actions = {
		IMMOBILIZE: 'constrict',
		IMMOBILIZES: 'constricts',
		IMMOBILIZED: 'constricted',
	};
	static description =
		'Coil around your enemies with your body, and squeeze like you mean it.';
	static probability = VERY_RARE.probability;
	static level = 1;
	static cost = PRICEY.cost;
	static notForSale = false;
	static defaults = {
		...CoilCard.defaults,
		ongoingDamage: 2,
		freedomThresholdModifier: 3,
	};

	constructor({
		freedomSavingThrowTargetAttr,
		icon = '➰➰',
		...rest
	}: Record<string, any> = {}) {
		super({ freedomSavingThrowTargetAttr, icon, ...rest });
	}
}

export default ConstrictCard;
