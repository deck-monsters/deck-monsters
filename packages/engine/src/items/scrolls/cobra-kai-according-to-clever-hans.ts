import { CobraKaiScroll } from './cobra-kai.js';
import { TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS, getStrategyDescription } from '../../helpers/targeting-strategies.js';
import { ALMOST_NOTHING } from '../../helpers/costs.js';

export class CobraKaiAccordingToCleverHansScroll extends CobraKaiScroll {
	static itemType: string;
	static targetingStrategy: string;
	static description: string;
	static cost: number;
	static notForSale: boolean;

	constructor({ icon = '👦' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `Clever ${monster.givenName}'s mother told ${monster.pronouns.him} that ${monster.pronouns.he} should target the monster with the lowest current xp while ${monster.pronouns.he} is in the ring unless directed otherwise by a specific card, and that's exactly what ${monster.pronouns.he}'ll do.`;
	}
}

CobraKaiAccordingToCleverHansScroll.notForSale = true;
CobraKaiAccordingToCleverHansScroll.cost = ALMOST_NOTHING.cost;
CobraKaiAccordingToCleverHansScroll.itemType = 'The Way of the Cobra Kai According to Clever Hans';
CobraKaiAccordingToCleverHansScroll.targetingStrategy = TARGET_LOWEST_HP_PLAYER_ACCORDING_TO_HANS;
CobraKaiAccordingToCleverHansScroll.description = `We do not train to be merciful here. Mercy is for the weak. Here, in the streets, in competition: A man confronts you, he is the enemy. An enemy deserves no mercy.\n\n${getStrategyDescription(CobraKaiAccordingToCleverHansScroll.targetingStrategy)}`;

export default CobraKaiAccordingToCleverHansScroll;
