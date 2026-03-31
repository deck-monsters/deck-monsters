import { HouseLannisterScroll } from './house-lannister.js';
import { TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS, getStrategyDescription } from '../../helpers/targeting-strategies.js';
import { ALMOST_NOTHING } from '../../helpers/costs.js';

export class HouseLannisterAccordingToCleverHans extends HouseLannisterScroll {
	static itemType: string;
	static targetingStrategy: string;
	static description: string;
	static cost: number;
	static notForSale: boolean;

	constructor({ icon = '👦' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `Clever ${monster.givenName}'s mother told ${monster.pronouns.him} that ${monster.pronouns.he} should target the monster who attacked ${monster.pronouns.him} last, unless directed otherwise by a specific card, and that's exactly what ${monster.pronouns.he}'ll do.`;
	}
}

HouseLannisterAccordingToCleverHans.notForSale = true;
HouseLannisterAccordingToCleverHans.cost = ALMOST_NOTHING.cost;
HouseLannisterAccordingToCleverHans.itemType = 'House Lannister According To Clever Hans';
HouseLannisterAccordingToCleverHans.targetingStrategy = TARGET_PLAYER_WHO_HIT_YOU_LAST_ACCORDING_TO_HANS;
HouseLannisterAccordingToCleverHans.description = `A Lannister always pays his debts...\n\n${getStrategyDescription(HouseLannisterAccordingToCleverHans.targetingStrategy)}`;

export default HouseLannisterAccordingToCleverHans;
