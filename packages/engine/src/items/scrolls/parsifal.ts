import { TargetingScroll } from './targeting.js';
import { ABUNDANT } from '../../helpers/probabilities.js';
import { TARGET_NEXT_PLAYER, getStrategyDescription } from '../../helpers/targeting-strategies.js';

// The "default" scroll
export class ParsifalScroll extends TargetingScroll {
	static itemType: string;
	static numberOfUses: number;
	static targetingStrategy: string;
	static description: string;
	static level: number;
	static probability: number;

	constructor({ icon = '🏇' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `${monster.givenName} will obey ${monster.pronouns.his} mother and keep ${monster.pronouns.his} friends close and ${monster.pronouns.his} enemies closer, always attacking the opponent next to ${monster.pronouns.him} unless directed otherwise by a specific card.`;
	}
}

ParsifalScroll.itemType = 'The Gospel According to Parsifal';
ParsifalScroll.numberOfUses = 0;
ParsifalScroll.targetingStrategy = TARGET_NEXT_PLAYER;
ParsifalScroll.description = `My mother said that if you know your enemy and know yourself, you will not be put at risk even in a hundred battles. If you only know yourself, but not your opponent, you may win or may lose. If you know neither yourself nor your enemy, you will always endanger yourself.\n\n${getStrategyDescription(ParsifalScroll.targetingStrategy)}`;
ParsifalScroll.level = 0;
ParsifalScroll.probability = ABUNDANT.probability;

export default ParsifalScroll;
