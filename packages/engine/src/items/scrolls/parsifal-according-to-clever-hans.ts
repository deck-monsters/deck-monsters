import { ParsifalScroll } from './parsifal.js';
import { TARGET_PREVIOUS_PLAYER, getStrategyDescription } from '../../helpers/targeting-strategies.js';

// The "default" scroll
export class ParsifalAccordingToCleverHansScroll extends ParsifalScroll {
	static itemType: string;
	static numberOfUses: number;
	static targetingStrategy: string;
	static description: string;

	constructor({ icon = '🐎' }: { icon?: string } = {}) {
		super({ icon });
	}

	getTargetingDetails(monster: any): string {
		return `Clever ${monster.givenName}'s mother told ${monster.pronouns.him} that ${monster.pronouns.he} should keep ${monster.pronouns.his} friends closed and ${monster.pronouns.his} enemies should be the closers, and ${monster.pronouns.he} should always stack the openers up next to ${monster.pronouns.him} so ${monster.pronouns.he} never needs a chair unless directed otherwise by a specific card. Or... Something...`;
	}
}

ParsifalAccordingToCleverHansScroll.itemType = 'The Gospel According to Clever Hans';
ParsifalAccordingToCleverHansScroll.numberOfUses = 3;
ParsifalAccordingToCleverHansScroll.targetingStrategy = TARGET_PREVIOUS_PLAYER;
ParsifalAccordingToCleverHansScroll.description = `Your mother said that my mother said that if you know your enemy and know yourself, you will not be put at risk even in a hundred battles. If you only know yourself, but not your opponent, you may win or may lose. If you know neither yourself nor your enemy, you will always endanger yourself.\n\n${getStrategyDescription(ParsifalAccordingToCleverHansScroll.targetingStrategy)}`;

export default ParsifalAccordingToCleverHansScroll;
