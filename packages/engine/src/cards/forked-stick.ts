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

	/** Set by a natural 1 on the pin roll; `immobilize` turns the stick on its holder. */
	private fumbled = false;

	override immobilizeCheck(player: any, target: any): boolean {
		const immobilizeRoll = this.getImmobilizeRoll(player, target);
		const { success: immobilizeSuccess, curseOfLoki } = this.checkSuccess(
			immobilizeRoll,
			target[this.targetProp]
		);

		const failMessage = `${this.actions.IMMOBILIZE} failed.`;
		const outcome = immobilizeSuccess
			? `${this.actions.IMMOBILIZE} succeeded!`
			: failMessage;

		this.emit('rolled', {
			success: immobilizeSuccess,
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
				curseOfLoki,
			});
		}
		this.fumbled = curseOfLoki;

		return immobilizeSuccess;
	}

	/*
	 * A natural 1 on the pin is flung back like a Hit's (roadmap 51): the target grabs the
	 * branch and jabs it into its holder, for the stick's damage rolled with the target's
	 * stats. Before this a natural 1 only failed the pin, so the one weapon in the Hit family
	 * whose own roll could not backfire was the stick.
	 */
	override async immobilize(player: any, target: any, ring: any, activeContestants?: any): Promise<any> {
		this.fumbled = false;
		const result = await super.immobilize(player, target, ring, activeContestants);
		if (!this.fumbled || player === target) return result;
		this.fumbled = false;
		this.emit('narration', {
			narration: `${this.icon} ${target.givenName} wrenches the branch away and jabs it back at ${player.givenName}.`,
		});
		const damageRoll = this.rollForDamage(target, player);
		// As Hit's flung-back blow: the play's result is whether its holder still stands.
		return player.hit(damageRoll.result, target, this);
	}

	override get stats(): string {
		return `Attempt to immobilize your opponent by ${(this.constructor as any).actions.IMMOBILIZING} them between the branches of a forked stick.\n\nChance to immobilize: ${this.attackDice} + ${this.freedomSavingThrowTargetAttr} vs ${this.targetProp}. On a natural 1 they jab it back at you.\n${super.stats}`;
	}
}

export default ForkedStickCard;
