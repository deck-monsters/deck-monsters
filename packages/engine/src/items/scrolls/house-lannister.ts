import { TargetingScroll } from './targeting.js';
import { TARGET_PLAYER_WHO_HIT_YOU_LAST, getStrategyDescription } from '../../helpers/targeting-strategies.js';

export class HouseLannisterScroll extends TargetingScroll {
	static itemType: string;
	static targetingStrategy: string;
	static description: string;

	constructor({ icon = '🦁' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `${monster.givenName} will target the opponent who attacked ${monster.pronouns.him} last, unless directed otherwise by a specific card.`;
	}
}

HouseLannisterScroll.itemType = 'House Lannister';
HouseLannisterScroll.targetingStrategy = TARGET_PLAYER_WHO_HIT_YOU_LAST;
HouseLannisterScroll.description = `A Lannister always pays his debts...\n\n${getStrategyDescription(HouseLannisterScroll.targetingStrategy)}`;

export default HouseLannisterScroll;
