import { ImmobilizeCard } from './immobilize.js';
import { BARD, BARBARIAN, FIGHTER } from '../constants/creature-classes.js';
import { BASILISK, GLADIATOR, JINN, MINOTAUR } from '../constants/creature-types.js';
import { MELEE } from '../constants/card-classes.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { REASONABLE } from '../helpers/costs.js';

export class ForkedStickCard extends ImmobilizeCard {
	static cardClass = [MELEE];
	static cardType = 'Forked Stick';
	static actions = {
		IMMOBILIZE: 'pin',
		IMMOBILIZES: 'pins',
		IMMOBILIZED: 'pinned',
		IMMOBILIZING: 'pinning',
	};
	static permittedClassesAndTypes = [BARD, BARBARIAN, FIGHTER];
	static strongAgainstCreatureTypes = [BASILISK, GLADIATOR];
	static weakAgainstCreatureTypes = [JINN, MINOTAUR];
	static probability = UNCOMMON.probability;
	static description = `A simple weapon fashioned for ${[BASILISK, GLADIATOR].join(' and ')}-hunting.`;
	static cost = REASONABLE.cost;
	static level = 0;
	static defaults = {
		...ImmobilizeCard.defaults,
		damageDice: '1d4',
		doDamageOnImmobilize: true,
		freedomSavingThrowTargetAttr: 'str',
		targetProp: 'dex',
	};
	static flavors = {
		hits: [
			['hits', 80],
			['pokes (in a not-so-facebook-flirting kind of way)', 50],
			[
				'snags and brutally lofts into the air their thoroughly surprised opponent',
				5,
			],
		],
		spike: 'branch',
	};

	constructor({
		freedomSavingThrowTargetAttr,
		icon = '⑂',
		targetProp,
		...rest
	}: Record<string, any> = {}) {
		super({ freedomSavingThrowTargetAttr, icon, targetProp, ...rest });
	}

	override immobilizeCheck(player: any, target: any): boolean {
		const immobilizeRoll = this.getImmobilizeRoll(player, target);
		const { success: immobilizeSuccess } = this.checkSuccess(
			immobilizeRoll,
			target[this.targetProp]
		);

		const failMessage = `${this.actions.IMMOBILIZE} failed.`;
		const outcome = immobilizeSuccess
			? `${this.actions.IMMOBILIZE} succeeded!`
			: failMessage;

		this.emit('rolled', {
			reason: `to see if ${player.pronouns.he} ${this.actions.IMMOBILIZES} ${target.givenName}.`,
			card: this,
			roll: immobilizeRoll,
			who: player,
			outcome,
			vs: target[this.targetProp],
		});

		if (!immobilizeSuccess) {
			this.emit('miss', {
				attackResult: immobilizeRoll.result,
				immobilizeRoll,
				player,
				target,
			});
		}

		return immobilizeSuccess;
	}

	override get stats(): string {
		return `Attempt to immobilize your opponent by ${(this.constructor as any).actions.IMMOBILIZING} them between the branches of a forked stick.\n\nChance to immobilize: 1d20 vs ${this.freedomSavingThrowTargetAttr}.\n${super.stats}`;
	}
}

export default ForkedStickCard;
