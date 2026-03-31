import { TargetingScroll } from './targeting.js';
import { TARGET_RANDOM_PLAYER, getStrategyDescription } from '../../helpers/targeting-strategies.js';

export class ChaosTheoryScroll extends TargetingScroll {
	static itemType: string;
	static targetingStrategy: string;
	static description: string;

	constructor({ icon = '🦋' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `${monster.givenName} will look around the ring and pick a random foe to target, unless directed otherwise by a specific card.`;
	}
}

ChaosTheoryScroll.itemType = 'Chaos Theory for Beginners';
ChaosTheoryScroll.targetingStrategy = TARGET_RANDOM_PLAYER;
ChaosTheoryScroll.description = `Tiny variations, the orientation of hairs on your hand, the amount of blood distending your vessels, imperfections in the skin... vastly affect the outcome.\n\n${getStrategyDescription(ChaosTheoryScroll.targetingStrategy)}`;

export default ChaosTheoryScroll;
