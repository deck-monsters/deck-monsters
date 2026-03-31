import { BaseScroll } from './base.js';
import { COMMON } from '../../helpers/probabilities.js';
import { VERY_CHEAP } from '../../helpers/costs.js';

export class TargetingScroll extends BaseScroll {
	static itemType: string;
	static probability: number;
	static numberOfUses: number;
	static description: string;
	static level: number;
	static cost: number;
	static targetingStrategy?: string;

	constructor({ icon = '🎯', targetingStrategy }: { icon?: string; targetingStrategy?: string } = {}) {
		if (targetingStrategy && typeof targetingStrategy !== 'string') {
			throw new Error('Targeting strategies must be a string.');
		}

		super({ icon, targetingStrategy } as any);

		if (this.name === TargetingScroll.name) {
			throw new Error('The TargetingScroll should not be instantiated directly!');
		}
	}

	get targetingStrategy(): string | undefined {
		return (this.options as any).targetingStrategy ?? (this.constructor as typeof TargetingScroll).targetingStrategy;
	}

	getTargetingDetails(_monster: any): string | undefined {
		return undefined;
	}

	action({ channel, channelName, monster }: { channel: any; channelName?: string; monster: any }): boolean {
		const { expired, targetingStrategy } = this;

		if (targetingStrategy) {
			monster.targetingStrategy = targetingStrategy;
		}

		let narration = `${monster.givenName} learns new tactics from a 📜 well-worn scroll entitled _${this.itemType}_.`;

		if (expired) {
			narration = `${narration} Just as ${monster.pronouns.he} finishes reading, the ancient paper on which it was written finally succumbs to time and decay and falls apart in ${monster.pronouns.his} hands.`;
		}

		const details = this.getTargetingDetails(monster);
		if (details) {
			narration = `${narration}\n\nFrom now on ${details}`;
		}

		this.emit('narration', {
			channel,
			channelName,
			narration
		});

		return true;
	}
}

TargetingScroll.itemType = 'Targeting Strategy';
TargetingScroll.probability = COMMON.probability;
TargetingScroll.numberOfUses = 3;
TargetingScroll.description = `Change your monster's targeting strategy up to ${TargetingScroll.numberOfUses} times.`;
TargetingScroll.level = 1;
TargetingScroll.cost = VERY_CHEAP.cost;

export default TargetingScroll;
