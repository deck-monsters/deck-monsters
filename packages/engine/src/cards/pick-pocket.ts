import { BaseCard, type CardOptions } from './base.js';
import { randomHelpers } from '../helpers/random.js';
import { COMMON } from '../helpers/probabilities.js';
import { MELEE } from '../constants/card-classes.js';
import { VERY_CHEAP } from '../helpers/costs.js';
import {
	TARGET_HIGHEST_XP_PLAYER,
	getTarget,
} from '../helpers/targeting-strategies.js';

export class PickPocketCard extends BaseCard {
	static cardClass = [MELEE];
	static cardType = 'Pick Pocket';
	static probability = COMMON.probability;
	static description =
		'Reach into the pocket of the most skilled player and grab one of their cards to play as your own.';
	static cost = VERY_CHEAP.cost;

	constructor({ icon = '👇' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	override play(
		player: any,
		proposedTarget: any,
		ring: any,
		activeContestants: any
	): Promise<any> {
		this.emit('played', { player });

		const mostExperienced = (getTarget({
			contestants: activeContestants,
			playerMonster: player,
			strategy: TARGET_HIGHEST_XP_PLAYER,
		}) as any).monster;

		const randomCard = (randomHelpers.sample(
			mostExperienced.cards.filter(
				(card: any) => !['Pick Pocket'].includes(card.cardType)
			)
		) as any).clone();

		this.emit('narration', {
			narration: `${player.givenName} steals a card from the hand of ${mostExperienced.givenName}`,
		});

		return randomCard.play(player, proposedTarget, ring, activeContestants);
	}
}

export default PickPocketCard;
