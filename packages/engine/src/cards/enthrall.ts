import { ImmobilizeCard } from './immobilize.js';
import { mapSeries } from '../helpers/promise.js';
import { PSYCHIC } from '../constants/card-classes.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';
import {
	TARGET_ALL_CONTESTANTS,
	getTarget,
} from '../helpers/targeting-strategies.js';
import { isInvisible } from '../helpers/is-invisible.js';
import {
	BASILISK,
	GLADIATOR,
	JINN,
	MINOTAUR,
	WEEPING_ANGEL,
} from '../constants/creature-types.js';

export class EnthrallCard extends ImmobilizeCard {
	static cardClass = [PSYCHIC];
	static cardType = 'Enthrall';
	static actions = {
		IMMOBILIZE: 'enthrall',
		IMMOBILIZES: 'enthralls',
		IMMOBILIZED: 'enthralled',
	};
	static permittedClassesAndTypes = [WEEPING_ANGEL];
	static strongAgainstCreatureTypes = [BASILISK, GLADIATOR];
	static weakAgainstCreatureTypes = [MINOTAUR, WEEPING_ANGEL];
	static uselessAgainstCreatureTypes = [JINN];
	static probability = UNCOMMON.probability;
	static description = `You strut and preen. Your beauty enthralls everyone, except yourself.`;
	static level = 2;
	static cost = REASONABLE.cost;
	static defaults = {
		...ImmobilizeCard.defaults,
		freedomSavingThrowTargetAttr: 'int',
		targetProp: 'int',
	};
	static flavors = {
		hits: [
			['stuns', 80],
			['uses their natural beauty to incapacitate', 30],
			[
				'burns even Narcissus himself with their beauty... Which leaves no hope for',
				5,
			],
		],
	};

	constructor({
		freedomSavingThrowTargetAttr,
		targetProp,
		icon = '🎇',
		...rest
	}: Record<string, any> = {}) {
		super({ freedomSavingThrowTargetAttr, icon, targetProp, ...rest });
	}

	get mechanics(): string {
		return 'Immobilize all opponents.';
	}

	override get stats(): string {
		return `${this.mechanics}\n\n${super.stats}`;
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	override effect(
		player: any,
		target: any,
		ring: any,
		activeContestants: any
	): any {
		if (player === target) {
			this.emit('narration', {
				narration: `${player.givenName} prepares ${player.pronouns.him}self to ${this.actions.IMMOBILIZE} ${player.pronouns.his} targets.`,
			});
		} else {
			this.emit('narration', {
				narration: `${player.givenName} is confused and uses ${player.pronouns.his} power to help ${target.givenName} ${this.actions.IMMOBILIZE} ${target.pronouns.his} targets.`,
			});
		}

		if (isInvisible(target)) {
			this.emit('narration', {
				narration: `${target.givenName} is gets prepared but ${target.pronouns.he} is hidden from view, making it impossible for ${target.pronouns.him} to ${this.actions.IMMOBILIZE} anyone.`,
			});
			return true;
		}

		const targets = (getTarget({
			contestants: activeContestants,
			playerMonster: target,
			strategy: TARGET_ALL_CONTESTANTS,
		}) as any[]).map(({ monster }: any) => monster);

		return mapSeries(targets, (newTarget: any) =>
			super.effect(target, newTarget, ring, activeContestants)
		).then((results: any[]) => results.reduce((result: any, val: any) => result && val, true));
	}
}

export default EnthrallCard;
