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
	static description = `You strut and preen. Your beauty mesmerizes everyone. Now and then, even yourself.`;
	static cost = VERY_CHEAP.cost;
	/**
	 * Whether the caster mesmerizes itself (roadmap 36 task 3). `loki` rolls a d20 for the caster,
	 * and only a natural 1 catches it, so the joke survives as a rare Curse of Loki moment. It
	 * used to catch the caster every time ("including yourself"), which held the Weeping Angel in
	 * most of its own fights and left the card 3-7 points below the card it replaced one-on-one.
	 * Measured in the Angel's searched hands with the pin rule on, the natural-1 version is level
	 * with that card one-on-one and ahead in crowds, and it does not raise the Angel's field
	 * average. Never catching the caster measured the same but lost the joke. `always` is kept for
	 * the harness's before (`mesmerize-self-always`).
	 */
	static selfMesmerize: 'always' | 'loki' = 'loki';
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
		return (this.constructor as typeof MesmerizeCard).selfMesmerize === 'loki'
			? `Immobilize everyone. You are caught too only on a natural 1 (1d20).\n\n${super.stats}`
			: `Immobilize everyone, including yourself.\n\n${super.stats}`;
	}

	override effect(player: any, target: any, ring: any, activeContestants?: any): any {
		const { selfMesmerize } = this.constructor as typeof MesmerizeCard;
		if (target === player && selfMesmerize !== 'always') {
			const caught = chance.roll({ primaryDice: '1d20' }).naturalRoll.result === 1;
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
