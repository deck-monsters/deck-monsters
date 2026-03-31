import { QinShiHuangScroll } from './qin-shi-huang.js';
import { TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS, getStrategyDescription } from '../../helpers/targeting-strategies.js';
import { ALMOST_NOTHING } from '../../helpers/costs.js';

export class QinShiHuangAccordingToCleverHansScroll extends QinShiHuangScroll {
	static itemType: string;
	static targetingStrategy: string;
	static description: string;
	static cost: number;
	static notForSale: boolean;

	constructor({ icon = '👦' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `Clever ${monster.givenName}'s mother told ${monster.pronouns.him} ${monster.pronouns.he} should seek to consolidate ${monster.pronouns.his} power and lay waste to the biggest monster in the ring by targeting the monster with the highest xp, unless directed otherwise by a specific card, and that's exactly what ${monster.pronouns.he}'ll do.`;
	}
}

QinShiHuangAccordingToCleverHansScroll.notForSale = true;
QinShiHuangAccordingToCleverHansScroll.cost = ALMOST_NOTHING.cost;
QinShiHuangAccordingToCleverHansScroll.itemType = 'The Annals of Qin Shi Huang According to Clever Hans';
QinShiHuangAccordingToCleverHansScroll.targetingStrategy = TARGET_HIGHEST_XP_PLAYER_ACCORDING_TO_HANS;
QinShiHuangAccordingToCleverHansScroll.description = `焚書坑儒\n\n${getStrategyDescription(QinShiHuangAccordingToCleverHansScroll.targetingStrategy)}`;

export default QinShiHuangAccordingToCleverHansScroll;
