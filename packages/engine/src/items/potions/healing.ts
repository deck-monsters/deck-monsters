import { BasePotion } from './base.js';
import { COMMON } from '../../helpers/probabilities.js';
import { REASONABLE } from '../../helpers/costs.js';

export class HealingPotion extends BasePotion {
	static itemType: string;
	static probability: number;
	static healAmount: number;
	static numberOfUses: number;
	static description: string;
	static level: number;
	static cost: number;

	constructor({ icon = '💊' }: { icon?: string } = {}) {
		super({ icon });
	}

	get healAmount(): number {
		return (this.constructor as typeof HealingPotion).healAmount;
	}

	healingMessage(monster: any): string {
		return `${monster.givenName} drinks ${monster.pronouns.his} ${this.icon} ${this.itemType} for ${this.healAmount} hp.`;
	}

	action({ channel, channelName, monster }: { channel: any; channelName?: string; monster?: any }): boolean {
		const { healAmount } = this;

		if (monster && !monster.dead && healAmount) {
			this.emit('narration', {
				channel,
				channelName,
				narration: this.healingMessage(monster)
			});

			monster.heal(healAmount);

			return true;
		}

		return false;
	}
}

HealingPotion.itemType = 'Potion of Healing';
HealingPotion.probability = COMMON.probability;
HealingPotion.healAmount = 8;
HealingPotion.numberOfUses = 1;
HealingPotion.description = `Instantly heal ${HealingPotion.healAmount} hp.`;
HealingPotion.level = 1;
HealingPotion.cost = REASONABLE.cost;

export default HealingPotion;
