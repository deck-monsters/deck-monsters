import { HitCard } from './hit.js';
import { BARD, FIGHTER } from '../constants/creature-classes.js';
import { MINOTAUR } from '../constants/creature-types.js';
import { chance } from '../helpers/chance.js';
import { COMMON } from '../helpers/probabilities.js';
import { CHEAP } from '../helpers/costs.js';

const { roll } = chance;

export class WoodenSpearCard extends HitCard {
	static cardType = 'Wooden Spear';
	static permittedClassesAndTypes = [BARD, FIGHTER];
	static creatureType = MINOTAUR;
	static probability = COMMON.probability;
	static description = `A simple weapon fashioned for ${MINOTAUR}-hunting.`;
	static level = 1;
	static cost = CHEAP.cost;
	static defaults = {
		...HitCard.defaults,
		strModifier: 3,
	};
	static flavors = {
		hits: [
			['spears', 80],
			['stabs', 50],
			['chases into the bush and slaughters', 5],
		],
	};

	constructor({
		strModifier,
		icon = '🌳',
		...rest
	}: Record<string, any> = {}) {
		super({ icon, ...rest } as any);
		this.setOptions({ strModifier } as any);
	}

	get creatureType(): string {
		return (this.constructor as any).creatureType;
	}

	get strModifier(): number {
		return (this.options as any).strModifier;
	}

	override get stats(): string {
		return `${super.stats}\n+${this.strModifier} damage vs ${this.creatureType}`;
	}

	override getDamageRoll(player: any, target?: any): any {
		if (target?.name === this.creatureType) {
			return roll({
				primaryDice: this.damageDice,
				modifier: player.strModifier + this.strModifier,
				bonusDice: player.bonusDamageDice,
			});
		}
		return super.getDamageRoll(player, target);
	}
}

export default WoodenSpearCard;
