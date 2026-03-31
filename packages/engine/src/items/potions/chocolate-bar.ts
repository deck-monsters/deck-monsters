import { HealingPotion } from './healing.js';
import { capitalize } from '../../helpers/capitalize.js';
import { VERY_CHEAP } from '../../helpers/costs.js';

export class ChocolateBar extends HealingPotion {
	static itemType: string;
	static healAmount: number;
	static description: string;
	static cost: number;

	constructor({ icon = '🍫' }: { icon?: string } = {}) {
		super({ icon });
	}

	healingMessage(monster: any): string {
		return `${monster.givenName} unwraps ${monster.pronouns.his} ${this.icon} ${this.itemType} and bites in. ${capitalize(monster.pronouns.he)}'s feeling better already.`;
	}
}

ChocolateBar.itemType = 'Chocolate Bar';
ChocolateBar.healAmount = 1;
ChocolateBar.description = `A quick snack to restore ${ChocolateBar.healAmount} hp.`;
ChocolateBar.cost = VERY_CHEAP.cost;

export default ChocolateBar;
