import { EnthrallCard } from './enthrall.js';
import { RARE } from '../helpers/probabilities.js';
import { PRICEY } from '../helpers/costs.js';

export class EntranceCard extends EnthrallCard {
	static cardType = 'Entrance';
	static actions = {
		IMMOBILIZE: 'entrance',
		IMMOBILIZES: 'entrances',
		IMMOBILIZED: 'entranced',
	};
	static probability = RARE.probability;
	static description = `You strut and preen. Your painful beauty entrances and hits everyone, except yourself.`;
	static level = 3;
	static cost = PRICEY.cost;
	static notForSale = true;
	static defaults = {
		...EnthrallCard.defaults,
		doDamageOnImmobilize: true,
		ongoingDamage: 1,
	};
	static flavors = {
		hits: [
			['stuns', 80],
			['uses their painfully stunning natural beauty against', 30],
			[
				"stuns even Narcissus himself with their beauty... And that's when they sucker punch",
				5,
			],
		],
	};

	constructor({
		freedomSavingThrowTargetAttr,
		icon = '🎆',
		ongoingDamage,
		...rest
	}: Record<string, any> = {}) {
		super({ freedomSavingThrowTargetAttr, icon, ongoingDamage, ...rest });
	}

	override get mechanics(): string {
		return 'Immobilize and hit all opponents.';
	}
}

export default EntranceCard;
