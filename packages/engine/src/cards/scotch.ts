import { WhiskeyShotCard } from './whiskey-shot.js';
import { RARE } from '../helpers/probabilities.js';
import { PRICEY } from '../helpers/costs.js';

export class ScotchCard extends WhiskeyShotCard {
	static cardType = 'Scotch';
	static probability = RARE.probability;
	static description = "Keep the heid, this battle's far from over.";
	static level = 4;
	static cost = PRICEY.cost;
	static notForSale = true;
	static defaults = {
		...WhiskeyShotCard.defaults,
		healthDice: '2d6',
	};

	constructor({ healthDice, ...rest }: Record<string, any> = {}) {
		super({ healthDice, ...rest });
	}
}

export default ScotchCard;
