import { BasePotion } from './base.js';
import { random } from '../../helpers/random.js';
import { COMMON } from '../../helpers/probabilities.js';
import { VERY_CHEAP } from '../../helpers/costs.js';

export class SpinUp extends BasePotion {
	static itemType: string;
	static probability: number;
	static numberOfUses: number;
	static description: string;
	static level: number;
	static cost: number;

	constructor({ icon = '🧠' }: { icon?: string } = {}) {
		super({ icon });
	}

	healingMessage(monster: any, healAmount: number): string {
		return `${monster.givenName} is ${this.icon} spun up in a new sleeve with ${healAmount} hp.`;
	}

	action({ channel, channelName, monster }: { channel: any; channelName?: string; monster?: any }): boolean {
		if (monster && !monster.inEncounter && monster.dead) {
			const healAmount = random(1, Math.ceil(monster.maxHp));

			this.emit('narration', {
				channel,
				channelName,
				narration: this.healingMessage(monster, healAmount)
			});

			monster.respawn(true);
			monster.heal(healAmount);

			return true;
		}

		return false;
	}
}

// Altered Carbon reference...
SpinUp.itemType = 'Spin Up';
SpinUp.probability = COMMON.probability;
SpinUp.numberOfUses = 1;
SpinUp.description = 'Instantly spin monster back up in a new sleeve.';
SpinUp.level = 1;
SpinUp.cost = VERY_CHEAP.cost;

export default SpinUp;
