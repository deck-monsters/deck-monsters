import { BaseCard, type CardOptions } from './base.js';
import { randomHelpers } from '../helpers/random.js';
import { COMMON } from '../helpers/probabilities.js';
import { MELEE } from '../constants/card-classes.js';
import { VERY_CHEAP } from '../helpers/costs.js';
import {
	TARGET_HIGHEST_XP_PLAYER,
	getTarget,
} from '../helpers/targeting-strategies.js';
import { playNestedCard } from './helpers/nested-play.js';

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

	override async play(
		player: any,
		proposedTarget: any,
		ring: any,
		activeContestants: any,
		shouldApplyEffects: boolean | 'card' = true
	): Promise<any> {
		// Lets a boss's steal narration reach the room feed; see BaseCard.playedBy.
		this.playedBy = player;

		// Steal first, then start the turn on the stolen card, as Random Play does with its
		// draw: upkeep that depends on the card (a burn put out by a Heal) sees the card that
		// will really be played. The turn still starts before this box, so a time-shifted or
		// held thief steals nothing. An empty pocket starts the turn on this card.
		const mostExperienced = (getTarget({
			contestants: activeContestants,
			playerMonster: player,
			strategy: TARGET_HIGHEST_XP_PLAYER,
			ring,
		}) as any).monster;

		const stealable = mostExperienced.cards.filter(
			(card: any) => !['Pick Pocket'].includes(card.cardType)
		);
		const sampled = randomHelpers.sample(stealable) as { clone?: () => any } | undefined;
		const stolen = sampled?.clone ? sampled.clone() : undefined;

		// 'card': this card was itself drawn or stolen, and the outer card ran the turn start.
		const { card: started, lost } =
			shouldApplyEffects === 'card'
				? { card: stolen, lost: false }
				: await (stolen ?? this).startTurn(player, proposedTarget, ring, activeContestants);
		if (lost) return this.playLostTurn(started, player, proposedTarget, ring, activeContestants);
		// A clone, so the deck card itself never keeps the "announced" mark.
		await this.clone().announcePlay(player, ring);

		if (!stolen) {
			this.emit('narration', {
				narration: `${player.givenName} reaches into ${mostExperienced.givenName}'s pocket... but finds it empty.`,
			});
			return true;
		}

		this.emit('narration', {
			narration: `${player.givenName} steals a card from the hand of ${mostExperienced.givenName} — and plays it as their own...`,
		});

		// The steal is already narrated above, so this only needs the pacing beat.
		return playNestedCard({
			card: started,
			player,
			proposedTarget,
			ring,
			activeContestants,
		});
	}
}

export default PickPocketCard;
