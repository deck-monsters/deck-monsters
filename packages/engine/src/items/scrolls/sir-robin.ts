import { TargetingScroll } from './targeting.js';
import { TARGET_HIGHEST_HP_PLAYER, getStrategyDescription } from '../../helpers/targeting-strategies.js';

// The "Fists of Virtue" scroll
export class SirRobinScroll extends TargetingScroll {
	static itemType: string;
	static targetingStrategy: string;
	static description: string;

	constructor({ icon = '🙏' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `whenever ${monster.givenName} is in the ring ${monster.pronouns.he} will bravely look about, choose the opponent with the highest current hp, and target them, unless directed otherwise by a specific card.`;
	}
}

SirRobinScroll.itemType = 'The Tale of Sir Robin';
SirRobinScroll.targetingStrategy = TARGET_HIGHEST_HP_PLAYER;
SirRobinScroll.description = `He was not in the least bit scared to be mashed into a pulp, or to have his eyes gouged out, and his elbows broken, to have his kneecaps split, and his body burned away... brave Sir Robin!\n\n${getStrategyDescription(SirRobinScroll.targetingStrategy)}`;

export default SirRobinScroll;
