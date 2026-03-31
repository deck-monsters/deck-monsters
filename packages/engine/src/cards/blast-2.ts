import { BlastCard, type BlastCardOptions } from './blast.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { PRICEY } from '../helpers/costs.js';

export class Blast2Card extends BlastCard {
	static cardType = 'Blast II';
	static description =
		'A strong magical blast against every opponent in the encounter.';
	static probability = UNCOMMON.probability;
	static level = 2;
	static cost = PRICEY.cost;
	static notForSale = true;
	static defaults = {
		damage: 3,
	};

	constructor({
		damage,
		icon = '💥',
		levelDamage,
	}: Partial<BlastCardOptions> = {}) {
		super({ damage, icon, levelDamage });
	}

	override get stats(): string {
		return `Blast II: ${this.damage} base damage + int bonus of caster`;
	}

	override effect(player: any, target: any): any {
		const damage = this.damage + player.intModifier;
		return target.hit(damage, player, this);
	}
}

export default Blast2Card;
