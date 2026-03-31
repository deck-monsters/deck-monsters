import { BerserkCard } from './berserk.js';
import { GLADIATOR } from '../constants/creature-types.js';
import { EPIC } from '../helpers/probabilities.js';
import { EXPENSIVE } from '../helpers/costs.js';

export class BattleFocusCard extends BerserkCard {
	static cardType = 'Battle Focus';
	static permittedClassesAndTypes = [GLADIATOR];
	static probability = EPIC.probability;
	static description =
		'Years of training, drill after drill, kick in. An attack is not a single hit, but a series of strikes each leading to another. Time seems to disappear and for a brief moment you and your adversary become perfectly in sync as you lead in a dance of their destruction.';
	static level = 0;
	static cost = EXPENSIVE.cost;
	static notForSale = true;
	static defaults = {
		...BerserkCard.defaults,
		damageDice: '1d6',
		bigFirstHit: true,
	};

	constructor({
		bigFirstHit,
		damage,
		damageDice,
		icon = '🥋',
		...rest
	}: Record<string, any> = {}) {
		super({ bigFirstHit, damage, damageDice, icon, ...rest });
	}
}

export default BattleFocusCard;
