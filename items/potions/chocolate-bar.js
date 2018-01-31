/* eslint-disable max-len */

const HealingPotion = require('./healing');

const { capitalize } = require('../../helpers/capitalize');
const { VERY_CHEAP } = require('../../helpers/costs');

class ChocolateBar extends HealingPotion {
	constructor ({
		icon = '🍫'
	} = {}) {
		super({ icon });
	}

	healingMessage (monster) {
		return `${monster.givenName} unwraps ${monster.pronouns.his} ${this.icon} ${this.itemType} and bites in. ${capitalize(monster.pronouns.he)}'s feeling better already.`;
	}
}

ChocolateBar.itemType = 'Chocolate Bar';
ChocolateBar.healAmount = 1;
ChocolateBar.description = `A quick snack to restore ${ChocolateBar.healAmount} hp.`;
ChocolateBar.cost = VERY_CHEAP.cost;

module.exports = ChocolateBar;
