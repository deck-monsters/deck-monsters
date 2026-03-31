import { BlastCard } from './blast.js';
import { sample } from '../helpers/random.js';
import { ATTACK_PHASE } from '../constants/phases.js';
import { EPIC } from '../helpers/probabilities.js';
import { EXPENSIVE } from '../helpers/costs.js';
import { JINN } from '../constants/creature-types.js';
import { SANDSTORM_EFFECT } from '../constants/effect-types.js';
import { isProbable } from '../helpers/is-probable.js';

export class SandstormCard extends BlastCard {
	static cardType = 'Sandstorm';
	static permittedClassesAndTypes = [JINN];
	static probability = EPIC.probability;
	static description =
		'A blinding cloud of sand whips across the desert, damaging and confusing all those caught in it.';
	static level = 0;
	static cost = EXPENSIVE.cost;
	static notForSale = true;
	static defaults = {
		damage: 1,
		healProbability: 70,
		hitProbability: 30,
		levelDamage: 1,
	};
	static flavors = {
		hits: [
			['chokes', 80],
			['whips sand in the eyes of', 70],
			['calls upon the desert gods to destroy', 70],
			['disintigrates', 50],
			['turns to dust and buries', 5],
			[
				"pulls out a cassette labeled `Darude, 1999 (extended cut)` and slips a pair of headphones over the ears of",
				3,
			],
		],
	};

	constructor({
		healProbability,
		hitProbability,
		icon = '🌪',
		...rest
	}: Record<string, any> = {}) {
		super({ icon, ...rest });
		this.setOptions({ healProbability, hitProbability } as any);
	}

	get healProbability(): number {
		return (this.options as any).healProbability;
	}

	get hitProbability(): number {
		return (this.options as any).hitProbability;
	}

	override get stats(): string {
		return `${this.damage} storm damage +${this.levelDamage} per level of the jinni to everyone in the ring. Temporarily confuses opponents and causes them to mistake their targets.`;
	}

	override effect(sandstormPlayer: any, sandstormTarget: any): any {
		const alreadyLost = !!sandstormTarget.encounterEffects.find(
			(effect: any) => effect.effectType === SANDSTORM_EFFECT
		);

		if (alreadyLost) {
			this.emit('narration', {
				narration: `${sandstormTarget.givenName} is already lost and confused, so ${sandstormPlayer.givenName} takes advantage of ${sandstormTarget.pronouns.his} weakened state.`,
			});
			return (
				super.effect(sandstormPlayer, sandstormTarget) &&
				super.effect(sandstormPlayer, sandstormTarget)
			);
		}

		const sandstormEffect = ({
			card,
			phase,
			player: effectPlayer,
		}: any) => {
			if (phase === ATTACK_PHASE && effectPlayer === sandstormTarget) {
				sandstormTarget.encounterEffects =
					sandstormTarget.encounterEffects.filter(
						(encounterEffect: any) => encounterEffect !== sandstormEffect
					);

				const { getTargets } = card;

				if (getTargets) {
					if (card.cardType === SandstormCard.cardType) {
						card.getTargets = (
							player: any,
							proposedTarget: any,
							ring: any,
							activeContestants: any
						) => {
							this.emit('narration', {
								narration: `${sandstormTarget.givenName} whips up an even bigger cloud of sand than ${sandstormPlayer.givenName} did.`,
							});
							return getTargets.call(
								card,
								player,
								proposedTarget,
								ring,
								activeContestants
							);
						};
						return card;
					}

					card.getTargets = (
						player: any,
						proposedTarget: any,
						ring: any,
						activeContestants: any
					) => {
						this.emit('effect', {
							effectResult: `${this.icon} lost in a cloud of blinding sand kicked up by`,
							player: sandstormPlayer,
							target: sandstormTarget,
							ring,
							narration: `In the confusion of the sandstorm, ${sandstormTarget.givenName} will have trouble with ${sandstormTarget.pronouns.his} aim.`,
						});

						const oldTargets = getTargets.call(
							card,
							player,
							proposedTarget,
							ring,
							activeContestants
						);
						const newTargets: any[] = [];

						if (
							oldTargets.length === 1 &&
							oldTargets[0] === player &&
							isProbable({ probability: this.healProbability })
						) {
							newTargets.push(sandstormPlayer);
						}

						while (newTargets.length < oldTargets.length) {
							const { monster } = (sample(activeContestants) as any);
							if (
								monster !== sandstormPlayer ||
								isProbable({ probability: this.hitProbability })
							) {
								newTargets.push(monster);
							}
						}

						const messages: string[] = [];
						newTargets.forEach((newTarget: any, index: number) => {
							const formerTarget = oldTargets[index];
							const formerTargetName =
								formerTarget === sandstormTarget
									? `${sandstormTarget.pronouns.him}self`
									: formerTarget.givenName;
							const newTargetName =
								newTarget === sandstormTarget
									? `${sandstormTarget.pronouns.him}self`
									: newTarget.givenName;

							if (newTarget === formerTarget) {
								messages.push(
									`${sandstormTarget.givenName} keeps ${sandstormTarget.pronouns.his} wits about ${sandstormTarget.pronouns.him} and manages to target ${formerTargetName}.`
								);
							} else {
								messages.push(
									`While trying to target ${formerTargetName}, ${sandstormTarget.givenName} instead targets ${newTargetName}.`
								);
							}
						});

						this.emit('narration', {
							narration: `${messages.join('\n')}\n`,
						});

						return newTargets;
					};
				}
			}

			return card;
		};

		sandstormEffect.effectType = SANDSTORM_EFFECT;
		sandstormTarget.encounterEffects = [
			...sandstormTarget.encounterEffects,
			sandstormEffect,
		];

		return super.effect(sandstormPlayer, sandstormTarget);
	}
}

export default SandstormCard;
