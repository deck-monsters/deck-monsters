import { ChaosTheoryScroll } from './chaos-theory.js';
import { TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS, getStrategyDescription } from '../../helpers/targeting-strategies.js';
import { ALMOST_NOTHING } from '../../helpers/costs.js';

export class ChaosTheoryAccordingToCleverHansScroll extends ChaosTheoryScroll {
	static itemType: string;
	static targetingStrategy: string;
	static description: string;
	static cost: number;
	static notForSale: boolean;

	constructor({ icon = '👦' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `Clever ${monster.givenName}'s mother told ${monster.pronouns.him} that ${monster.pronouns.he} should look around the ring and pick a random monster to target, unless directed otherwise by a specific card, and that's exactly what ${monster.pronouns.he}'ll do.`;
	}
}

ChaosTheoryAccordingToCleverHansScroll.notForSale = true;
ChaosTheoryAccordingToCleverHansScroll.cost = ALMOST_NOTHING.cost;
ChaosTheoryAccordingToCleverHansScroll.itemType = 'Chaos Theory for Beginners According to Clever Hans';
ChaosTheoryAccordingToCleverHansScroll.targetingStrategy = TARGET_RANDOM_PLAYER_ACCORDING_TO_HANS;
ChaosTheoryAccordingToCleverHansScroll.description = `Tiny variations, the orientation of hairs on your hand, the amount of blood distending your vessels, imperfections in the skin... vastly affect the outcome.\n\n${getStrategyDescription(ChaosTheoryAccordingToCleverHansScroll.targetingStrategy)}`;

export default ChaosTheoryAccordingToCleverHansScroll;
