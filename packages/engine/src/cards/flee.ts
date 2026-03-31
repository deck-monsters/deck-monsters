import { BaseCard, type CardOptions } from './base.js';
import { chance } from '../helpers/chance.js';
import { UNCOMMON } from '../helpers/probabilities.js';
import { ALMOST_NOTHING } from '../helpers/costs.js';
import { HIDE } from '../constants/card-classes.js';

const { roll } = chance;

export class FleeCard extends BaseCard {
	static cardClass = [HIDE];
	static cardType = 'Flee';
	static probability = UNCOMMON.probability;
	static description = 'There is no shame in living to fight another day.';
	static cost = ALMOST_NOTHING.cost;
	static noBosses = true;

	constructor({ icon = '🏃' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	get stats(): string {
		return 'Chance to run away if bloodied (hp < half)';
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	effect(player: any, target: any, ring: any, activeContestants: any): any {
		if (target.bloodied) {
			const fleeRoll = roll({
				primaryDice: '1d20',
				modifier: target.dexModifier,
				crit: true,
			});
			const { success } = this.checkSuccess(fleeRoll, 10);

			this.emit('rolled', {
				reason: 'and needs 10 or higher to flee.',
				card: this,
				roll: fleeRoll,
				who: target,
				outcome: success ? 'Success!' : 'Fail!',
			});

			return ring.channelManager.sendMessages().then(() => {
				if (success) {
					return target.leaveCombat(activeContestants);
				}

				this.emit('stay', {
					fleeResult: fleeRoll.result,
					fleeRoll,
					player: target,
					activeContestants,
				});

				return true;
			});
		}

		this.emit('stay', { player: target, activeContestants });
		return true;
	}
}

export default FleeCard;
