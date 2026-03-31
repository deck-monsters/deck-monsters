import { HitCard } from './hit.js';
import { BARD, BARBARIAN } from '../constants/creature-classes.js';
import { VERY_RARE } from '../helpers/probabilities.js';
import { EXPENSIVE } from '../helpers/costs.js';

export class PoundCard extends HitCard {
	static cardType = 'Pound';
	static permittedClassesAndTypes = [BARD, BARBARIAN];
	static probability = VERY_RARE.probability;
	static description =
		'You wield the mighty pound card and can do double the damage.';
	static level = 3;
	static cost = EXPENSIVE.cost;
	static notForSale = true;
	static defaults = {
		...HitCard.defaults,
		damageDice: '2d6',
	};
	static flavors = {
		hits: [
			['pounds', 80],
			['mercilessly beats', 70],
			['trashes', 70],
			['clubs', 50],
			['performs a vicious wedgie on', 5],
		],
	};

	constructor({
		damageDice,
		icon = '⚒',
		...rest
	}: Record<string, any> = {}) {
		super({ damageDice, icon, ...rest } as any);
	}
}

export default PoundCard;
