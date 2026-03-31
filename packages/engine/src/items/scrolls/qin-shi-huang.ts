import { TargetingScroll } from './targeting.js';
import { TARGET_HIGHEST_XP_PLAYER, getStrategyDescription } from '../../helpers/targeting-strategies.js';

export class QinShiHuangScroll extends TargetingScroll {
	static itemType: string;
	static targetingStrategy: string;
	static description: string;

	constructor({ icon = '焚' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `${monster.givenName} will seek to consolidate ${monster.pronouns.his} power and lay waste to ${monster.pronouns.his} biggest foes in the ring by targeting the opponent with the highest xp, unless directed otherwise by a specific card.`;
	}
}

QinShiHuangScroll.itemType = 'The Annals of Qin Shi Huang';
QinShiHuangScroll.targetingStrategy = TARGET_HIGHEST_XP_PLAYER;
QinShiHuangScroll.description = `焚書坑儒\n\n${getStrategyDescription(QinShiHuangScroll.targetingStrategy)}`;

export default QinShiHuangScroll;
