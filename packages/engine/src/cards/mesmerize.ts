import { ImmobilizeCard } from './immobilize.js';
import { AOE } from '../constants/card-classes.js';
import { COMMON } from '../helpers/probabilities.js';
import { VERY_CHEAP } from '../helpers/costs.js';
import { chance } from '../helpers/chance.js';
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
	/**
	 * Roadmap 36 task 3, being measured: whether the caster mesmerizes itself. `always` is today's
	 * rule ("including yourself"), which costs the caster its own turns. `never` spares it. `loki`
	 * rolls a d20 for the caster, and only a natural 1 catches it: the joke survives as a rare
	 * Curse of Loki moment instead of a cost on every play.
	 */
	static selfMesmerize: 'always' | 'never' | 'loki' = 'always';
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

	override effect(player: any, target: any, ring: any, activeContestants?: any): any {
		const { selfMesmerize } = this.constructor as typeof MesmerizeCard;
		if (target === player && selfMesmerize !== 'always') {
			const caught = selfMesmerize === 'loki' && chance.roll({ primaryDice: '1d20' }).naturalRoll.result === 1;
			if (!caught) return !player.dead;
			this.emit('narration', {
				narration: `${player.givenName} catches sight of ${player.pronouns.his} own reflection. Curse of Loki!`,
			});
		}
		return super.effect(player, target, ring, activeContestants);
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
