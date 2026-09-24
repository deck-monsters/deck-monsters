import { HornGore } from './horn-gore.js';
import { FIGHTER, BARBARIAN } from '../constants/creature-classes.js';
import {
	GLADIATOR,
	MINOTAUR,
	BASILISK,
	JINN,
	WEEPING_ANGEL,
} from '../constants/creature-types.js';
import { VERY_RARE } from '../helpers/probabilities.js';
import { PRICEY } from '../helpers/costs.js';

const STARTING_FREEDOM_THRESHOLD_MODIFIER = 3;

export class ForkedMetalRodCard extends HornGore {
	static cardType = 'Forked Metal Rod';
	static permittedClassesAndTypes = [FIGHTER, BARBARIAN];
	static strongAgainstCreatureTypes = [GLADIATOR, BASILISK];
	static uselessAgainstCreatureTypes = [WEEPING_ANGEL];
	static weakAgainstCreatureTypes = [JINN, MINOTAUR];
	static probability = VERY_RARE.probability;
	static description = `A dangerously sharp forked metal rod fashioned for ${[GLADIATOR, BASILISK].join(' and ')}-hunting.`;
	static level = 2;
	static cost = PRICEY.cost;
	static notForSale = true;
	static defaults = {
		...HornGore.defaults,
		damageDice: '1d6',
		freedomThresholdModifier: STARTING_FREEDOM_THRESHOLD_MODIFIER,
		freedomSavingThrowTargetAttr: 'str',
		targetProp: 'ac',
	};
	static flavors = {
		hits: [
			['stabs', 80],
			['pokes (in a not-so-facebook-flirting kind of way)', 50],
			[
				'snags and brutally lofts into the air their thoroughly surprised opponent',
				5,
			],
		],
		spike: 'prong',
	};

	constructor({
		freedomSavingThrowTargetAttr,
		icon = '⑂⑂',
		targetProp,
		...rest
	}: Record<string, any> = {}) {
		super({ freedomSavingThrowTargetAttr, icon, targetProp, ...rest });
	}

	override resetImmobilizeStrength(): void {
		this.freedomThresholdModifier = STARTING_FREEDOM_THRESHOLD_MODIFIER;
	}

	override get mechanics(): string {
		return `Attack twice (once with each ${this.flavors.spike}). +2 to hit and immobilize for each successful ${this.flavors.spike} hit.\n\nChance to immobilize: 1d20 vs ${this.freedomSavingThrowTargetAttr}.`;
	}

	override async effect(
		player: any,
		target: any,
		ring: any,
		activeContestants: any
	): Promise<any> {
		this.resetImmobilizeStrength();
		// These two `gore()` calls used to fire unawaited: not only did that skip the
		// pacing fixed in HornGore.gore() (both rolls could land in the same tick), the
		// promises raced each other and `effect()` returned before either had actually
		// resolved damage/death — a card whose stat box was already "done" while its
		// hits were still landing in the background. See docs/roadmap/10b-bugs-fixed.md
		// (two-roll-blocks-in-one-tick).
		await this.gore(player, target, ring, 1);
		await this.gore(player, target, ring, 2);

		if (!player.dead) {
			if (target.dead) return false;
			return this.immobilize(player, target, ring, activeContestants);
		}

		return !target.dead;
	}
}

export default ForkedMetalRodCard;
