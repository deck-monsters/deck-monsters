import { TargetingScroll } from './targeting.js';
import { TARGET_LOWEST_HP_PLAYER, getStrategyDescription } from '../../helpers/targeting-strategies.js';

// The "Fists of Villainy" scroll
export class CobraKaiScroll extends TargetingScroll {
	static itemType: string;
	static targetingStrategy: string;
	static description: string;

	constructor({ icon = '🐍' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `${monster.givenName} will target the player with the lowest current xp while ${monster.pronouns.he} is in the ring unless directed otherwise by a specific card.`;
	}
}

CobraKaiScroll.itemType = 'The Way of the Cobra Kai';
CobraKaiScroll.targetingStrategy = TARGET_LOWEST_HP_PLAYER;
CobraKaiScroll.description = `We do not train to be merciful here. Mercy is for the weak. Here, in the streets, in competition: A man confronts you, he is the enemy. An enemy deserves no mercy.\n\n${getStrategyDescription(CobraKaiScroll.targetingStrategy)}`;

export default CobraKaiScroll;
