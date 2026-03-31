import { ImmobilizeCard } from './immobilize.js';
import { chance } from '../helpers/chance.js';
import {
	GLADIATOR,
	MINOTAUR,
	BASILISK,
	JINN,
} from '../constants/creature-types.js';
import { EPIC } from '../helpers/probabilities.js';
import { EXPENSIVE } from '../helpers/costs.js';
import { MELEE } from '../constants/card-classes.js';

const { roll } = chance;

export class CoilCard extends ImmobilizeCard {
	static cardClass = [MELEE];
	static cardType = 'Coil';
	static actions = {
		IMMOBILIZE: 'coil',
		IMMOBILIZES: 'coils',
		IMMOBILIZED: 'coiled',
	};
	static permittedClassesAndTypes = [BASILISK];
	static strongAgainstCreatureTypes = [GLADIATOR, MINOTAUR];
	static weakAgainstCreatureTypes = [BASILISK, JINN];
	static uselessAgainstCreatureTypes: string[] = [];
	static probability = EPIC.probability;
	static description = 'Coil around your enemies with your body, and squeeze.';
	static level = 0;
	static cost = EXPENSIVE.cost;
	static notForSale = true;
	static defaults = {
		...ImmobilizeCard.defaults,
		doDamageOnImmobilize: true,
		ongoingDamage: 1,
		freedomSavingThrowTargetAttr: 'dex',
	};
	static flavors = {
		hits: [
			['squeezes', 80],
			['squeezes and squeezes', 50],
			[
				'tightens so hard that anything on the inside that could easily come to the outside, well... _does_. This not only damages, but utterly humiliates',
				5,
			],
		],
	};

	constructor({
		freedomSavingThrowTargetAttr,
		icon = '➰',
		...rest
	}: Record<string, any> = {}) {
		super({ freedomSavingThrowTargetAttr, icon, ...rest });
	}

	override getAttackRoll(player: any, target: any): any {
		return roll({
			primaryDice: this.attackDice,
			modifier:
				player.strModifier + this.getAttackModifier(target),
			bonusDice: player.bonusAttackDice,
			crit: true,
		});
	}

	override get stats(): string {
		return `Immobilize and hit your opponent by coiling your serpentine body around them and squeezing. If opponent is immune, hit instead.\n\n${super.stats}`;
	}
}

export default CoilCard;
