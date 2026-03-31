import { BasePotion } from './base.js';
import { COMMON } from '../../helpers/probabilities.js';
import { REASONABLE } from '../../helpers/costs.js';

export class Pokecen extends BasePotion {
	static itemType: string;
	static probability: number;
	static numberOfUses: number;
	static description: string;
	static level: number;
	static cost: number;

	constructor({ icon = '🏩' }: { icon?: string } = {}) {
		super({ icon });
	}

	healingMessage(monster: any): string {
		return `${monster.givenName}'s hp is fully restored.`;
	}

	action({ channel, channelName, monster }: { channel: any; channelName?: string; monster?: any }): boolean {
		if (monster && !monster.inEncounter && !monster.dead) {
			this.emit('narration', {
				channel,
				channelName,
				narration: this.healingMessage(monster)
			});

			monster.heal(monster.maxHp - monster.hp);

			return true;
		}

		return false;
	}
}

// Altered Carbon reference...
Pokecen.itemType = 'Pokecen';
Pokecen.probability = COMMON.probability;
Pokecen.numberOfUses = 1;
Pokecen.description = 'ポケモンセンター Heal Your Monsters!';
Pokecen.level = 1;
Pokecen.cost = REASONABLE.cost;

export default Pokecen;
