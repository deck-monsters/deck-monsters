import { SirRobinScroll } from './sir-robin.js';
import { TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS, getStrategyDescription } from '../../helpers/targeting-strategies.js';
import { ALMOST_NOTHING } from '../../helpers/costs.js';

// The "Fists of Virtue" scroll
export class SirRobinScrollAccordingToCleverHans extends SirRobinScroll {
	static itemType: string;
	static targetingStrategy: string;
	static description: string;
	static cost: number;
	static notForSale: boolean;

	constructor({ icon = '👦' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `Clever ${monster.givenName}'s mother told ${monster.pronouns.him} that whenever ${monster.pronouns.he} is in the ring ${monster.pronouns.he} should bravely look about, choose the monster with the highest current hp, and target them, unless directed otherwise by a specific card, and that's exactly what ${monster.pronouns.he}'ll do.`;
	}
}

SirRobinScrollAccordingToCleverHans.notForSale = true;
SirRobinScrollAccordingToCleverHans.cost = ALMOST_NOTHING.cost;
SirRobinScrollAccordingToCleverHans.itemType = 'The Tale of Sir Robin According to Clever Hans';
SirRobinScrollAccordingToCleverHans.targetingStrategy = TARGET_HIGHEST_HP_PLAYER_ACCORDING_TO_HANS;
SirRobinScrollAccordingToCleverHans.description = `He was not in the least bit scared to be mashed into a pulp, or to have his eyes gouged out, and his elbows broken, to have his kneecaps split, and his body burned away... brave Sir Robin!\n\n${getStrategyDescription(SirRobinScrollAccordingToCleverHans.targetingStrategy)}`;

export default SirRobinScrollAccordingToCleverHans;
