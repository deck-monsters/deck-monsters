import { ImmobilizeCard } from './immobilize.js';
import { AOE } from '../constants/card-classes.js';
import { COMMON } from '../helpers/probabilities.js';
import { VERY_CHEAP } from '../helpers/costs.js';
import {
	TARGET_ALL_CONTESTANTS,
	getTarget,
} from '../helpers/targeting-strategies.js';
import {
	BASILISK,
	GLADIATOR,
	JINN,
	MINOTAUR,
	WEEPING_ANGEL,
} from '../constants/creature-types.js';

export class MesmerizeCard extends ImmobilizeCard {
	static cardClass = [AOE];
	static cardType = 'Mesmerize';
	static actions = {
		IMMOBILIZE: 'mesmerize',
		IMMOBILIZES: 'mesmerizes',
		IMMOBILIZED: 'mesmerized',
	};
	static permittedClassesAndTypes = [WEEPING_ANGEL];
	static strongAgainstCreatureTypes = [BASILISK, GLADIATOR];
	static weakAgainstCreatureTypes = [MINOTAUR, WEEPING_ANGEL];
	static uselessAgainstCreatureTypes = [JINN];
	static probability = COMMON.probability;
	static description = `You strut and preen. Your beauty mesmerizes everyone, including yourself.`;
	static cost = VERY_CHEAP.cost;
	static defaults = {
		...ImmobilizeCard.defaults,
		freedomSavingThrowTargetAttr: 'int',
		targetProp: 'int',
	};
	static flavors = {
		hits: [
			['overwhelms', 80],
			['uses their natural beauty to overwhelm', 30],
			['stuns', 30],
		],
	};

	constructor({
		freedomSavingThrowTargetAttr,
		icon = '🌠',
		...rest
	}: Record<string, any> = {}) {
		super({ freedomSavingThrowTargetAttr, icon, ...rest });
	}

	override get stats(): string {
		return `Immobilize everyone.\n\n${super.stats}`;
	}

	override getTargets(
		player: any,
		_proposedTarget: any,
		_ring: any,
		activeContestants: any
	): any[] {
		return (getTarget({
			contestants: activeContestants,
			ignoreSelf: false,
			playerMonster: player,
			strategy: TARGET_ALL_CONTESTANTS,
			team: false,
		}) as any[]).map(({ monster }: any) => monster);
	}
}

export default MesmerizeCard;
