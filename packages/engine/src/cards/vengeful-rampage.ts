import { HitCard } from './hit.js';
import { BARBARIAN } from '../constants/creature-classes.js';
import { RARE } from '../helpers/probabilities.js';
import { PRICEY } from '../helpers/costs.js';

export class VenegefulRampageCard extends HitCard {
	static cardType = 'Vengeful Rampage';
	static permittedClassesAndTypes = [BARBARIAN];
	static probability = RARE.probability;
	static description = 'Your wounds only make you stronger.';
	static level = 3;
	static cost = PRICEY.cost;
	static notForSale = true;
	static flavors = {
		hits: [
			['fights back against', 80],
			['screams with rage against', 70],
			['eviscerates', 70],
			['curses the very existance of', 50],
			['glows red with rage and annihilates', 5],
		],
	};

	override get stats(): string {
		return `Hit: ${this.attackDice} vs ac\nDamage: ${this.damageDice} +1 per wound suffered`;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	override getDamageRoll(player: any, _target?: any): any {
		const strModifier = Math.min(
			player.maxHp - player.hp,
			Math.max(player.strModifier * 2, 10)
		);
		return super.getDamageRoll({
			strModifier,
			bonusDamageDice: player.bonusDamageDice,
		});
	}
}

export default VenegefulRampageCard;
