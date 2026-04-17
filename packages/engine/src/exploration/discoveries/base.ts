import { BaseCard } from '../../cards/base.js';
import { discoveryCard } from '../../helpers/card.js';

export class BaseDiscoveryCard extends BaseCard {
	constructor(options?: Record<string, unknown>) {
		super(options);

		if (this.name === BaseDiscoveryCard.name) {
			throw new Error('The BaseDiscoveryCard Card should not be instantiated directly!');
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	override look(channel: any, _verbose?: boolean): Promise<void> {
		channel({ announce: discoveryCard(this) });
		return Promise.resolve();
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	override play(environment: any, monster: any): Promise<any> {
		return Promise.resolve(this.effect(environment, monster));
	}

	effect(_environment: any, _monster: any): boolean | Promise<boolean> {
		return true;
	}
}

(BaseDiscoveryCard as any).eventPrefix = 'discovery';

export default BaseDiscoveryCard;
