import { HealCard } from './heal.js';
import { BARD, CLERIC, WIZARD } from '../constants/creature-classes.js';
import { EXPENSIVE } from '../helpers/costs.js';

export class ReviveCard extends HealCard {
	static cardType = 'Revive';
	static probability = 0;
	static description = 'Luckily, you happened to have a fairy in your pocket.';
	static cost = EXPENSIVE.cost;
	static level = 3;
	static permittedClassesAndTypes = [BARD, CLERIC, WIZARD];
	static notForSale = true;

	constructor({
		healthDice = '2d4',
		modifier = 3,
		icon = '⛑',
		...rest
	}: Record<string, any> = {}) {
		super({ healthDice, modifier, icon, ...rest });
	}
}

export default ReviveCard;
