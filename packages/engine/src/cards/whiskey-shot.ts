import { HealCard } from './heal.js';
import { REASONABLE } from '../helpers/costs.js';

export class WhiskeyShotCard extends HealCard {
	static cardType = 'Whiskey Shot';
	static description = "1 shot of whiskey for your health. Doctor's orders.";
	static level = 2;
	static cost = REASONABLE.cost;
	static defaults = {
		...HealCard.defaults,
		healthDice: '1d8',
	};

	constructor({ healthDice, icon = '🥃', ...rest }: Record<string, any> = {}) {
		super({ healthDice, icon, ...rest });
	}
}

export default WhiskeyShotCard;
