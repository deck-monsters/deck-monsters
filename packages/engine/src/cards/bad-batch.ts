import { BaseCard, type CardOptions } from './base.js';
import { WhiskeyShotCard } from './whiskey-shot.js';
import { ScotchCard } from './scotch.js';
import { BAD_BATCH_EFFECT } from '../constants/effect-types.js';
import { BARD } from '../constants/creature-classes.js';
import { POISON } from '../constants/card-classes.js';
import { REASONABLE } from '../helpers/costs.js';
import { UNCOMMON } from '../helpers/probabilities.js';

export class BadBatchCard extends BaseCard {
	static cardClass = [POISON];
	static cardType = 'Bad Batch';
	static permittedClassesAndTypes = [BARD];
	static targetCards = [WhiskeyShotCard.cardType, ScotchCard.cardType];
	static probability = UNCOMMON.probability;
	static description =
		'Nothing like a little bathtub moonshine stored in sturdy lead jugs.';
	static level = 1;
	static cost = REASONABLE.cost;
	static notForSale = true;
	static flavors = {
		hits: [
			['poisons', 80],
			['slips a mysterious liquid in the cup of', 60],
			['buys a round for', 60],
			['offers a drink to', 60],
			['"accidentally" gives lead poisoning to', 20],
			['pours acid straight down the throat of', 5],
		],
	};

	constructor({ icon = '🍻' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get targetCards(): string[] {
		return (this.constructor as any).targetCards;
	}

	get stats(): string {
		return `The next ${this.targetCards.join(' or ')} played will poison rather than heal.`;
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	effect(badBatchPlayer: any, badBatchTarget: any, badBatchRing: any): any {
		const badBatchEffect = ({ card }: any) => {
			if (this.targetCards.includes(card.cardType)) {
				badBatchRing.encounterEffects = badBatchRing.encounterEffects.filter(
					(encounterEffect: any) => encounterEffect !== badBatchEffect
				);

				const { effect, getHealRoll } = card;

				if (effect && getHealRoll) {
					card.effect = (player: any, target: any) => {
						let narration: string;
						if (badBatchTarget === target) {
							narration = `${target.givenName} forgets which bottle is ${target.pronouns.his} whiskey and which one is poison.`;
						} else {
							narration = `${target.givenName} doesn't notice that the seal on ${target.pronouns.his} bottle has been tampered with.`;
						}

						this.emit('narration', { narration });

						const healRoll = getHealRoll.call(card, target);

						this.emit('rolled', {
							reason: 'to measure out a shot of whiskey.',
							card: this,
							roll: healRoll,
							who: target,
							outcome: 'Poisoned!',
						});

						return target.hit(healRoll.result, badBatchTarget, this);
					};
				}
			}
			return card;
		};

		badBatchEffect.effectType = BAD_BATCH_EFFECT;
		badBatchRing.encounterEffects = [
			...badBatchRing.encounterEffects,
			badBatchEffect,
		];

		this.emit('narration', {
			narration: `${badBatchTarget.identity} brews up a ${this.icon} bad batch of the strong drink.`,
		});

		return true;
	}
}

export default BadBatchCard;
